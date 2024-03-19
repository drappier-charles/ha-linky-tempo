import dayjs from 'dayjs'
import HomeAssistant from '../services/HomeAssistant.mjs'

export default async (query) => {
  await HomeAssistant.connect()
  let start = query.start ? dayjs(query.start).startOf('day') : dayjs().add(-2,'day').startOf('day')
  let defaultScale = 'hour'
  let end = query.end ? dayjs(query.end).endOf('day') : dayjs(start.format('YYYY-MM-DD')).add(1,'day')
  if(end-start >= 1000 * 60 * 60 * 100) defaultScale = 'day'
  let scale = query.scale || defaultScale
  if(scale != 'hour') end = end.subtract(1,'day')
  let data = await HomeAssistant.getData(start,end,scale)
  let tempo = await HomeAssistant.getTempo()
  const colorMap = {
    blue: {
      hc: '#74b9ff',
      hp: '#0984e3'
    },
    white: {
      hc: '#dfe6e9',
      hp: '#b2bec3'
    },
    red: {
      hc: '#ff7675',
      hp: '#d63031'
    },
    subscription: {
      global: '#fdcb6e'
    }
  }
  const series = [{
    type: 'bar',
    colorBy: 'data',
    name: 'Consommation (en Euro)',
    stack: true,
    data: data
    .map(d=>{
      return {
        value: [d.time,d.price,d.conso],
        itemStyle: {
          color: colorMap[d.color][d.kind]
        },
        groupId: `${d.color}-${d.kind}`,
        color: d.color,
        kind: d.kind
      }
    })
    .sort((a,b)=>{
      if(a.groupId==="subscription-global" && b.groupId!=='"subscription-global"') return -1
      if(b.groupId==="subscription-global" && a.groupId!=='"subscription-global"') return 1
      if(a.groupId<b.groupId) return -1
      if(a.groupId>b.groupId) return 1
      return 0
    })
  }]

  const option = {
    series: series
  }

  const array = {
  }

  const nameMap = {
    blue: {
      hc: 'Bleu HC',
      hp: 'Bleu HP'
    },
    white: {
      hc: 'Blanche HC',
      hp: 'Blanche HP'
    },
    red: {
      hc: 'Rouge HC',
      hp: 'Rouge HP'
    },
    subscription: {
      global: 'Sub.'
    }
  }

  for(let d of data) {
    let id = `${d.color} ${d.kind}`
    array[id] = array[id] || {
      id: id,
      name: nameMap[d.color][d.kind],
      conso: 0,
      price: 0,
      color: colorMap[d.color][d.kind],
      colorHtml: `<span class="colorBuble" style="background: ${colorMap[d.color][d.kind]};"></span>`
    }
    array[id].conso += d.conso/1000
    array[id].price += d.price
    // array.subscription.price += d.subscription
  }

  await HomeAssistant.disconnect()
  return {
    tempo,
    start:start.format(),
    end:end.format(),
    // data,
    array: Object.values(array),
    option
  }
}