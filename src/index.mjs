import cron from 'node-cron'
import Config from './Config.mjs'
import HomeAssistant from './HomeAssistant.mjs'
import Linky from './Linky.mjs'
import Logger from './Logger.mjs'
import Tempo from './Tempo.mjs'

let done = {}

async function main() {
  Logger.info("Start")

  await HomeAssistant.connect()
  if(Config.PURGE === 'true') {
    Logger.info("Purge all data")
    await HomeAssistant.purge()
    await HomeAssistant.disconnect()
    
  } else {
    let res = await sync()
    if(res) done[dayjs.format('YYYY-MM-DD')] = true
  
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
    if(done[dayjs.format('YYYY-MM-DD')]) return
    let res = await sync()
    if(res) done[dayjs.format('YYYY-MM-DD')] = true
  })
}

async function sync() {
  Logger.info("Sync data")
  await HomeAssistant.connect()

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