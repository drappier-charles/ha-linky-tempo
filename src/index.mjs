import Logger from './Logger.mjs'
import cron from './cron/index.mjs'
import server from './server/index.mjs'

async function main() {
  Logger.info("Start")

  if(process.env.DISABLE_CRON !== 'true') {
    await cron()
  }

  await server()
}

main().catch(err=>{
  Logger.error(err.stack||err.message||err)
})