import Koa from 'koa';
import uploadImage from './upload-image'
import imageServer from './image-server'
import config from '../../config/server-config'

const app = new Koa()

app.use(imageServer)
app.use(uploadImage)

app.listen(config.port)
console.log(`Application started on port ${config.port}`)