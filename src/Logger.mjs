import dayjs from 'dayjs'
import { createLogger, format, transports } from 'winston'
const { combine, timestamp, printf, colorize } = format
const Logger = createLogger({
  levels: {
    silly: 10,
    verbose: 9,
    debug: 8,
    info: 7,
    notice: 6,
    warning: 5,
    error: 4,
    critical: 3,
    alert: 2,
    emergency: 1
  },
  level: process.env.LOG_LEVEL||'debug',
  transports: [
    new transports.Console({
      format: combine(
        format(info => {
          info.level = `[${info.level.toUpperCase()}]`
          return info
        })(),
        timestamp(),
        colorize(),
        printf(info => {
          const message = info.message || ''
          return message.split('\n').map(log => {
            return `${dayjs(info.timestamp).format('YYYY-MM-DD HH:mm:ss')} ${info.level} ${log}`
          }).join('\n')
        })
      )
    })
  ]
})

export default Logger