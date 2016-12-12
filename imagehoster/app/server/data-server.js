import config from 'config'
import s3 from 'app/server/amazon-bucket'
import {missing, getRemoteIp, limit} from 'app/server/utils-koa'

const {amazonBucket} = config
const {downloadIpLimit} = config

const router = require('koa-router')()

router.get('/:hash/:filename?', function *() {
    try {
        const ip = getRemoteIp(this.req)
        if(yield limit(this, 'downloadIp', ip, 'Downloads', 'request')) return

        if(missing(this, this.params, 'hash')) return

        const {hash} = this.params
        const key = `${hash}`

        const params = {Bucket: amazonBucket, Key: key, Expires: 60};
        const url = s3.getSignedUrl('getObject', params);
        // console.log("get URL is", url);
        this.redirect(url)
        
        // yield new Promise(resolve => {
        //     const params = {Bucket: amazonBucket, Key: key};
        //     s3.getObject(params, (err, data) => {
        //         if(err) {
        //             console.log(err)
        //             this.status = 400
        //             this.statusText = `Error fetching ${key}.` 
        //             resolve()
        //             return
        //         }
        //         this.set('Last-Modified', data.LastModified)
        //         this.body = new Buffer(data.Body.toString('binary'), 'binary')
        //         resolve()
        //     })
        // })
    } catch(error) {console.error(error)} 
})

export default router.routes()
