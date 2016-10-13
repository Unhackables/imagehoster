import RateLimit, {ms} from './RateLimit'
import config from 'config'
import s3 from 'app/server/amazon-bucket'
import {missing, getRemoteIp, limit} from 'app/server/utils-koa'

const {amazonBucket} = config
const {downloadIpLimit} = config

const hour = 60 * 60 * 1000
const requestPerHour = new RateLimit({duration: ms.hour, max: downloadIpLimit.requestPerHour})

const router = require('koa-router')()

router.get('/:hash', function *() {
    try {
        const ip = getRemoteIp(this.req)
        if(limit(this, requestPerHour, ip, 'Downloads', 'request')) return

        if(missing(this, this.params, 'hash')) return

        const {hash} = this.params
        const key = `${hash}`

        yield new Promise(resolve => {
            const params = {Bucket: amazonBucket, Key: key};
            s3.getObject(params, (err, data) => {
                if(err) {
                    console.log(err)
                    this.status = 404
                    this.statusText = `Error fetching ${key}.` 
                    resolve()
                    return
                }
                this.set('Last-Modified', data.LastModified)
                this.body = new Buffer(data.Body.toString('binary'), 'binary')
                resolve()
            })
        })
    } catch(error) {console.error(error)} 
})

export default router.routes()
