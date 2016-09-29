const config = {}
export default config
Object.assign(config, require(process.env.NODE_ENV === 'production' ? './server-config-prod.json' : './server-config-dev.json'))
