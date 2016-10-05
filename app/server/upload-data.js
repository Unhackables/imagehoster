
import AWS from 'aws-sdk'
import config from 'config'
import Apis from 'shared/api_client/ApiInstances'

import fs from 'fs'
import {rateLimitReq, missing} from 'app/server/utils'
import {hash, Signature, PublicKey, PrivateKey} from 'shared/ecc'

const testKey = config.testKey ? PrivateKey.fromSeed('').toPublicKey() : null

const {amazonBucket, protocol, host, port} = config
const s3 = new AWS.S3()

const router = require('koa-router')()

const koaBody = require('koa-body')({
    multipart: true,
    formLimit: 20 * 1000 * 1024,
    // formidable: { uploadDir: '/tmp', }
})

router.post('/:type/:username/:signature', koaBody, function *() {
    try {
        const {files, fields} = this.request.body

        if(missing(this, files, 'data')) return
        if(missing(this, this.params, 'type')) return
        if(missing(this, this.params, 'username')) return
        if(missing(this, this.params, 'signature')) return

        // const {username} = fields
        const {type} = this.params
        if(type !== 'image') {
            this.status = 404
            this.statusText = `Unsupported type ${type}.  Try using 'image'` 
            this.body = {error: this.statusText}
            return
        }
        
        const {signature} = this.params
        const sig = Signature.fromHex(signature)

        const {username} = this.params
        const [{posting: {key_auths}, weight_threshold}] = yield Apis.db_api('get_accounts', [this.params.username])
        const [[posting_pubkey, weight]] = key_auths
        if(weight < weight_threshold) {
            this.status = 404
            this.statusText = `User ${username} has an unsupported posting key configuration.` 
            this.body = {error: this.statusText}
            return
        }

        const posting = PublicKey.fromString(posting_pubkey)

        // How can I keep a multipart form upload in memory (skip the file)?
        // https://github.com/tunnckoCore/koa-better-body/issues/67
        yield new Promise(resolve => {
            fs.readFile(files.data.path, 'binary', (err, data) => {
                if(err) {
                    console.error(err)
                    this.status = 404
                    this.statusText = `Upload failed.` 
                    this.body = {error: this.statusText}
                    resolve()
                    return
                }
                fs.unlink(files.data.path)

                const dataBuffer = new Buffer(data, 'binary')

                const sha = hash.sha256(dataBuffer)
                if(!sig.verifyHash(sha, posting) && !(testKey && sig.verifyHash(sha, testKey))) {
                    this.status = 404
                    this.statusText = `Signature did not verify.`
                    this.body = {error: this.statusText}
                    resolve()
                    return
                }

                const key = `${type}/${sha.toString('hex')}`
                const params = {Bucket: amazonBucket, Key: key, Body: dataBuffer};
                s3.putObject(params, (err, data) => {
                    if(err) {
                        console.log(err)
                        this.status = 404
                        this.statusText = `Error uploading ${key}.` 
                        this.body = {error: this.statusText}
                        resolve()
                        return
                    }
                    console.log(`Uploaded s3://${amazonBucket}/${key}`);
                    const url = `${protocol}://${host}:${port}/${key}`
                    this.body = {files: [{url}]}
                    resolve()
                })
            })
        })
    } catch(error) {console.error(error)} 
})

export default router.routes()
