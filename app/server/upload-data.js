
import AWS from 'aws-sdk'
import config from 'config'
import {rateLimitReq, missing} from 'app/server/utils'
import fs from 'fs'
import {hash} from 'shared/ecc'

const {amazonBucket, protocol, host, port} = config
const s3 = new AWS.S3()

const router = require('koa-router')()

const koaBody = require('koa-body')({
    multipart: true,
    formLimit: 20 * 1000 * 1024,
    // formidable: { uploadDir: '/tmp', }
})

router.post('/:type', koaBody, function *() {
    try {
        const {files, fields} = this.request.body

        if(missing(this, files, 'data')) return
        // if(missing(this, fields, 'username')) return
        if(missing(this, this.params, 'type')) return

        // const {username} = fields
        const {type} = this.params
        if(type !== 'image') {
            this.status = 404
            this.statusText = `Unsupported type ${type}.  Try using 'image'` 
            return
        }
        
        // Question: How can I keep a multipart form upload in memory (skip the file)?
        // https://github.com/tunnckoCore/koa-better-body/issues/67
        yield new Promise(resolve => {
            fs.readFile(files.data.path, 'binary', (err, data) => {
                if(err) return console.error(err)
                fs.unlink(files.data.path)
                const dataBuffer = new Buffer(data, 'binary')
                const sha = hash.sha256(dataBuffer)
                const key = `${type}/${sha.toString('hex')}`
                    const params = {Bucket: amazonBucket, Key: key, Body: dataBuffer};
                    s3.putObject(params, (err, data) => {
                        if(err) {
                            console.log(err)
                            this.status = 404
                            this.statusText = `Error uploading ${key}.` 
                            resolve()
                            return
                        }
                        console.log(`Uploaded ${amazonBucket}/${key}`);
                        const url = `${protocol}://${host}:${port}/${key}`
                        this.body = {files: [{url}]}
                        resolve()
                })
            })
        })
    } catch(error) {console.error(error)} 
})

export default router.routes()
