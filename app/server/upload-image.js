
import AWS from 'aws-sdk'
import config from '../../config/server-config'
import {rateLimitReq} from './utils'

const {amazonBucket, imagePrefix} = config
const s3 = new AWS.S3()

const router = require('koa-router')()

const koaBody = require('koa-body')({
    multipart: true,
    formLimit: 5000 * 1024,
    formidable: {
        uploadDir: '/tmp',
    }
})

router.post('/uploadImage', koaBody, function *() {
    try {
        const {fields, files} = this.request.body
        const f = files['files[]']
        const {username} = fields
        // console.log('uploadImage', username)
        const key = 'myKey'
        yield new Promise(resolve => {
            s3.createBucket({Bucket: amazonBucket}, () => {
                const params = {Bucket: amazonBucket, Key: key, Body: 'Hello!'};
                s3.putObject(params, (err, data) => {
                    if(err) {
                        console.log(err)     
                        this.status = 404
                        this.statusText = `Error uploading ${key}.` 
                        resolve()
                        return
                    }
                    console.log(`Successfully uploaded data to ${amazonBucket}/${key}`);
                    const url = `${imagePrefix}${key}`
                    this.body = {files: [{url}]}
                    resolve()
                })
            })
        })
    } catch(error) {console.error(error)} 
})

export default router.routes()
