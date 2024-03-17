
async function main() {
  
  let {data} = await axios('data')
  
  var chart = echarts.init(document.getElementById('main'))

  let option = {
    ...data.option,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params) => {
        return `
          <b>${dayjs(params[0].value[0]).format('HH:mm')}</b>
          <br>
          <b>Sub</b> : ${params[0].value[1].toFixed(4)}
          <br>
          <b>Conso</b>: ${params[1].value[1].toFixed(4)}
          <br>
          <b>Total</b>: ${(params[0].value[1]+params[1].value[1]).toFixed(4)}
        `
      }
    },
    xAxis: {
      type: 'time',
    },
    yAxis: {
      type: 'value'
    }
  }
  

  chart.setOption(option)
  
}

main().catch(err=>console.error(err))