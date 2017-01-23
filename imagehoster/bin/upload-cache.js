
/**
    Upload files from the disk-based imageproxy into the imagehoster Amazon buckets.
    
    nodejs has a 1.4gb max memory heap size by default, add --max_old_space_size=4096
    to the command line if you get an out of memory error during scanning
    
    node bin/upload-cache.js ../../imageproxy/cache
*/

// config
const cacheDir = process.argv[2] || '../../imageproxy/cache'

const AWS = require('aws-sdk')
if(process.env['STEEMIT_IMAGEPROXY_AWS_KEY_ID']) {
    AWS.config.accessKeyId = process.env['STEEMIT_IMAGEPROXY_AWS_KEY_ID']
}
if(process.env['STEEMIT_IMAGEPROXY_AWS_SECRET_KEY']) {
    AWS.config.secretAccessKey = process.env['STEEMIT_IMAGEPROXY_AWS_SECRET_KEY']
}

const webBucket = process.env.STEEMIT_IMAGEPROXY_BUCKET_WEB || 'steemit-dev-imageproxy-web'
const thumbnailBucket = process.env.STEEMIT_IMAGEPROXY_BUCKET_THUMBNAIL || 'steemit-dev-imageproxy-thumbnail'
const genWorkflow = require('./GeneratorPromiseWorkflow')

// program ..

const s3 = new AWS.S3()
const fs = require('fs')
const dimRe = /\d+x\d+/

const multihash = require('multihashes')
const base58 = require('bs58')
const fileType = require('file-type')
const readChunk = require('read-chunk')

function* upload() {
    const imageKeys = []

    console.log(`Scanning..`);
    const cacheFilesRaw = fs.readdirSync(cacheDir)
    const scanSize = cacheFilesRaw.length
    const scanReport = Math.max(Math.round(scanSize / 100), 1)
    
    for(let i = 0; i < cacheFilesRaw.length; i++) {
        const fname = cacheFilesRaw[i]
        if(i % scanReport === 0) {
            console.log(`Scanning ${Math.round(((i + 1) / scanSize) * 100)}%`);
        }
        // deda3dca887a2048a7cc4818ffeb5e69936f0744_100x100.bin
        // deda3dca887a2048a7cc4818ffeb5e69936f0744_500x500.bin
        // deda3dca887a2048a7cc4818ffeb5e69936f0744.bin
        // deda3dca887a2048a7cc4818ffeb5e69936f0744.json
        // deda3dca887a2048a7cc4818ffeb5e69936f0744.url
        if(fname.length < 38) continue

        const [name, ext] = fname.split('.')
        if(ext !== 'bin') continue

        const fn = cacheDir + '/' + fname
        const chunkBuffer = readChunk.sync(fn, 0, 4100)
        const ftype = fileType(chunkBuffer)
        if(!ftype || !/^image\/(gif|jpeg|png)$/.test(ftype.mime)) {
            // console.log('Skipping, invalid content type', fn, ftype);
            continue
        }

        const dimension = dimRe.test(name) && name.match(dimRe)[0]
        const sha1hex = name.substring(0, 40)
        const Key = 'U' +
            mhashEncode(new Buffer(sha1hex, 'hex'), 'sha1') +
            (dimension ? '_' + dimension : '')

        const Bucket = dimension ? thumbnailBucket : webBucket
        const imageKey = {Key, Bucket}

        imageKeys.push({imageKey, fname})
    }

    console.log(`Processing ${imageKeys.length} files..`);

    let min = 0
    let max = imageKeys.length - 1
    let pos = Math.floor(max / 2)

    function* startAt() {
        // console.log('min, pos, max', min, pos, max)
        const {imageKey} = imageKeys[pos]
        const exists = !!(yield s3call('headObject', imageKey))
        if(exists) {
            console.log(`already uploaded (${pos})`, JSON.stringify(imageKey, null, 0))
            min = pos + 1
            pos += Math.round((max - pos) / 2)
        } else {
            console.log(`uploaded needed (${pos})`, JSON.stringify(imageKey, null, 0))
            max = pos
            pos -= Math.round((pos - min) / 2)
        }
        return pos < max ? yield genWorkflow(startAt)() : pos
    }

    // Start at position 0 to force upload everything.. OR if files are in order find the startAt to restart a sync 
    pos = 0//yield genWorkflow(startAt)()
    if(pos == null) return

    for(let i = pos; i < imageKeys.length; i++) {
        const {imageKey, fname} = imageKeys[i]
        try {
            console.log(`uploading ${i}`, JSON.stringify(imageKey, null, 0))

            const Body = fs.readFileSync(cacheDir + '/' + fname)
            const ftype = fileType(Body)
            let ContentType
            if(ftype) {
                ContentType = ftype.mime
            } else {
                console.error('Error, unknown file type:', cacheDir + '/' + fname);
                continue
            }
            yield s3call('putObject', Object.assign({}, imageKey, {Body, ContentType}))
            // yield s3.waitFor('objectExists', imageKey)
        } catch(error) {
            console.error('Error processing ' + fname);
            console.error(error);
        }
    }
}

function s3call(method, params) {
    return new Promise((resolve, reject) => {
        s3[method](params, function(err, data) {
            if(err && (err.code === 'NotFound' || err.code === 'NoSuchKey')) {
                resolve(null)
            } else if (err) {
                console.error(method, params, err)
                reject(err)
            }
            else resolve(data);
        });
    })
}

const mhashEncode = (hash, mhashType) => base58.encode(multihash.encode(hash, mhashType))


const uploadWorkflow = genWorkflow(upload)
uploadWorkflow()
