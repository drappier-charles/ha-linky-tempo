import fs from 'fs'
class Config {
  constructor() {
    let config = JSON.parse(fs.readFileSync('src/default.json','utf-8'))
    for(let key in config) {
      this[key] = process.env[key] || config[key]
    }
  }
}

export default new Config()