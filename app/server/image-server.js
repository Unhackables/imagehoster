import RateLimit from './RateLimit'
import config from '../../config/server-config'
import s3 from './amazon-bucket'

const {amazonBucket, imagePrefix} = config

const hour = 60 * 60 * 1000
const limit = new RateLimit({ duration: hour, max: 60 * 60, verbose: false })

const router = require('koa-router')()

router.get('/images/:key', function *() {
    try {
        if (limit.byIp(this)) return;
        const {key} = this.params
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
                // Example format: 'Wed, 28 Sep 2016 21:09:36 GMT'
                this.set('Last-Modified', data.LastModified)
                this.body = data.Body.toString();
                resolve()
            })
        })
    } catch(error) {console.error(error)} 
})

export default router.routes()
