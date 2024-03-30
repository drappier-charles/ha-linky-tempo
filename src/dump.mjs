import Logger from './Logger.mjs'
import HomeAssistant from './services/HomeAssistant.mjs'
import dayjs from 'dayjs'
import fs from 'fs'

async function main() {
  Logger.info("Start")
  await HomeAssistant.connect()
  let start = dayjs('2024-01-01')
  let end = dayjs()
  let data = await HomeAssistant.getData(start,end,'hour')
  // fs.writeFileSync('dump.json',JSON.stringify(data,null,2),'utf8')
  let cursor = {
    BBRHCJB: 0,
    BBRHPJB: 0,
    BBRHCJW: 0,
    BBRHPJW: 0,
    BBRHCJR: 0,
    BBRHPJR: 0
  }
  let map = {
    blue: {
      hc:'BBRHCJB',
      hp:'BBRHPJB'
    },
    white: {
      hc:'BBRHCJW',
      hp:'BBRHPJW'
    },
    red: {
      hc:'BBRHCJR',
      hp:'BBRHPJR'
    }
  }
  let dump = []
  for(let d of data) {
    let name = map[d.color][d.kind]
    cursor[name]+=d.conso
    cursor.PAPP = d.conso
    cursor.timestamp = dayjs(d.time).add(1,'hour').format('YYYY-MM-DD HH:mm:ss')
    dump.push({...cursor})
  }
  fs.writeFileSync('dump.json',JSON.stringify(dump,null,2),'utf-8')
  await HomeAssistant.disconnect()
}

main().catch(err=>{
  Logger.error(err.stack||err.message||err)
})