import {Map, List} from 'immutable'

const INFO_LOG = true

export default class RateLimit {

    /**
        @arg {object} config
        @arg {number} config.duration milliseconds (60 * 60 * 1000 === 1 hour)
        @arg {number} config.max available within duration (compared with sum(amount)) 
    */
    constructor(config) {
        required(config, 'duration')
        required(config, 'max')
        this.config = config
        this.hits = Map()
        this.garbageCollection()
    }

    garbageCollection() {
        // Global cleanup
        const {duration} = this.config
        setTimeout(() => {
            const exp = Date.now() - duration
            this.hits.forEach((value, key) => {
                this.hits = this.hits
                    // Remove expired events
                    .update(key, events => events.filter(event => event.time > exp))
            })
            // Remove keys that no longer have any events
            this.hits = this.hits.filterNot(events => events.isEmpty())
            // console.log('Rate limit garbage collection', JSON.stringify(this.hits.toJS(), null, 0))
            this.garbageCollection()
        }, 10 * ms.minute)
    }

    /**
        @typedef {Object} OverResult
        @property {boolean} over quota
        @property {number} total non-expired quote used
        @property {number} max max quota available
        @property {number} duration quota window in milliseconds (probably divides to: N min, N hours, N weeks, etc)
        @property {string} desc describing the quota and if within or exceeded, or <b>null</b> if this.over(description) was not provided.  
     */
    /**
        @arg {string} key - limit per key.  A value like: George (username), 127.0.0.1 (ip address), etc..
        @arg {number} [amount = 1] - Amount to increment quota.  Only increments if still within quota.
        @arg {string} [description] - What is being limited? 'Uploads', 'Upload size' (use capital)
        @arg {string} [unitLabel] - A label for the amount value (requests, megabytes)
        @return {OverResult}
    */
    over(key, amount = 1, description, unitLabel) {
        const {duration, max} = this.config

        const time = Date.now()
        const expired = time - duration

        const hitList = this.hits
            // Add this event
            .update(key, List(), events => events.push({time, amount}))

            // Remove expired events
            .update(key, events => events.filter(event => event.time > expired))

        let total = 0
        hitList.get(key).forEach(event => {total += event.amount})

        const over = total > max

        // Update quote for this request
        if(!over) this.hits = hitList

        if(over || INFO_LOG) {
            console.log('Rate limited', `'${key}':`, description,
                over ? 'exceeded:' : 'are within:',
                `${total} of ${max} ${unitLabel} per ${aprox(duration)}`
            )
        }

        let desc = null
        if(description) {
            if(over)
                desc = `${description} can not exceeded ${max}${unitLabel ? ` ${unitLabel}` : ''} within ${aprox(duration)}`
            else
                desc = `${description} is within ${max}${unitLabel ? ` ${unitLabel}` : ''} within ${aprox(duration)}`
        }
        return {over, total, max, duration, desc}
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

// For simplicity, uses plural form: '60 seconds' instead of '1 minute'
const aprox = duration =>
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
