#### Configure

> cp ./config/env_example.sh env_prod.sh

See also: `./config/index.js`

#### Example upload

> curl -v -F "data=@$HOME/Pictures/blue_red_pill.jpg" http://localhost:3234/image

Use the hash from above and verify:

> curl -v http://localhost:3234/image/a190c0596a37398427e51bcbee7c94f1007075629828d62005735c6c2d2ffeef|sha256sum
