import { Map, List } from 'immutable'

export default class RateLimit {

    /**
        duration: 60 * 60 * 1000, // 1 hour
        max: npm_package_config_network_ip_requests_per_hour
    */
    constructor(config) {
        required(config.duration, 'config.duration')
        required(config.max, 'config.max')
        this.config = config
        this.hits = Map()
    }

    byIp(ctx) {
        const key = ctx.req.headers['x-forwarded-for'] || ctx.req.connection.remoteAddress;

        const event = Date.now()
        const expired = event - this.config.duration

        this.hits = this.hits

            // Add this event
            .update(key, List(), events => events.push(event))

            // Remove expired events
            .update(key, events => events.filter(e => e > expired))

            // Remove 'other' keys that no longer have any events
            .filterNot(keys => keys.isEmpty())

        if(this.config.verbose)
            console.log('RateLimit\t', key, '\t', this.hits.get(key).count(), 'of', this.config.max, 'within', (this.config.duration / 1000) + 's')

        const over = this.hits.get(key).count() > this.config.max
        if(over) {
            ctx.status = 429;
            ctx.body = 'Too Many Requests';
        }
        return over
    }

}

function required(data, field_name) {
    if (data == null) throw new Error('Missing required field: ' + field_name)
    return data
}
