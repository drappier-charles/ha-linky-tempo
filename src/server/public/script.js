let startDate = moment().subtract(1, 'days')
let endDate = moment().subtract(1, 'days')

async function pieChart(data) {
  var chart = echarts.init(document.getElementById('pie-chart'),'test')
  console.log(data)
  var option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgb(48, 52, 70)',
      textStyle: {
        color:'white',
      } ,
      borderWidth: 0
    },
    labels: {
      show: false
    },
    series: [
      {
        type: 'pie',
        center: ['50%', '45%'],

        radius: ['60%', '80%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#ddd',
          borderWidth: 1
        },
        label: {
          show: false,
          position: 'center'
        },
        data: data.array.map(d=>{
          return {
            itemStyle: {
              color: d.color,
            },
            value: d.price.toFixed(2),
            name: d.name
          }
        })
      }
    ]
  };
  chart.setOption(option)
}

async function chart(data) {
  var chart = echarts.init(document.getElementById('chart'),'test')

  let option = {
    ...data.option,
    tooltip: {
      trigger: 'axis',
      textStyle: {
        color: '#5d6f80'
      },
      html: true,
      borderColor: '#eee',
      borderWidth: '0',
      borderPadding: 0,
      backgroundColor: 'rgb(48, 52, 70)',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params) => {
        return `
          <div class="tooltip">
            <div style="font-size 15px;">
              ${dayjs(params[0].value[0]).format('DD/MM/YYYY HH')}h
              :
              ${(params[0].value[2]+params[1].value[2]).toFixed(0)} Wh
            </div>
            <div>
              <span class="color" style="background-color:${params[0].value[3]};"></span>
              <span class="price">${(params[1].value[1]).toFixed(2)} €</span>
            </div>
            <div>
              <span class="color" style="background-color:#fdcb6e;"></span>
              <span class="price">${(params[0].value[1]).toFixed(2)} €</span>
            </div>
          </div>
        `
      }
    },
    xAxis: { 
      splitLine: {
         show: false
      },
      type: 'time',
    },
    yAxis: { 
      splitLine: {
         show: false
      },
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
        field:"colorHtml",
        width:50,
        formatter: 'html'
      },
      {
        title:"",
        field:"name"
      },
      {
        title:"Kwh",
        field:"conso",
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
          symbol:" KWh",
          symbolAfter:"p",
          negativeSign:false,
          precision:2,
        },
        bottomCalcFormatter:"money",
        bottomCalcFormatterParams:{
          decimal:",",
          thousand:".",
          symbolAfter:"p",
          symbol:" KWh",
          negativeSign:false,
          precision:2,
        },
      },
      {
        title:"Prix",
        hozAlign:"right",
        headerHozAlign:"right",
        field:"price",
        formatter:"money",
        formatterParams:{
          decimal:",",
          thousand:".",
          symbol:" €",
          symbolAfter:"p",
          negativeSign:false,
          precision:2,
        },
        bottomCalcFormatter:"money",
        bottomCalcFormatterParams:{
          decimal:",",
          thousand:".",
          symbolAfter:"p",
          symbol:" €",
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
  await pieChart(data)
}

resetDatepicker()
main().catch(err=>console.error(err))

let datepicker = null

function resetDatepicker() {
  $(function() {
    datepicker = $('input[name="daterange"]').daterangepicker({
      opens: 'left',
      startDate: startDate,
      endDate: endDate,
      "locale": {
        format: "DD/MM/YYYY",
      },
      ranges: {
        'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
        '2 days ago': [moment().subtract(2, 'days'), moment().subtract(2, 'days')],
        '3 days ago': [moment().subtract(3, 'days'), moment().subtract(3, 'days')],
        'Last 3 Days': [moment().subtract(3, 'days'), moment().subtract(1,'days')],
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
}

function prev() {
  startDate.subtract(1,'days')
  endDate.subtract(1,'days')
  resetDatepicker()
  main().catch(err=>console.error(err))
}
async function next() {
  if(endDate.format("YYYY-MM-DD") === moment().subtract(1,'days').format('YYYY-MM-DD')) return
  startDate.add(1,'days')
  endDate.add(1,'days')
  resetDatepicker()
  main().catch(err=>console.error(err))
}