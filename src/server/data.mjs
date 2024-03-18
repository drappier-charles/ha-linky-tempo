import dayjs from 'dayjs'
import HomeAssistant from '../services/HomeAssistant.mjs'

export default async (query) => {
  await HomeAssistant.connect()
  let start = query.start ? dayjs(query.start).startOf('day') : dayjs().add(-2,'day').startOf('day')
  let end = query.end ? dayjs(query.end).endOf('day') : dayjs(start.format('YYYY-MM-DD')).add(1,'day')
  let data = await HomeAssistant.getData(start,end)
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
    }
  }
  const series = [{
    type: 'bar',
    colorBy: 'data',
    name: 'Abonnement (en Euro)',
    stack: true,
    data: data
    .map(d=>{
      return {
        value: [d.time,d.subscription],
        itemStyle: {
          color: '#fdcb6e'
        }
      }
    })
  },{
    type: 'bar',
    colorBy: 'data',
    name: 'Consommation (en Euro)',
    stack: true,
    data: data
    .map(d=>{
      return {
        value: [d.time,d.price],
        itemStyle: {
          color: colorMap[d.color][d.kind]
        }
      }
    })
  }]

  const option = {
    series: series
  }

  const array = {
    subscription: {
      id: 'subscription',
      name: 'Abonnement',
      conso: 0,
      price: 0,
      color: '#fdcb6e'
    }
  }

  const nameMap = {
    blue: {
      hc: 'Bleu Heure Creuse',
      hp: 'Bleu Heure Pleine'
    },
    white: {
      hc: 'Blanche Heure Creuse',
      hp: 'Blanche Heure Pleine'
    },
    red: {
      hc: 'Rouge Heure Creuse',
      hp: 'Rouge Heure Pleine'
    }
  }

  for(let d of data) {
    let id = `${d.color} ${d.kind}`
    array[id] = array[id] || {
      id: id,
      name: nameMap[d.color][d.kind],
      conso: 0,
      price: 0,
      color: colorMap[d.color][d.kind]
    }
    array[id].conso += d.conso/1000
    array[id].price += d.price
    array.subscription.price += d.subscription
  }

  await HomeAssistant.disconnect()
  return {
    start:start.format(),
    end:end.format(),
    // data,
    array: Object.values(array),
    option
  }
}