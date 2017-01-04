import AWS from 'aws-sdk'

const toBoolean = s => s == null || s.trim() === '' ? false : JSON.parse(s)

// const {NODE_ENV = 'development'} = process.env

const config = {
    ws_connection_server: process.env.STEEMIT_UPLOAD_STEEMD_WEBSOCKET || 'wss://node.steem.ws',
    protocol: process.env.STEEMIT_UPLOAD_HTTP_PROTOCOL || 'http',
    host: process.env.STEEMIT_UPLOAD_HTTP_HOST || 'localhost',
    port: process.env.STEEMIT_UPLOAD_HTTP_PORT || 3234,
    tarantool: {
        host: process.env.STEEMIT_TARANTOOL_HOST || 'localhost',
        port: process.env.STEEMIT_TARANTOOL_PORT || 3401,
        username: process.env.STEEMIT_TARANTOOL_USERNAME || 'guest',
        password: process.env.STEEMIT_TARANTOOL_PASSWORD || '',
    },
    testKey: toBoolean(process.env.STEEMIT_UPLOAD_TEST_KEY),
    uploadIpLimit: {
        minRep: parseFloat(process.env.STEEMIT_UPLOAD_MIN_REP || 10),
    },
    
    uploadBucket: 'steemit-imageproxy-upload',
    webBucket: 'steemit-imageproxy-web',
    thumbnailBucket: 'steemit-imageproxy-thumbnail',
}

if(process.env['STEEMIT_IMAGEPROXY_AWS_KEY_ID']) {
    AWS.config.accessKeyId = process.env['STEEMIT_IMAGEPROXY_AWS_KEY_ID']
}

if(process.env['STEEMIT_IMAGEPROXY_AWS_SECRET_KEY']) {
    AWS.config.secretAccessKey = process.env['STEEMIT_IMAGEPROXY_AWS_SECRET_KEY']
}

if(config.testKey) {
    if(process.env.NODE_ENV === 'production') {
        throw new Error('ERROR test key provided, do not use in production.');
    }
    console.log('WARNING test key provided, do not use in production.');
}

export default config