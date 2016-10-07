import {Map, List} from 'immutable'

export default class RateLimit {

    /**
        duration: 60 * 60 * 1000, // 1 hour
        max: npm_package_config_network_ip_requests_per_hour
    */
    constructor(config) {
        required(config, 'duration')
        required(config, 'max')
        this.config = config
        this.hits = Map()
    }

    over(key, amount = 1) {
        const {duration, max} = this.config

        const now = Date.now()
        const expired = now - duration

        const hitList = this.hits
            // Add this event
            .update(key, List(), events => events.push({now, amount}))

            // Remove expired events
            .update(key, events => events.filter(event => event.now > expired))

            // Remove 'other' keys that no longer have any events
            .filterNot(keys => keys.isEmpty())

        let total = 0
        hitList.get(key).forEach(event => {total += event.amount})

        const over = total > max
        if(!over) this.hits = hitList
        return {over, total, max, duration}
    }
}

export const ms = {
    // month: 1000 * 60 * 60 * 24 * 29,
    week: 1000 * 60 * 60 * 24 * 7,
    day: 1000 * 60 * 60 * 24,
    hour: 1000 * 60 * 60,
    minute: 1000 * 60,
    second: 1000,
}

export const aprox = duration =>
    // duration > ms.month ? duration / ms.month + ' months' :
    duration > ms.week ? duration / ms.week + ' weeks' :
    duration > ms.day ? duration / ms.day + ' days' :
    duration > ms.hour ? duration / ms.hour + ' hours' :
    duration > ms.minute ? duration / ms.minute + ' minutes' :
    duration / ms.second + ' seconds'

function required(data, field_name) {
    if (data == null && data[field_name]) throw new Error('Missing required field: ' + field_name)
    return data
}
