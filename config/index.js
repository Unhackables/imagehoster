


export default {
    ws_connection_server: process.env.STEEMIT_UPLOAD_STEEMD_WEBSOCKET || 'wss://node.steem.ws',
    protocol: process.env.STEEMIT_UPLOAD_HTTP_PROTOCOL || 'http',
    host: process.env.STEEMIT_UPLOAD_HTTP_HOST || 'localhost',
    port: process.env.STEEMIT_UPLOAD_HTTP_PORT || 3234,
    amazonBucket: process.env.STEEMIT_UPLOAD_AMAZON_BUCKET || "steem-upload-manager-test",
}