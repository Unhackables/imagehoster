## Configure

> cp ./config/env_example.sh env_prod.sh

See also: `./config/index.js`

## Example upload

#### Start the server
> export STEEMIT_UPLOAD_TEST_KEY=true
> npm start

#### Download the test image

> curl -v http://localhost:3234/image/a190c0596a37398427e51bcbee7c94f1007075629828d62005735c6c2d2ffeef > $HOME/Pictures/blue_red_pill.jpg

#### Upload again (user `steem` signed using a test key)

> curl -v -F "data=@$HOME/Pictures/blue_red_pill.jpg" http://localhost:3234/image/steem/205d8bcafb9e0e0897e2db330aa2bd1ca4f7764ad9b1ba04a2a9651453aee72f4a685bd631ad60111f8018fd65d3fc7e951c0039476c270e859bb6760836dcb40d

## Create a signature

```
import {PrivateKey, Signature} from 'shared/ecc'

const bufSha = new Buffer('a190c0596a37398427e51bcbee7c94f1007075629828d62005735c6c2d2ffeef', 'hex')
const d = PrivateKey.fromSeed('')
const sig = Signature.signBufferSha256(bufSha, d)
console.log('Signature', sig.toHex())
```
Outputs 205d8bcafb9e0e0897e2db330aa2bd1ca4f7764ad9b1ba04a2a9651453aee72f4a685bd631ad60111f8018fd65d3fc7e951c0039476c270e859bb6760836dcb40d
