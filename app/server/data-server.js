import RateLimit from './RateLimit'
import config from 'config/server-config'
import s3 from 'app/server/amazon-bucket'
import {missing} from 'app/server/utils'

const {amazonBucket} = config

const hour = 60 * 60 * 1000
const limit = new RateLimit({ duration: hour, max: 60 * 60, verbose: false })

const router = require('koa-router')()

router.get('/:type/:hash', function *() {
    try {
        if (limit.byIp(this)) return;

        if(missing(this, this.params, 'type')) return
        if(missing(this, this.params, 'hash')) return

        const {type, hash} = this.params
        const key = `${type}/${hash}`

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
