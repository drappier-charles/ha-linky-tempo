import nodeCron from 'node-cron'
import Config from '../Config.mjs'
import Logger from '../Logger.mjs'
import HomeAssistant from '../services/HomeAssistant.mjs'
import Linky from '../services/Linky.mjs'
import Tempo from '../services/Tempo.mjs'

async function cron() {
  Logger.info("Start Cron")
  await HomeAssistant.connect()
  if(Config.PURGE === 'true') {
    Logger.info("Purge all data")
    await HomeAssistant.purge()
    await HomeAssistant.disconnect()
    
  } else {
    await sync()
  
    await setupCron()
    await HomeAssistant.disconnect()
  }
}

async function setupCron() {

  Logger.info(
    `Data synchronization planned for ${Config.CRON_CONFIG}`
  );

  nodeCron.schedule(Config.CRON_CONFIG, async () => {
    await sync()
  })
}

async function sync() {
  Logger.info("Sync data")
  await HomeAssistant.connect()
  if(!await HomeAssistant.needUpdate()) {
    return Logger.info("No update to do, already done today")
  }

  await Tempo.load()
  await Linky.load()

  let coloredData = Tempo.colorate(Linky.data)
  let pricedData = Tempo.price(coloredData)

  let pushed = await HomeAssistant.pushData(pricedData)
  
  await HomeAssistant.disconnect()
  return pushed
}

export default cron