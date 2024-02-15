import dayjs from 'dayjs';
import fs from 'fs';
import { Session } from 'linky';
import lodash from 'lodash';
import Config from './Config.mjs';
import Logger from './Logger.mjs';

class Linky {
  constructor() {
    this.session = new Session(Config.LINKY_TOKEN, Config.LINKY_PRM)
    this.session.userAgent = 'ha-linky-tempo/1.0.0';
    this.prm = Config.LINKY_PRM
    this.interval = Config.INTERVAL
    this.cache = {}
    if(process.env.CACHE === 'true') {
      let cacheFiles = fs.readdirSync('data/linky')
      for(let key of cacheFiles) {
        if(key.endsWith('.json')) {
          this.cache[key.split('.')[0]] = JSON.parse(fs.readFileSync(`data/linky/${key}`,'utf-8'))
        }
      }
    }
  }

  async load() {
    let today = process.env.MAX_DATE ? dayjs(process.env.MAX_DATE) : dayjs()

    let from = today.subtract(this.interval,'days').startOf('day')
    let to = today.startOf('day')
    Logger.info(`Loading linky data from : ${from.format('YYYY-MM-DD')} - ${to.format('YYYY-MM-DD')}`)

    let cursor = dayjs(from)
    while(cursor<to) {
      await this.subLoad(cursor,cursor.add(7,'days'))
      cursor = cursor.add(7,'days')
    }
  }

  async subLoad(from, to) {
    Logger.debug(`Loading subset linky data from : ${from.format('YYYY-MM-DD')} - ${to.format('YYYY-MM-DD')}`)
    this.cache[from.format('YYYY-MM-DD')] = this.cache[from.format('YYYY-MM-DD')] || await this.session.getLoadCurve(from.format('YYYY-MM-DD'), to.format('YYYY-MM-DD'))

    if(process.env.CACHE === 'true') {
      fs.writeFileSync(`data/linky/${from.format('YYYY-MM-DD')}.json`,JSON.stringify(this.cache[from.format('YYYY-MM-DD')],null,2),'utf-8')
    }
  }

  get data () {
    const res = []
    let byHours = {}
    for(let key in this.cache) {
      for(let d of this.cache[key].interval_reading) {
        let h = dayjs(d.date).subtract(1,'minutes').format('YYYY-MM-DD HH')
        byHours[h] = byHours[h] || []
        byHours[h].push(d)
      }
    }
    for(let h in byHours) {
      let values = byHours[h].map(d=>parseInt(d.value))
      let sum = lodash.reduce(values,(sum,n)=>sum+n)
      let value = sum/byHours[h].length
      res.push({
        date:`${h}:00:00`,
        value
      })
    }
    return res
  }

}

export default new Linky()