let startDate = moment().subtract(1, 'days')
let endDate = moment().subtract(1, 'days')

async function chart(data) {
  var chart = echarts.init(document.getElementById('chart'),'test')

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
async function table(data) {
  new Tabulator("#table-chart", {
    data: data.array,
    layout:"fitColumns",
    rowHeight:35,
    columns:[
      {
        title:"Couleur",
        field:"color",
        width:100,
        formatter: 'color'
      },
      {
        title:"Nom",
        field:"name"
      },
      {
        title:"Consommation",
        field:"conso",
        width:200,
        hozAlign:"right",
        calcParams: {
          precision:4,
        },
        bottomCalc:"sum",
        formatter:"money",
        headerHozAlign:"right",
        formatterParams:{
          decimal:",",
          thousand:".",
          symbol:"KWh",
          symbolAfter:"p",
          negativeSign:false,
          precision:2,
        },
        bottomCalcFormatter:"money",
        bottomCalcFormatterParams:{
          decimal:",",
          thousand:".",
          symbolAfter:"p",
          symbol:"KWh",
          negativeSign:false,
          precision:2,
        },
      },
      {
        title:"Prix",
        hozAlign:"right",
        headerHozAlign:"right",
        field:"price",
        width:200,
        formatter:"money",
        formatterParams:{
          decimal:",",
          thousand:".",
          symbol:"€",
          symbolAfter:"p",
          negativeSign:false,
          precision:2,
        },
        bottomCalcFormatter:"money",
        bottomCalcFormatterParams:{
          decimal:",",
          thousand:".",
          symbolAfter:"p",
          symbol:"€",
          negativeSign:false,
          precision:2,
        },
        bottomCalc:"sum",
        bottomCalcParams:{
          precision:2,
          symbol:"€",
        }
      }
    ],
  });
}

async function load(start,end) {
  return await axios(`data?start=${start.format('YYYY-MM-DD')}&end=${moment(end).add(1,'day').format('YYYY-MM-DD')}`)
}

async function main() {
  let {data} = await load(startDate,endDate)
  await table(data)
  await chart(data)
}


main().catch(err=>console.error(err))


$(function() {
  $('input[name="daterange"]').daterangepicker({
    opens: 'left',
    startDate: startDate,
    endDate: endDate,
    "locale": {
      format: "DD/MM/YYYY",
    },
    ranges: {
      'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
      'Last 7 Days': [moment().subtract(7, 'days'), moment().subtract(1,'days')],
      'Last 30 Days': [moment().subtract(31, 'days'), moment().subtract(1,'days')],
      'This Month': [moment().startOf('month'), moment().endOf('month')],
      'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
   }
  }, async function(start, end, label) {
    startDate = start
    endDate = end
    await main()
  });
});