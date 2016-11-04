import TarantoolConnection from 'tarantool-driver';
import config from 'config'

const {host, port, username, password} = config.tarantool

let conn
let ready_promise

// Wrap Tarantool's methods with connection reseting code
export default {
    call: (...args) => reset(init().then(t => t.call(...args)))
}

const reset = p => p.catch(error => {
    console.error('Tarantool error', error.message)
    if(error.message.indexOf('connect') >= 0) conn = null
    throw error
})

function init() {
    if(conn) return ready_promise
    conn = new TarantoolConnection({host, port})
    return ready_promise = new Promise(resolve => {
        resolve(
            conn.connect()
            .then(() => conn.auth(username, password))
            .then(() => conn)
        )
    })
}
