import { Position, Health, TeamComp, StatusComp } from './world.js'
import { liveEntities } from './init.js'
import { ZONES, zoneStates } from './capture.js'
import { STATUS } from '../types.js'

export const HEAL_IDLE_TICKS = Math.max(1, parseInt(process.env.HEAL_IDLE_TICKS ?? '3', 10))
export const HEAL_AMOUNT     = Math.max(1, parseInt(process.env.HEAL_AMOUNT     ?? '5',  10))

const idleTickCount = new Uint16Array(20_000)

export function runHealSystem(dirty: Set<number>): void {
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
        Health.current[eid] = Math.min(Health.current[eid] + HEAL_AMOUNT, Health.max[eid])
        dirty.add(eid)
        break
      }
    }
  }
}
