
import fs from 'fs'
import AWS from 'aws-sdk'
import config from 'config'
import {hash} from 'shared/ecc'
import {sha1, mhashEncode} from 'app/server/hash'
import {missing, statusError} from 'app/server/utils-koa'
import {waitFor, s3call, s3} from 'app/server/amazon-bucket'

import base58 from 'bs58'
import multihash from 'multihashes'
import fileType from 'file-type'
import request from 'request'
import sharp from 'sharp'

const {uploadBucket, webBucket, thumbnailBucket} = config
const TRACE = false

const router = require('koa-router')()

// http://localhost:3234/100x150/https://cdn.meme.am/cache/instances/folder136/400x400/67577136.jpg
// http://localhost:3234/0x0/https://cdn.meme.am/cache/instances/folder136/400x400/67577136.jpg
router.get('/:width(\\d+)x:height(\\d+)/:url(.*)', function *() {
    if(missing(this, this.params, 'width')) return
    if(missing(this, this.params, 'height')) return
    if(missing(this, this.params, 'url')) return

    // NOTE: can't use req.params.url -- it doesn't include the query string.
    //   Instead, we take the full request URL and trim everything up to the
    //   start of 'http'. A few edge cases:
    //
    // * query strings
    // originalUrl: /150x100/https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcTZN5Du9Iai_05bMuJrxJuGTfqxNstuOvTP7Mzx-otuUVveeh8D
    // params.url:  https://encrypted-tbn2.gstatic.com/images
    // expect url:  https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcTZN5Du9Iai_05bMuJrxJuGTfqxNstuOvTP7Mzx-otuUVveeh8D
    //
    // * encoded parts
    // originalUrl: /150x100/https://vignette1.wikia.nocookie.net/villains/images/9/9c/Monstro_%28Disney%29.png
    // params.url:  https://vignette1.wikia.nocookie.net/villains/images/9/9c/Monstro_(Disney).png
    // expect url:  https://vignette1.wikia.nocookie.net/villains/images/9/9c/Monstro_%28Disney%29.png
    let url = this.request.originalUrl.substring(this.request.originalUrl.indexOf('http'))
    url = url.replace('steemit.com/ipfs/', 'ipfs.pics/ipfs/')

    if (url.match(/^https?:\/\//) === null) {
        statusError(this, 400, 'Bad Request')
        return
    }

    const targetWidth = parseInt(this.params.width, 10)
    const targetHeight = parseInt(this.params.height, 10)

    // image blacklist
    const blacklist = [
        'https://pbs.twimg.com/media/CoN_sC6XEAE7VOB.jpg:large',
        'https://ipfs.pics/ipfs/QmXz6jNVkH2FyMEUtXSAvbPN4EwG1uQJzDBq7gQCJs1Nym',
    ];
    if(blacklist.includes(url)) {
        statusError(this, 400, 'Bad Request')
        return
    }

    // referer blacklist
    const ref = this.request.headers.referer;
    if(ref && ref.match(/^https:\/\/www\.wholehk\.com/)) {
        statusError(this, 403, 'Forbidden')
        return
    }
    if (targetWidth > 1200 || targetHeight > 1200) {
        statusError(this, 400, 'Requested thumbnail size is too large')
        return
    }

    // Uploaded images were keyed by the hash of the image data and store these in the upload bucket.  
    // The proxy images use the hash of image url and are stored in the web bucket.
    const isUpload = simpleHashRe.test(url) // DQm...
    const Key = isUpload ? url.match(simpleHashRe)[0] : urlHash(url) // UQm...
    const Bucket = isUpload ? uploadBucket : webBucket
    const originalKey = {Bucket, Key}

    const resizeRequest = targetWidth !== 0
    if(resizeRequest) {
        const resizedKey = Key + `_${targetWidth}x${targetHeight}`
        const thumbnailKey = {Bucket: thumbnailBucket, Key: resizedKey}

        if(TRACE) console.log('image-proxy -> has thumbnail')
        const t = yield s3call('headObject', thumbnailKey)
        const hasThumbnail = (yield s3call('headObject', thumbnailKey)) != null

        if(hasThumbnail) {
            const params = {Bucket: thumbnailBucket, Key: resizedKey, Expires: 60}
            if(TRACE) console.log('image-proxy -> thumbnail redirect')
            const url = s3.getSignedUrl('getObject', params)
            this.redirect(url)
            return
        }

        // no thumbnail, fetch and cache
        if(TRACE) console.log('image-proxy -> fetch original')
        const imageResult = yield fetchImage(Bucket, Key, url)
        if(!imageResult) {
            statusError(this, 400, 'Bad Request')
            return
        }

        if(TRACE) console.log('image-proxy -> original save')
        yield s3call('putObject', Object.assign({}, originalKey, imageResult))
        // yield waitFor('objectExists', originalKey)

        try {
            if(TRACE) console.log('image-proxy -> prepare thumbnail')
            const thumbnail = yield prepareThumbnail(imageResult.Body, targetWidth, targetHeight)

            if(TRACE) console.log('image-proxy -> thumbnail save')
            yield s3call('putObject', Object.assign({}, thumbnailKey, thumbnail))
            // yield waitFor('objectExists', thumbnailKey)

            if(TRACE) console.log('image-proxy -> thumbnail redirect')
            const url = s3.getSignedUrl('getObject', thumbnailKey)
            this.redirect(url)
        } catch(error) {
            console.error('image-proxy resize error', this.request.originalUrl, error, error ? error.stack : undefined)
            if(TRACE) console.log('image-proxy -> resize error redirect', url)
            const url = s3.getSignedUrl('getObject', originalKey)
            this.redirect(url)
        }
        return
    }

    // A full size image

    if(TRACE) console.log('image-proxy -> has original')
    const hasOriginal = !!(yield s3call('headObject', originalKey))
    if(hasOriginal) {
        if(TRACE) console.log('image-proxy -> original redirect')
        const url = s3.getSignedUrl('getObject', originalKey)
        this.redirect(url)
        return
    }

    if(TRACE) console.log('image-proxy -> fetchImage')
    const imageResult = yield fetchImage(Bucket, Key, url)
    if(!imageResult) {
        statusError(this, 400, 'Bad Request')
        return
    }

    if(TRACE) console.log('image-proxy -> original save')
    yield s3call('putObject', Object.assign({}, originalKey, imageResult))
    // yield waitFor('objectExists', originalKey)

    if(TRACE) console.log('image-proxy -> original redirect')
    const signedUrl = s3.getSignedUrl('getObject', originalKey)
    this.redirect(signedUrl)
})

/** @return {object} - null or {Body, ContentType: string} */
function* fetchImage(Bucket, Key, url) {
    const img = yield s3call('getObject', {Bucket, Key})
    if(img) {
        const {Body, ContentType} = img
        return {Body, ContentType}
    }
    const opts = {
        url: url,
        timeout: 10000,
        followRedirect: true,
        maxRedirects: 2,
        rejectUnauthorized: false, // WARNING
        encoding: null
    }
    const imgResult = yield new Promise((resolve, reject) => {
        request(opts, (error, response, imageBuffer) => {
            if (imageBuffer) {
                const ftype = fileType(imageBuffer)
                if(!ftype || !/^image\/(gif|jpeg|png)$/.test(ftype.mime)) {
                    statusError(400, 'Supported image formats are: gif, jpeg, and png')
                    return
                }
                const {mime} = ftype
                resolve({Body: imageBuffer, ContentType: mime})
                return
            }
            console.error(error);
            statusError(404, 'Not Found')
            reject({error, response})
        })
    })
    yield s3call('putObject', Object.assign({}, {Bucket, Key}, imgResult))
    // yield waitFor('objectExists', {Bucket, Key})
    return imgResult
}

function* prepareThumbnail(imageBuffer, targetWidth, targetHeight) {
    const image = sharp(imageBuffer);
    const md = yield image.metadata()
    const geo = calculateGeo(md.width, md.height, targetWidth, targetHeight, 'fit')

    let i = image.resize(geo.finalWidth, geo.finalHeight)
    let type = md.format
    if(md.format === 'gif') {
        // convert animated gifs into a flat png
        i = i.toFormat('png')
        type = 'png'
    }
    const Body = yield i.toBuffer()
    return {Body, ContentType: `image/${type}`}
}

function calculateGeo(origWidth, origHeight, targetWidth, targetHeight, mode) {

    // Default ratio. Default crop.
    var origRatio  = (origHeight !== 0 ? (origWidth / origHeight) : 1),
        cropWidth  = origWidth,
        cropHeight = origHeight;

    // Fill in missing target dims.
    if (targetWidth === 0 && targetHeight === 0) {
        targetWidth  = origWidth;
        targetHeight = origHeight;
    } else if (targetWidth === 0) {
        targetWidth  = Math.round(targetHeight * origRatio);
    } else if (targetHeight === 0) {
        targetHeight = Math.round(targetWidth / origRatio);
    }

    // Constrain target dims.
    if(targetWidth > origWidth)   targetWidth  = origWidth;
    if(targetHeight > origHeight) targetHeight = origHeight;

    // If mode is 'fit', just scale. Otherwise crop to bounds.
    var targetRatio = targetWidth / targetHeight;
    if(mode == 'fit') {
        if (targetRatio > origRatio) {
            // max out height, and calc a smaller width
            targetWidth = Math.round(targetHeight * origRatio);
        } else if (targetRatio < origRatio) {
            // max out width, calc a smaller height
            targetHeight = Math.round(targetWidth / origRatio);
        }
    } else {
        if (targetRatio > origRatio) {
            // original image too high
            cropHeight = Math.round(origWidth / targetRatio);
        } else if (targetRatio < origRatio) {
            // original image too wide
            cropWidth = Math.round(origHeight * targetRatio);
        }
    }

    //logger.info('Original: ' + origWidth + 'x' + origHeight + ' -> Target: ' + targetWidth + 'x' + targetHeight);

    return {
        // This will be final size
        finalWidth:  targetWidth,
        finalHeight: targetHeight,

        // This is crop region (unused for now)
        cropWidth:  cropWidth,
        cropHeight: cropHeight
    };
}

const simpleHashRe = /DQm[a-zA-Z]{38,46}/
const urlHash = url => 'U' + mhashEncode(sha1(url), 'sha1')

export default router.routes()