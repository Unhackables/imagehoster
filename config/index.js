import AWS from 'aws-sdk'

AWS.config.accessKeyId = process.env.STEEMIT_UPLOAD_AWS_KEY_ID
AWS.config.secretAccessKey = process.env.STEEMIT_UPLOAD_AWS_SECRET_KEY

export default {
    ws_connection_server: process.env.STEEMIT_UPLOAD_STEEMD_WEBSOCKET || 'wss://node.steem.ws',
    protocol: process.env.STEEMIT_UPLOAD_HTTP_PROTOCOL || 'http',
    host: process.env.STEEMIT_UPLOAD_HTTP_HOST || 'localhost',
    port: process.env.STEEMIT_UPLOAD_HTTP_PORT || 3234,
    amazonBucket: process.env.STEEMIT_UPLOAD_AMAZON_BUCKET || "steem-upload-manager-test",
}

if(!AWS.config.accessKeyId) throw new Error('Missing STEEMIT_UPLOAD_AWS_KEY_ID')
if(!AWS.config.secretAccessKey) throw new Error('Missing STEEMIT_UPLOAD_AWS_SECRET_KEY')