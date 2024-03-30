import axios from 'axios';
import dayjs from 'dayjs';
import fs from 'fs';
import Config from '../Config.mjs';
import Logger from '../Logger.mjs';
class Tempo {
  constructor() {
    this.BASE_URL = 'https://digital.iservices.rte-france.com'
    this.clientId = Config.TEMPO_CLIENT_ID;
    this.clientSecret = Config.TEMPO_CLIENT_SECRET;
    this.cache = null;
    try {
      if(process.env.CACHE === 'true') {
        this.cache = JSON.parse(fs.readFileSync('data/tempo_data.json','utf-8'))
      }
    } catch {}
    this.accessToken = null;
  }

  async login() {
    Logger.info("Authenticating with EDF Tempo")
    const options = {
      method: 'POST',
      baseURL: this.BASE_URL,
      url: 'token/oauth',
      auth: {
        username: this.clientId,
        password: this.clientSecret,
      },
    };
    const { data } = await axios(options);
    this.accessToken = data.access_token;
  }

  async load() {
    if (this.cache) return;
    await this.login();
    Logger.info("Loading days data from EDF Tempo")
    const options = {
      method: 'GET',
      baseURL: this.BASE_URL,
      url: 'open_api/tempo_like_supply_contract/v1/tempo_like_calendars',
      params: {
        start_date: dayjs().subtract(Config.INTERVAL+5, 'day').format('YYYY-MM-DD') + 'T00:00:00+01:00',
        end_date: dayjs().add(1, 'day').format('YYYY-MM-DD') + 'T00:00:00+01:00',
        fallback_status: 'true',
      },
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      },
    }
    const { data } = await axios(options)
    this.cache = data.tempo_like_calendars.values

    if(process.env.CACHE === 'true') {
      fs.writeFileSync('data/tempo_data.json',JSON.stringify(this.cache,null,2),'utf-8')
    }
  }

  async getDayColor(date) {
    await this.loadData();
    const hour = dayjs(date).hour();
    const day =
      hour >= 6
        ? dayjs(date).subtract(1, 'day').format('YYYY/MM/DD')
        : dayjs(date).subtract(2, 'day').format('YYYY/MM/DD');
    const dayData = this.cache.find((dayData) => {
      return dayjs(dayData.start_date).format('YYYY/MM/DD') === day;
    });
    return dayData.value;
  }

  dayColor(date) {
    const hour = dayjs(date).hour()
    const day =
      hour > 5
        ? dayjs(date).subtract(0, 'day').format('YYYY/MM/DD')
        : dayjs(date).subtract(1, 'day').format('YYYY/MM/DD')
    const dayData = this.cache.find((dayData) => {
      return dayjs(dayData.start_date).format('YYYY/MM/DD') === day
    })
    return dayData.value
  }

  colorate(data) {
    Logger.info("Tempo - Colorate days")
    for(let d of data) {
      d.mode = dayjs(d.date).hour() <= 5 || dayjs(d.date).hour() > 21 ? 'HC' : 'HP'
      d.color = this.dayColor(d.date)
    }
    return data
  }

  price(data){
    for(let d of data) {
      let price = Config[`TEMPO_PRICE_${d.color}_${d.mode}`]
      let price_standard = Config.TEMPO_PRICE_STANDARD
      let price_hc_hp = Config[`TEMPO_PRICE_STANDARD_${d.mode}`]
      d.price = price*d.value/1000
      d.price_hc_hp = price_hc_hp*d.value/1000
      d.price_standard = d.value * Config.TEMPO_PRICE_STANDARD / 1000
    }
    return data
  }

}

export default new Tempo()