const ExifImage = require('exif').ExifImage;

export function* exif(buffer) {
    return new Promise((resolve, reject) => {
        try {
            const exifImage = new ExifImage()
            exifImage.loadImage(buffer, function (error, data) {
                if (error) {
                    if(error.code === 'NO_EXIF_SEGMENT') {
                        resolve(null)
                    } else {
                        reject(error)
                    }
                } else {
                    resolve(data)
                }
            });
        } catch (error) {
            reject(error)
        }
    })
}

export const hasOrientation = (d = {}) => d && d.image && d.image.Orientation != null
export const hasLocation = (d = {}) => d && d.gps && Object.keys(d.gps).find(key => /Latitude|Longitude|Altitude/i.test(key)) != null