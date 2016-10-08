import AWS from 'aws-sdk'

const toBoolean = s => s == null || s.trim() === '' ? false : JSON.parse(s)

AWS.config.accessKeyId = process.env.STEEMIT_UPLOAD_AWS_KEY_ID
AWS.config.secretAccessKey = process.env.STEEMIT_UPLOAD_AWS_SECRET_KEY

const config = {
    ws_connection_server: process.env.STEEMIT_UPLOAD_STEEMD_WEBSOCKET || 'wss://node.steem.ws',
    protocol: process.env.STEEMIT_UPLOAD_HTTP_PROTOCOL || 'http',
    host: process.env.STEEMIT_UPLOAD_HTTP_HOST || 'localhost',
    port: process.env.STEEMIT_UPLOAD_HTTP_PORT || 3234,
    amazonBucket: process.env.STEEMIT_UPLOAD_AMAZON_BUCKET || "steem-upload-manager-test",
    testKey: toBoolean(process.env.STEEMIT_UPLOAD_TEST_KEY),
    uploadIpLimit: {
        minRep: parseFloat(process.env.STEEMIT_UPLOAD_MIN_REP || 10),
        requestPerMinute: parseFloat(process.env.STEEMIT_UPLOAD_REQ_PER_MINUTE || 60),
        requestPerHour: parseFloat(process.env.STEEMIT_UPLOAD_REQ_PER_HOUR || 70),
        requestPerDay: parseFloat(process.env.STEEMIT_UPLOAD_REQ_PER_DAY || 80),
    },
    uploadDataLimit: {
        megsPerMinute: parseFloat(process.env.STEEMIT_UPLOAD_MEGS_PER_MINUTE || 200),
        megsPerHour: parseFloat(process.env.STEEMIT_UPLOAD_MEGS_PER_HOUR || 200),
        megsPerDay: parseFloat(process.env.STEEMIT_UPLOAD_MEGS_PER_DAY || 300),
        megsPerWeek: parseFloat(process.env.STEEMIT_UPLOAD_MEGS_PER_WEEK || 300),
    },
    downloadIpLimit: {
        requestPerHour: parseFloat(process.env.STEEMIT_DOWNLOAD_REQ_PER_HOUR || 3600),
    },

}
if(!AWS.config.accessKeyId) throw new Error('Missing STEEMIT_UPLOAD_AWS_KEY_ID')
if(!AWS.config.secretAccessKey) throw new Error('Missing STEEMIT_UPLOAD_AWS_SECRET_KEY')

if(config.testKey) {
    if(process.env.NODE_ENV === 'production') {
        throw new Error('ERROR test key provided, do not use in production.');
    }
    console.log('WARNING test key provided, do not use in production.');
}

export default config