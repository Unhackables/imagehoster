
const router = require('koa-router')()

router.get('/', function *() {
    this.status = 200
    this.statusText = "OK"
    this.body = {status: 200, statusText: 'OK'}
})
router.get('/healthcheck', function *() {
    this.status = 200
    this.statusText = "OK"
    this.body = {status: 200, statusText: 'OK'}
})

export default router.routes()
