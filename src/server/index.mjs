import Logger from '../Logger.mjs'
import express from 'express'
import data from './data.mjs'
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = 1337

async function server() {
  Logger.info("Start Server")

  const app = express()
  app.set('view engine', 'pug')
  app.use(express.static(__dirname + '/public'))
  
  app.get('/', (req, res) => {
    res.render(__dirname + '/views/index')
  })

  app.get('/data',async (req,res,next) => {
    try {
      res.send(await data(req.query))
    } catch (err) {
      next(err)
    }
  })

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })

}

export default server