import dayjs from 'dayjs'
import { MSG_TYPE_AUTH_INVALID, MSG_TYPE_AUTH_OK, MSG_TYPE_AUTH_REQUIRED } from 'home-assistant-js-websocket'
import { auth } from 'home-assistant-js-websocket/dist/messages.js'
import ws from 'websocket'
import Config from '../Config.mjs'
import Logger from '../Logger.mjs'

const WS_URL = process.env.WS_URL || 'ws://supervisor/core/websocket'
const TOKEN = process.env.SUPERVISOR_TOKEN

class HomeAssistant {
  constructor() {
    this.connection = null
    this.messageId = Number(Date.now().toString().slice(9))
  }

  statId(color,mode,type,prm=true) {
    if(prm) return `linky_${color}_${mode}_${type}:${Config.LINKY_PRM}`.toLowerCase()
    return `linky_${color}_${mode}_${type}`.toLowerCase()
  }
  
  async purge() {
    await this.sendMessage({
      type: 'recorder/clear_statistics',
      statistic_ids: [
        this.statId('subscription','global','conso'),
        this.statId('subscription','global','price'),
        this.statId('standard','standard','conso'),
        this.statId('standard','standard','price'),
        this.statId('standard','hc','conso'),
        this.statId('standard','hc','price'),
        this.statId('standard','hp','conso'),
        this.statId('standard','hp','price'),
        this.statId('blue','hc','conso'),
        this.statId('blue','hc','price'),
        this.statId('blue','hp','conso'),
        this.statId('blue','hp','price'),
        this.statId('white','hc','conso'),
        this.statId('white','hc','price'),
        this.statId('white','hp','conso'),
        this.statId('white','hp','price'),
        this.statId('red','hc','conso'),
        this.statId('red','hc','price'),
        this.statId('red','hp','conso'),
        this.statId('red','hp','price')
      ]
    })
  }

  async needUpdate() {
    let state = await this.getPrevState()
    return dayjs().subtract(1,'day').format('YYYY-MM-DD') !== dayjs(state.STANDARD_STANDARD.date).format('YYYY-MM-DD')
  }

  async getPrevState() {

    const {result} = await this.sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: dayjs().subtract(365, 'days').format('YYYY-MM-DDT00:00:00.00Z'),
      end_time: dayjs().subtract(0, 'days').format('YYYY-MM-DDT00:00:00.00Z'),
      statistic_ids: [
        this.statId('subscription','global','conso'),
        this.statId('subscription','global','price'),
        this.statId('standard','standard','conso'),
        this.statId('standard','standard','price'),
        this.statId('standard','hc','conso'),
        this.statId('standard','hc','price'),
        this.statId('standard','hp','conso'),
        this.statId('standard','hp','price'),
        this.statId('blue','hc','conso'),
        this.statId('blue','hc','price'),
        this.statId('blue','hp','conso'),
        this.statId('blue','hp','price'),
        this.statId('white','hc','conso'),
        this.statId('white','hc','price'),
        this.statId('white','hp','conso'),
        this.statId('white','hp','price'),
        this.statId('red','hc','conso'),
        this.statId('red','hc','price'),
        this.statId('red','hp','conso'),
        this.statId('red','hp','price')
      ],
      period: 'hour',
    },true)
    let date = dayjs().subtract(10,'year').format('YYYY-MM-DD HH:mm:ss')
    let res = {
      'STANDARD_STANDARD':{ value:0, price:0, date },
      'STANDARD_HC':{ value:0, price:0, date },
      'STANDARD_HP':{ value:0, price:0, date },
      'BLUE_HC':{ value:0, price:0, date },
      'BLUE_HP':{ value:0, price:0, date },
      'WHITE_HC':{ value:0, price:0, date },
      'WHITE_HP':{ value:0, price:0, date },
      'RED_HC':{ value:0, price:0, date },
      'RED_HP':{ value:0, price:0, date },
      'SUBSCRIPTION_GLOBAL': { value:0, price:0, date }
    }
    for(let key in result) {
      let color = key.split('_')[1].toUpperCase()
      let mode = key.split('_')[2].toUpperCase()
      let type = key.split(':')[0].split('_')[3].toUpperCase()
      for(let d of result[key]) {
        if(type === 'CONSO') {
          res[`${color}_${mode}`].value = d.sum
        }
        if(type === 'PRICE') {
          res[`${color}_${mode}`].price = d.sum
        }
        res[`${color}_${mode}`].date = dayjs(d.start).format('YYYY-MM-DD HH:mm:ss')
      }
    }
    Logger.silly(`Previous status : ${JSON.stringify(res,null,2)}`)
    return res
  }

  async pushData(data) {
    let prevState = await this.getPrevState()
    data = data.filter(d=>{
      let prevDate = dayjs(prevState[`${d.color}_${d.mode}`].date)
      if(prevDate >= dayjs(d.date)) {
        return false
      }
      return true
    })

    if(data.length === 0) {
      Logger.info(`No new data, wait next hour for update`)
      return false
    }

    Logger.info(`Push data to HA - ${data.length} points`)

    for(let d of data) {
      let billingPrice = Config.EDF_MONTHLY_SUBSCRIPTION/dayjs(d.date).daysInMonth()/24
      prevState[`STANDARD_STANDARD`].value += d.value
      prevState[`STANDARD_STANDARD`].price += d.price_standard
      prevState[`STANDARD_${d.mode}`].value += d.value
      prevState[`STANDARD_${d.mode}`].price += d.price_hc_hp
      prevState[`${d.color}_${d.mode}`].value += d.value
      prevState[`${d.color}_${d.mode}`].price += d.price
      prevState[`SUBSCRIPTION_GLOBAL`].price += billingPrice

      // Import tempo data
      await this.sendMessage({
        type: 'recorder/import_statistics',
        metadata: {
          has_mean: false,
          has_sum: true,
          name: `${d.color} - ${d.mode} - Conso`,
          source: this.statId(d.color,d.mode,'conso',false),
          statistic_id: this.statId(d.color,d.mode,'conso'),
          unit_of_measurement: 'Wh',
        },
        stats: [{
          start: dayjs(d.date).format('YYYY-MM-DDTHH:mm:ss.00Z'),
          state: d.value,
          sum: prevState[`${d.color}_${d.mode}`].value
        }]
      });
      await this.sendMessage({
        type: 'recorder/import_statistics',
        metadata: {
          has_mean: false,
          has_sum: true,
          name: `${d.color} - ${d.mode} - Price`,
          source: this.statId(d.color,d.mode,'price',false),
          statistic_id: this.statId(d.color,d.mode,'price'),
          unit_of_measurement: 'Eur',
        },
        stats: [{
          start: dayjs(d.date).format('YYYY-MM-DDTHH:mm:ss.00Z'),
          state: d.price,
          sum: prevState[`${d.color}_${d.mode}`].price
        }]
      });

      // Import HC/HP mode
      await this.sendMessage({
        type: 'recorder/import_statistics',
        metadata: {
          has_mean: false,
          has_sum: true,
          name: `STANDARD - ${d.mode} - Conso`,
          source: this.statId('standard',d.mode,'conso',false),
          statistic_id: this.statId('standard',d.mode,'conso'),
          unit_of_measurement: 'Wh',
        },
        stats: [{
          start: dayjs(d.date).format('YYYY-MM-DDTHH:mm:ss.00Z'),
          state: d.value,
          sum: prevState[`STANDARD_${d.mode}`].value
        }]
      });
      await this.sendMessage({
        type: 'recorder/import_statistics',
        metadata: {
          has_mean: false,
          has_sum: true,
          name: `STANDARD - ${d.mode} - Price`,
          source: this.statId('standard',d.mode,'price',false),
          statistic_id: this.statId('standard',d.mode,'price'),
          unit_of_measurement: 'Eur',
        },
        stats: [{
          start: dayjs(d.date).format('YYYY-MM-DDTHH:mm:ss.00Z'),
          state: d.price_hc_hp,
          sum: prevState[`STANDARD_${d.mode}`].price
        }]
      });

      // Import standard mode
      await this.sendMessage({
        type: 'recorder/import_statistics',
        metadata: {
          has_mean: false,
          has_sum: true,
          name: `STANDARD - Conso`,
          source: this.statId('standard','standard','conso',false),
          statistic_id: this.statId('standard','standard','conso'),
          unit_of_measurement: 'Wh',
        },
        stats: [{
          start: dayjs(d.date).format('YYYY-MM-DDTHH:mm:ss.00Z'),
          state: d.value,
          sum: prevState[`STANDARD_STANDARD`].value
        }]
      });
      await this.sendMessage({
        type: 'recorder/import_statistics',
        metadata: {
          has_mean: false,
          has_sum: true,
          name: `STANDARD - Price`,
          source: this.statId('standard','standard','price',false),
          statistic_id: this.statId('standard','standard','price'),
          unit_of_measurement: 'Eur',
        },
        stats: [{
          start: dayjs(d.date).format('YYYY-MM-DDTHH:mm:ss.00Z'),
          state: d.price_standard,
          sum: prevState[`STANDARD_STANDARD`].price
        }]
      });

      // Import raw subscription price
      await this.sendMessage({
        type: 'recorder/import_statistics',
        metadata: {
          has_mean: false,
          has_sum: true,
          name: `SUBSCRIPTION - Conso`,
          source: this.statId('subscription','global','conso',false),
          statistic_id: this.statId('subscription','global','conso'),
          unit_of_measurement: 'Wh',
        },
        stats: [{
          start: dayjs(d.date).format('YYYY-MM-DDTHH:mm:ss.00Z'),
          state: 0,
          sum: 0
        }]
      });
      await this.sendMessage({
        type: 'recorder/import_statistics',
        metadata: {
          has_mean: false,
          has_sum: true,
          name: `SUBSCRIPTION - Price`,
          source: this.statId('subscription','global','price',false),
          statistic_id: this.statId('subscription','global','price'),
          unit_of_measurement: 'Eur',
        },
        stats: [{
          start: dayjs(d.date).format('YYYY-MM-DDTHH:mm:ss.00Z'),
          state: billingPrice,
          sum: prevState[`SUBSCRIPTION_GLOBAL`].price
        }]
      });
    }
    return true
  }

  async sendMessage(message,dryRunDisable=false) {
    if(!dryRunDisable && process.env.DRY_RUN === 'true') {
      return
    }
    Logger.silly(JSON.stringify(message,null,2))
    message.id = this.messageId++;
    return new Promise((resolve, reject) => {
      this.connection.once('message', (message) => {
        if (message.type === 'utf8') {
          const response = JSON.parse(message.utf8Data);
          if (response.success) {
            resolve(response)
          } else {
            reject('Home Assistant returned an error : ' + message.utf8Data)
          }
        }
      })
      this.connection.sendUTF(JSON.stringify(message))
    })
  }


  async connect() {
    return new Promise((resolve, reject) => {
      const client = new ws.client();

      client.addListener('connectFailed', function (error) {
        reject('Connection with Home Assistant failed : ' + error.toString());
      });
      client.addListener('connect', (connection) => {
        connection.on('error', (error) => {
          reject('Connection with Home Assistant returned an error : ' + error.toString());
        });

        connection.on('close', () => {
          Logger.debug('Connection with Home Assistant closed');
        });

        connection.once('message', (message) => {
          if (message.type === 'utf8' && JSON.parse(message.utf8Data).type === MSG_TYPE_AUTH_REQUIRED) {
            connection.once('message', (message) => {
              if (message.type === 'utf8') {
                const parsed = JSON.parse(message.utf8Data);
                if (parsed.type === MSG_TYPE_AUTH_INVALID) {
                  reject('Cannot authenticate with Home Assistant');
                }
                if (parsed.type === MSG_TYPE_AUTH_OK) {
                  Logger.debug('Connection with Home Assistant established');
                  this.connection = connection;
                  resolve();
                }
              }
            })

            connection.sendUTF(JSON.stringify(auth(TOKEN)))
          }
        })
      })
      client.connect(WS_URL);
    })
  }

  disconnect() {
    this.connection.close();
  }
}

export default new HomeAssistant()