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
    `Data synchronization planned for ${randomMinute}:${randomSecond}`
  );

  

  cron.schedule(`${randomSecond} ${randomMinute} 10,11,12,13,14,15,16,17,18,19,20,21,22,23 * * *`, async () => {
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

main().catch(err=>{
  Logger.error(err.stack||err.message||err)
})