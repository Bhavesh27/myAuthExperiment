const envConfig = require("./config");
const loadConfig = () => {
    for (let k in envConfig) {
        process.env[k] = envConfig[k]
    }
}

module.exports = loadConfig
