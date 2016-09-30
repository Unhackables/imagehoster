import Koa from 'koa';
import uploadData from './upload-data'
import dataServer from './data-server'
import config from 'config/server-config'

const app = new Koa()

app.use(dataServer)
app.use(uploadData)

app.listen(config.port)
console.log(`Application started on port ${config.port}`)