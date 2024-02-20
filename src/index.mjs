import cron from 'node-cron'
import Config from './Config.mjs'
import HomeAssistant from './HomeAssistant.mjs'
import Linky from './Linky.mjs'
import Logger from './Logger.mjs'
import Tempo from './Tempo.mjs'

async function main() {
  Logger.info("Start")

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
  const randomMinute = Math.floor(Math.random() * 59)
  const randomSecond = Math.floor(Math.random() * 59)

  Logger.info(
    `Data synchronization planned every hours at ${randomMinute}:${randomSecond}`
  );

  cron.schedule(`${randomSecond} ${randomMinute} * * * *`, async () => {
    await sync()
  })
}

async function sync() {
  Logger.info("Sync data")
  await HomeAssistant.connect()

  await Tempo.load()
  await Linky.load()

  let coloredData = Tempo.colorate(Linky.data)
  let pricedData = Tempo.price(coloredData)

  await HomeAssistant.pushData(pricedData)
  
  await HomeAssistant.disconnect()
}

main().catch(err=>{
  Logger.error(err.stack||err.message||err)
})