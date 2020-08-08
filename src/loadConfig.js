import envConfig from "../config";
const loadConfig = () => {
    for (let k in envConfig) {
        process.env[k] = envConfig[k]
    }
}

export default loadConfig
