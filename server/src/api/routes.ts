import { z } from 'zod'
import type { Express, Request, Response } from 'express'
import { buildSnapshot, BATTLEFIELD_W, BATTLEFIELD_H, UNITS_TOTAL } from '../simulation/init.js'
import { ZONES, zoneStates } from '../simulation/systems/capture.js'
import { STATUS, TEAM } from '../types.js'

const STATUS_MAP: Record<string, number> = {
  idle: STATUS.IDLE, moving: STATUS.MOVING, attacking: STATUS.ATTACKING, dead: STATUS.DEAD,
}

const querySchema = z.object({
  team:     z.enum(['A', 'B']).optional(),
  status:   z.enum(['idle', 'moving', 'attacking', 'dead']).optional(),
  hpMin:    z.coerce.number().min(0).max(100).optional(),
  hpMax:    z.coerce.number().min(0).max(100).optional(),
  search:   z.string().max(50).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
})

export function registerApiRoutes(app: Express): void {
  app.get('/config', (_req: Request, res: Response) => {
    res.json({ battlefieldW: BATTLEFIELD_W, battlefieldH: BATTLEFIELD_H, unitsTotal: UNITS_TOTAL })
  })

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, uptime: process.uptime() })
  })

  app.get('/zones', (_req: Request, res: Response) => {
    const result = zoneStates.map((z, i) => ({ ...ZONES[i], team: z.team, progress: z.progress }))
    res.json(result)
  })

  app.get('/units', (req: Request, res: Response) => {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' })
    }
    const q = parsed.data

    if (q.hpMin !== undefined && q.hpMax !== undefined && q.hpMin > q.hpMax) {
      return res.status(400).json({ error: 'hpMin must be ≤ hpMax' })
    }

    let units = buildSnapshot()

    if (q.team !== undefined) {
      const teamVal = q.team === 'A' ? TEAM.A : TEAM.B
      units = units.filter(u => u.team === teamVal)
    }
    if (q.status !== undefined) {
      const statusVal = STATUS_MAP[q.status]
      units = units.filter(u => u.status === statusVal)
    }
    if (q.hpMin !== undefined) units = units.filter(u => u.hp >= (q.hpMin as number))
    if (q.hpMax !== undefined) units = units.filter(u => u.hp <= (q.hpMax as number))
    if (q.search) {
      const lower = q.search.toLowerCase()
      units = units.filter(u => u.name.toLowerCase().includes(lower))
    }

    const total = units.length
    const start = (q.page - 1) * q.pageSize
    const page  = units.slice(start, start + q.pageSize)

    return res.json({ total, page: q.page, pageSize: q.pageSize, units: page })
  })
}
