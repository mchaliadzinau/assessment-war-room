import { Position, StatusComp } from './world.js'
import { liveEntities } from './init.js'
import { STATUS } from '../types.js'

function pickRandom(arr: number[], count: number): number[] {
  const actual = Math.min(count, arr.length)
  const copy = arr.slice()
  for (let i = 0; i < actual; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, actual)
}

export function runMoveSystem(dirty: Set<number>, count: number): void {
  for (const eid of pickRandom(liveEntities, count)) {
    Position.x[eid] = Math.max(0, Math.min(2000, Position.x[eid] + (Math.random() - 0.5) * 20))
    Position.y[eid] = Math.max(0, Math.min(2000, Position.y[eid] + (Math.random() - 0.5) * 20))
    StatusComp.value[eid] = STATUS.MOVING
    dirty.add(eid)
  }
}