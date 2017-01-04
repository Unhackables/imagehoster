import crypto from 'crypto'
import multihash from 'multihashes'
import base58 from 'bs58'

export const sha1 = (data, encoding) => crypto.createHash('sha1').update(data).digest(encoding)

/**
    @arg {Buffer} hash
    @arg {string} mhashType = sha1, sha2-256, ...
*/
export const mhashEncode = (hash, mhashType) => base58.encode(multihash.encode(hash, mhashType))