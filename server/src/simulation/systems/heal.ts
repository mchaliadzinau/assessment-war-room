import { Position, Health, TeamComp, StatusComp } from '../world.js'
import { liveEntities, UNITS_TOTAL } from '../init.js'
import { ZONES, zoneStates } from './capture.js'
import { STATUS } from '../../types.js'
import type { GameEvent } from '../../types.js'

export const HEAL_IDLE_TICKS = Math.max(1, parseInt(process.env.HEAL_IDLE_TICKS ?? '3', 10))
export const HEAL_AMOUNT     = Math.max(1, parseInt(process.env.HEAL_AMOUNT     ?? '5',  10))

const idleTickCount = new Uint16Array(UNITS_TOTAL)

export function runHealSystem(dirty: Set<number>, events: GameEvent[]): void {
  for (const eid of liveEntities) {
    if (StatusComp.value[eid] !== STATUS.IDLE) {
      idleTickCount[eid] = 0
      continue
    }

    idleTickCount[eid]++
    if (idleTickCount[eid] < HEAL_IDLE_TICKS) continue

    const team = TeamComp.id[eid]
    const px   = Position.x[eid]
    const py   = Position.y[eid]

    for (let zi = 0; zi < ZONES.length; zi++) {
      if (zoneStates[zi].team !== team) continue
      const zone = ZONES[zi]
      const dx = px - zone.cx
      const dy = py - zone.cy
      if (dx * dx + dy * dy <= zone.r * zone.r) {
        const healed = Math.min(HEAL_AMOUNT, Health.max[eid] - Health.current[eid])
        Health.current[eid] += healed
        dirty.add(eid)
        events.push({ type: 'heal', unit: eid, amount: healed })
        break
      }
    }
  }
}
