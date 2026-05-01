import { addEntity, addComponent } from 'bitecs'
import { world, Position, StatusComp } from './world.js'
import { STATUS, TEAM } from '../types.js'
import type { UnitSnapshot } from '../types.js'

export const liveEntities: number[] = []
let initialised = false

export function initUnits(): void {
  if (initialised) throw new Error('initUnits already called')
  initialised = true

  for (let i = 0; i < 20_000; i++) {
    const eid = addEntity(world)
    addComponent(world, Position, eid)
    addComponent(world, StatusComp, eid)

    Position.x[eid] = Math.random() * 2000
    Position.y[eid] = Math.random() * 2000
    StatusComp.value[eid] = STATUS.IDLE

    liveEntities.push(eid)
  }
}

export function buildSnapshot(): UnitSnapshot[] {
  const result: UnitSnapshot[] = []
  for (const eid of liveEntities) {
    result.push({
      id: eid,
      x: Position.x[eid],
      y: Position.y[eid],
      hp: 0,
      maxHp: 100,
      status: StatusComp.value[eid] as UnitSnapshot['status'],
      team: TEAM['A'],
      name: new Date().toISOString(),
    })
  }
  return result
}
