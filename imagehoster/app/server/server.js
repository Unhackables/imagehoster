import Koa from 'koa';
import cors from 'koa-cors'
import healthCheck from './health-check'
import uploadData from './upload-data'
import imageProxy from './image-proxy'
import dataServer from './data-server'
import config from 'config'
import Apis from 'shared/api_client/ApiInstances'

Apis.instance().init()

const app = new Koa()

app.use(cors())
app.use(healthCheck)
app.use(dataServer)
app.use(uploadData)
app.use(imageProxy)

app.listen(config.port)
console.log(`Application started on port ${config.port}`)
