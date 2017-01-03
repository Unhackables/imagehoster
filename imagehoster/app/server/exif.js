/**
    remove: GPS Information, Camera Info, etc..
    <code>
        var f = fs.readFileSync('exif.jpg')
        fs.writeFileSync('exifclean.jpg', remove(f))
    </code>

    @arg {Buffer} imageArrayBuffer image/jpeg
    @return {Buffer} image/jpeg
*/
function remove(imageArrayBuffer) {
    if(!Buffer.isBuffer(imageArrayBuffer))
        throw new TypeError('Expecting Buffer for parameter: imageArrayBuffer')

    if(!imageArrayBuffer.buffer)
        throw new TypeError('Expecting Buffer to contain ArrayBuffer property: imageArrayBuffer.buffer (check node version)')
    
    // forked from: https://github.com/mshibl/Exif-Stripper/blob/master/exif-stripper.js
    const pieces = [];
    const dv = new DataView(imageArrayBuffer.buffer);
    let offset = 0, recess = 0;
    let i = 0;

    // jpeg magic bytes 0xffd8
    if (dv.getUint16(offset) == 0xffd8){
        offset += 2;
        let app1 = dv.getUint16(offset);
        offset += 2;
        while (offset < dv.byteLength){
            if (app1 == 0xffe1){
                pieces[i] = {recess: recess, offset: offset -  2};
                recess = offset + dv.getUint16(offset);
                i++;
            }
            else if (app1 == 0xffda){
                break;
            }
            offset += dv.getUint16(offset);
            app1 = dv.getUint16(offset);
            offset += 2;
        }
        if (pieces.length > 0){
            const newPieces = [];
            pieces.forEach(function(v){
                newPieces.push(imageArrayBuffer.slice(v.recess, v.offset));
            }, this);
            newPieces.push(imageArrayBuffer.slice(recess));
            return Buffer.concat(newPieces)
        }
    }
}

module.exports = {remove}