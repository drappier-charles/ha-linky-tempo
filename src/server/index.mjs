import Logger from '../Logger.mjs'
import express from 'express'

const app = express()
const port = 1337

async function server() {
  Logger.info("Start Server")
  
  app.get('/', (req, res) => {
    res.send('Hello World!')
  })

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })

}

export default server