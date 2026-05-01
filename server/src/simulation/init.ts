import { addEntity, addComponent } from 'bitecs'
import { world, Position, Health, TeamComp, StatusComp, UnitMeta, UNIT_NAMES } from './world.js'
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
    addComponent(world, Health, eid)
    addComponent(world, TeamComp, eid)
    addComponent(world, StatusComp, eid)
    addComponent(world, UnitMeta, eid)

    Position.x[eid] = Math.random() * 2000
    Position.y[eid] = Math.random() * 2000
    Health.max[eid] = 100
    Health.current[eid] = Math.floor(Math.random() * 101)
    TeamComp.id[eid] = i < 10_000 ? TEAM.A : TEAM.B
    StatusComp.value[eid] = STATUS.IDLE
    UnitMeta.nameIndex[eid] = eid

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
      hp: Health.current[eid],
      maxHp: Health.max[eid],
      status: StatusComp.value[eid] as UnitSnapshot['status'],
      team: TeamComp.id[eid] as UnitSnapshot['team'],
      name: UNIT_NAMES[UnitMeta.nameIndex[eid]],
    })
  }
  return result
}
