
import AWS from 'aws-sdk'
import config from 'config'
import Apis from 'shared/api_client/ApiInstances'

import fs from 'fs'
import {repLog10} from 'app/server/utils'
import {missing, getRemoteIp, limit} from 'app/server/utils-koa'
import {hash, Signature, PublicKey, PrivateKey} from 'shared/ecc'
import fileType from 'file-type'
import exif from 'app/server/exif'
import multihash from 'multihashes'
import base58 from 'bs58'

const testKey = config.testKey ? PrivateKey.fromSeed('').toPublicKey() : null

const {uploadBucket, protocol, host, port} = config
const {uploadIpLimit, uploadDataLimit} = config

const s3 = new AWS.S3()

const router = require('koa-router')()

const koaBody = require('koa-body')({
    multipart: true,
    formLimit: 20 * 1000 * 1024,
    // formidable: { uploadDir: '/tmp', }
})

router.post('/:username/:signature', koaBody, function *() {
    const ip = getRemoteIp(this.req)
    if(yield limit(this, 'uploadIp', ip, 'Uploads', 'request')) return

    if(missing(this, this.params, 'username')) return
    if(missing(this, this.params, 'signature')) return

    const {files, fields} = this.request.body

    const fileNames = Object.keys(files)
    const {filename, filebase64} = fields

    if(!fileNames.length && !(filename && filebase64)) {
        missing(this, {}, 'file')
        return
    }

    const {signature} = this.params
    const sig = parseSig(signature)
    if(!sig) {
        this.status = 400
        this.statusText = `Unable to parse signature (expecting HEX data).` 
        this.body = {error: this.statusText}
        return
    }

    const {username} = this.params
    const [account] = yield Apis.db_api('get_accounts', [this.params.username])
    if(!account) {
        this.status = 400
        this.statusText = `Account '${this.params.username}' is not found on the blockchain.` 
        this.body = {error: this.statusText}
        return
    }
    const {posting: {key_auths}, weight_threshold, reputation} = account

    const rep = repLog10(reputation)
    if(rep < config.uploadIpLimit.minRep) {
        this.status = 400
        this.statusText = `Your reputation must be at least ${config.uploadIpLimit.minRep} to upload.` 
        this.body = {error: this.statusText}
        console.log(`Upload by '${username}' blocked: reputation ${rep} < ${config.uploadIpLimit.minRep}`);
        return
    }

    const [[posting_pubkey, weight]] = key_auths
    if(weight < weight_threshold) {
        this.status = 400
        this.statusText = `User ${username} has an unsupported posting key configuration.` 
        this.body = {error: this.statusText}
        return
    }

    const posting = PublicKey.fromString(posting_pubkey)

    let fbuffer, fname
    if(fileNames.length) {
        const file = files[fileNames[0]]
        fname = file.name
        // How can I keep a multipart form upload in memory (skip the file)?
        // https://github.com/tunnckoCore/koa-better-body/issues/67
        fbuffer = yield new Promise(resolve => {
            fs.readFile(file.path, 'binary', (err, data) => {
                if(err) {
                    console.error(err)
                    this.status = 400
                    this.statusText = `Upload failed.` 
                    this.body = {error: this.statusText}
                    resolve()
                    return
                }
                fs.unlink(file.path)
                resolve(new Buffer(data, 'binary'))
            })
        })
        if(!fbuffer)
            return
    } else {
        fname = filename ? filename : ''
        fbuffer = new Buffer(filebase64, 'base64')
    }

    let mime
    const ftype = fileType(fbuffer)
    if(ftype) {
        mime = ftype.mime
        if(!fname || fname === '' || fname === 'blob') {
            fname = `image.${ftype.ext}`
        }
    }

    if(!/^image\/(gif|jpeg|png)$/.test(mime)) {
        this.status = 400
        this.statusText = `Please upload only images.`
        this.body = {error: this.statusText}
        console.log(`Upload rejected, file: ${fname} mime: ${mime}`);
        return
    }

    const megs = fbuffer.length / (1024 * 1024)
    if(yield limit(this, 'uploadData', username, 'Upload size', 'megabytes', megs)) {
        return
    }

    const sha = hash.sha256(fbuffer)
    if(!sig.verifyHash(sha, posting) && !(testKey && sig.verifyHash(sha, testKey))) {
        this.status = 400
        this.statusText = `Signature did not verify.`
        this.body = {error: this.statusText}
        return
    }

    // Data hash (D)
    const key = 'D' + base58.encode(multihash.encode(sha, 'sha2-256'))
    if(mime === 'image/jpeg') {
        // For privacy, remove: GPS Information, Camera Info, etc.. 
        // Must verify signature before altering fbuffer
        try {
            const fclean = exif.remove(fbuffer);
            if(fclean) {
                fbuffer = fclean
            } else {
                console.error('Exif filter failure', key);
            }
        } catch(error) {
            console.error(error);
        }
    }

    const params = {Bucket: uploadBucket, Key: key, Body: fbuffer};
    if(mime) {
        params.ContentType = mime
    }

    yield new Promise(resolve => {
        s3.putObject(params, (err, data) => {
            if(err) {
                console.log(err)
                this.status = 400
                this.statusText = `Error uploading ${key}.` 
                this.body = {error: this.statusText}
                resolve()
                return
            }
            console.log(`Uploaded '${fname}' to s3://${uploadBucket}/${key}`);
            const fnameUri = encodeURIComponent(fname)
            const url = `${protocol}://${host}:${port}/${key}/${fnameUri}`
            this.body = {url}
            resolve()
        })
    })
})

export default router.routes()

const parseSig = hexSig => {try {return Signature.fromHex(hexSig)} catch(e) {return null}}
