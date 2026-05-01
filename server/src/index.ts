import express from 'express'
import cors from 'cors'
import { initUnits } from './simulation/init.js'
import { Ticker } from './simulation/ticker.js'
import { registerSseRoute } from './transport/sse.js'
import { registerApiRoutes } from './api/routes.js'

const app = express()
app.use(cors())
app.use(express.json())

initUnits()

const ticker = new Ticker()
registerSseRoute(app, ticker)
registerApiRoutes(app)

app.listen(3001, () => console.log('Server ready on :3001'))
ticker.start()
