
import AWS from 'aws-sdk'
import config from '../../config/server-config'
import {rateLimitReq} from './utils'
import fs from 'fs'
import {hash} from 'shared/ecc'

const {amazonBucket, dataUrlPrefix} = config
const s3 = new AWS.S3()

const router = require('koa-router')()

const koaBody = require('koa-body')({
    multipart: true,
    formLimit: 20 * 1000 * 1024,
    // formidable: { uploadDir: '/tmp', }
})

router.post('/upload', koaBody, function *() {
    try {
        const {fields, files} = this.request.body
        const {username} = fields

        if(missing(this, files, 'data')) return
        if(missing(this, fields, 'username')) return

        // console.log('files', files)
        // console.log('fields', fields)

        // Question: How can I keep a multipart file in memory?
        // https://github.com/dlau/koa-body/issues/40
        yield new Promise(resolve => {
            fs.readFile(files.data.path, 'binary', (err, data) => {
                if(err) return console.error(err)
                fs.unlink(files.data.path)
                const dataBuffer = new Buffer(data, 'binary')
                const key = hash.sha256(dataBuffer, 'hex')
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
                        const url = `${dataUrlPrefix}${key}`
                        this.body = {files: [{url}]}
                        resolve()
                })
            })
        })


    } catch(error) {console.error(error)} 
})

export default router.routes()

function missing(ctx, fields, name) {
    if(!fields[name]) {
        this.status = 404
        this.statusText = `Required field: ${name}`
        return true
    }
}
