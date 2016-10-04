
import AWS from 'aws-sdk'
import config from 'config'

const {amazonBucket} = config

const s3 = new AWS.S3()
s3.createBucket({Bucket: amazonBucket})
export default s3
