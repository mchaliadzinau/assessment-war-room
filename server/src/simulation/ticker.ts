import { EventEmitter } from 'events'
import { runMoveSystem } from './systems.js'
import { Position, StatusComp } from './world.js'
import type { TickPayload, UnitDelta, GameEvent } from '../types.js'

export const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS ?? 1000)
export const UNITS_PER_TICK = Number(process.env.UNITS_PER_TICK ?? 200)
export const UNITS_PER_TICK_JITTER = Number(process.env.UNITS_PER_TICK_JITTER ?? 150)

export function buildDeltas(dirty: Set<number>): UnitDelta[] {
  const deltas: UnitDelta[] = []
  for (const eid of dirty) {
    deltas.push({
      id: eid,
      x: Position.x[eid],
      y: Position.y[eid],
      status: StatusComp.value[eid] as UnitDelta['status'],
    })
  }
  return deltas
}

export class Ticker extends EventEmitter {
  private seq = 0
  private intervalId: ReturnType<typeof setInterval> | null = null

  start(): void {
    if (this.intervalId !== null) return
    this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL_MS)
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private tick(): void {
    try {
      const dirty = new Set<number>()
      const events: GameEvent[] = []
      const moveCount = UNITS_PER_TICK + Math.floor(Math.random() * UNITS_PER_TICK_JITTER)

      runMoveSystem(dirty, moveCount)

      const payload: TickPayload = {
        seq: this.seq++,
        ts: Date.now(),
        deltas: buildDeltas(dirty),
        events,
      }
      this.emit('tick', payload)
    } catch (err) {
      console.error('[Ticker] tick error:', err)
    }
  }
}
