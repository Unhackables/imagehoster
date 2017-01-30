var ExifImage = require('exif').ExifImage;

export function* exif(buffer) {
    return new Promise((resolve, reject) => {
        try {
            const exif = new ExifImage()
            exif.loadImage(buffer, function (error, data) {
                if (error) {
                    // console.log('Error: '+error.message);
                    reject(error)
                } else {
                    resolve(data)
                }
            });
        } catch (error) {
            // console.log('Error: ' + error.message);
            reject(error)
        }
    })
}

export const hasOrientation = ({image: {Orientation}}) => Orientation != null
export const hasLocation = ({gps}) => Object.keys(gps).find(key => /Latitude|Longitude|Altitude/i.test(key)) != null