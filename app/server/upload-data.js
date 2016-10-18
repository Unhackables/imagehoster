
import AWS from 'aws-sdk'
import config from 'config'
import Apis from 'shared/api_client/ApiInstances'
import RateLimit, {ms} from 'app/server/RateLimit'

import fs from 'fs'
import {repLog10} from 'app/server/utils'
import {missing, getRemoteIp, limit} from 'app/server/utils-koa'
import {hash, Signature, PublicKey, PrivateKey} from 'shared/ecc'

const testKey = config.testKey ? PrivateKey.fromSeed('').toPublicKey() : null

const {amazonBucket, protocol, host, port} = config
const {uploadIpLimit, uploadDataLimit} = config

const s3 = new AWS.S3()

const router = require('koa-router')()

const koaBody = require('koa-body')({
    multipart: true,
    formLimit: 20 * 1000 * 1024,
    // formidable: { uploadDir: '/tmp', }
})

const requestIpRateLimits = [
    new RateLimit({duration: ms.minute, max: uploadIpLimit.requestPerMinute}),
    new RateLimit({duration: ms.hour, max: uploadIpLimit.requestPerHour}),
    new RateLimit({duration: ms.day, max: uploadIpLimit.requestPerDay}),
]

const requestDataRateLimits = [
    new RateLimit({duration: ms.minute, max: uploadDataLimit.megsPerMinute}),
    new RateLimit({duration: ms.hour, max: uploadDataLimit.megsPerHour}),
    new RateLimit({duration: ms.day, max: uploadDataLimit.megsPerDay}),
    new RateLimit({duration: ms.week, max: uploadDataLimit.megsPerWeek}),
]

router.post('/:username/:signature', koaBody, function *() {
    try {
        const ip = getRemoteIp(this.req)
        if(limit(this, requestIpRateLimits, ip, 'Uploads', 'request')) return

        const {files, fields} = this.request.body

        const fileNames = Object.keys(files)
        if(missing(this, files, fileNames.length ? fileNames[0] : 'file')) return
        if(missing(this, this.params, 'username')) return
        if(missing(this, this.params, 'signature')) return

        const file = files[fileNames[0]]
        
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

        // How can I keep a multipart form upload in memory (skip the file)?
        // https://github.com/tunnckoCore/koa-better-body/issues/67
        yield new Promise(resolve => {
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

                const megs = data.length / (1024 * 1024)
                if(limit(this, requestDataRateLimits, username, 'Upload size', 'megabytes', megs)) {
                    resolve()
                    return
                }

                const dataBuffer = new Buffer(data, 'binary')

                const sha = hash.sha256(dataBuffer)
                if(!sig.verifyHash(sha, posting) && !(testKey && sig.verifyHash(sha, testKey))) {
                    this.status = 400
                    this.statusText = `Signature did not verify.`
                    this.body = {error: this.statusText}
                    resolve()
                    return
                }

                const key = sha.toString('hex')
                const params = {Bucket: amazonBucket, Key: key, Body: dataBuffer};
                s3.putObject(params, (err, data) => {
                    if(err) {
                        console.log(err)
                        this.status = 400
                        this.statusText = `Error uploading ${key}.` 
                        this.body = {error: this.statusText}
                        resolve()
                        return
                    }
                    console.log(`Uploaded s3://${amazonBucket}/${key}`);
                    const url = `${protocol}://${host}:${port}/${key}/${file.name}`
                    this.body = {url}
                    resolve()
                })
            })
        })
    } catch(error) {console.error(error)} 
})

export default router.routes()

const parseSig = hexSig => {try {return Signature.fromHex(hexSig)} catch(e) {return null}}
