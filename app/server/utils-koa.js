
export function missing(ctx, fields, name, errorText = name) {
    if(!fields || !fields[name]) {
        ctx.status = 400
        ctx.statusText = `Missing: ${errorText}`
        ctx.body = {error: ctx.statusText}
        return true
    }
    return false
}

export function getRemoteIp(req) {
    const remote_address = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const ip_match = remote_address ? remote_address.match(/(\d+\.\d+\.\d+\.\d+)/) : null;
    return ip_match ? ip_match[1] : esc(remote_address);
}

function esc(value, max_length = 256) {
    if (!value) return '';
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return '(object)';
    let res = value.substring(0, max_length - max_length * 0.2).replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case '\0':
                return '\\0';
            case '\x08':
                return '\\b';
            case '\x09':
                return '\\t';
            case '\x1a':
                return '\\z';
            case '\n':
                return '\\n';
            case '\r':
                return '\\r';
            // case '\'':
            // case "'":
            // case '"':
            // case '\\':
            // case '%':
            //     return '\\' + char; // prepends a backslash to backslash, percent, and double/single quotes
        }
        return '-';
    });
    return res.length < max_length ? res : '-';
}

import tarantool from 'app/server/tarantool'

export function* limit(ctx, type, key, description, unitLabel, amount = 1) {
    // console.log('tarantool', yield tarantool())
    try {
        const [[{over, desc}]] = yield tarantool.call('limit', type, key, description, unitLabel, amount)
        console.log('res', over, desc)
        if(over) throw desc
    } catch(error) {
        console.error(error)
        if(typeof error === 'string') { 
            ctx.status = 400
            ctx.statusText = error
            ctx.body = {error: ctx.statusText}
            return true
        }
    }
    return false
}