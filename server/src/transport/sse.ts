import type { Express, Request, Response } from 'express'
import { buildSnapshot } from '../simulation/init.js'
import { ZONES, zoneStates } from '../simulation/systems/capture.js'
import type { Ticker } from '../simulation/ticker.js'
import type { SnapshotPayload, TickPayload } from '../types.js'

export function registerSseRoute(app: Express, ticker: Ticker): void {
  app.get('/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    const snapshot: SnapshotPayload = {
      type: 'snapshot',
      units: buildSnapshot(),
      zones: zoneStates.map((z, i) => ({
        ...ZONES[i],
        team: z.team,
        progress: z.progress,
      })),
    }
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`)

    const onTick = (payload: TickPayload) => {
      if (!res.writable) {
        ticker.off('tick', onTick)
        return
      }
      res.write(`data: ${JSON.stringify(payload)}\n\n`)
    }

    ticker.on('tick', onTick)

    req.on('close', () => {
      ticker.off('tick', onTick)
    })
  })
}
