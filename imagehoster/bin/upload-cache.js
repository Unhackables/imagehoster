
/**
    Upload files from the disk-based imageproxy into the imagehoster Amazon buckets.

    node bin/upload-cache.js ../../imageproxy/cache
*/

// config
const cacheDir = process.argv[2] || '../../imageproxy/cache'

const AWS = require('aws-sdk')
if(process.env['STEEMIT_IMAGEPROXY_AWS_KEY_ID']) {
    AWS.config.accessKeyId = process.env['STEEMIT_IMAGEPROXY_AWS_KEY_ID']
}
if(process.env['STEEMIT_IMAGEPROXY_AWS_SECRET_KEY']) {
    AWS.config.secretAccessKey = process.env['STEEMIT_IMAGEPROXY_AWS_SECRET_KEY']
}

const webBucket = process.env.STEEMIT_IMAGEPROXY_BUCKET_WEB || 'steemit-dev-imageproxy-web'
const thumbnailBucket = process.env.STEEMIT_IMAGEPROXY_BUCKET_THUMBNAIL || 'steemit-dev-imageproxy-thumbnail'

// program ..

const s3 = new AWS.S3()
const fs = require('fs')
const dimRe = /\d+x\d+/

const multihash = require('multihashes')
const base58 = require('bs58')
const fileType = require('file-type')

let rerun = true

function* upload() {
    const cacheFiles = fs.readdirSync(cacheDir)
    for(const fname of cacheFiles) {
        // deda3dca887a2048a7cc4818ffeb5e69936f0744_100x100.bin
        // deda3dca887a2048a7cc4818ffeb5e69936f0744_500x500.bin
        // deda3dca887a2048a7cc4818ffeb5e69936f0744.bin
        // deda3dca887a2048a7cc4818ffeb5e69936f0744.json
        // deda3dca887a2048a7cc4818ffeb5e69936f0744.url
        try {
            if(fname.length < 38) continue

            const [name, ext] = fname.split('.')
            if(ext !== 'bin') continue

            const sha1hex = name.substring(0, 40)
            const dimension = dimRe.test(name) && name.match(dimRe)[0]
            
            const Key = 'U' +
                mhashEncode(new Buffer(sha1hex, 'hex'), 'sha1') +
                (dimension ? '_' + dimension : '')

            const Bucket = dimension ? thumbnailBucket : webBucket
            const imageKey = {Key, Bucket}

            if(rerun) {
                // skip when exists (only if they sequentially exist)
                rerun = !!(yield s3call('headObject', imageKey))
                if(rerun) {
                    console.log('upload-cache -> already uploaded', JSON.stringify(imageKey, null, 0))
                    continue
                }
            }

            console.log('upload-cache ->', JSON.stringify(imageKey, null, 0))

            const Body = fs.readFileSync(cacheDir + '/' + fname)
            const ftype = fileType(Body)
            let ContentType
            if(ftype) {
                ContentType = ftype.mime
            } else {
                const fn = cacheDir + '/' + sha1hex + '.json'
                const data = fs.readFileSync(fn)
                const ct = data && JSON.parse(data)['content-type']
                console.log('Warning, Skipping unknown ContentType (via majic bytes), json metadata:', fn, ct);
                continue
            }
            yield s3call('putObject', Object.assign({}, imageKey, {Body, ContentType}))
            yield waitFor('objectExists', imageKey)
        } catch(error) {
            console.error('Error processing ' + fname);
            console.error(error);
        }
    }
}

function s3call(method, params) {
    return new Promise((resolve, reject) => {
        s3[method](params, function(err, data) {
            if(err && (err.code === 'NotFound' || err.code === 'NoSuchKey')) {
                resolve(null)
            } else if (err) {
                console.error(method, params, err)
                reject(err)
            }
            else resolve(data);
        });
    })
}

const mhashEncode = (hash, mhashType) => base58.encode(multihash.encode(hash, mhashType))
const call = gen => {let ret; do { ret = gen.next() } while(!ret.done)}
call(upload())

