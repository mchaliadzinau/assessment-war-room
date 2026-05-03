import { Position, Health, TeamComp, StatusComp } from './world.js'
import { liveEntities, BATTLEFIELD_W, BATTLEFIELD_H } from './init.js'
import { STATUS } from '../types.js'
import type { GameEvent } from '../types.js'

const UNITS_ATTACK_RADIUS_MAX = 500
export const UNITS_ATTACK_RADIUS = Math.min(Number(process.env.UNITS_ATTACK_RADIUS ?? 200), UNITS_ATTACK_RADIUS_MAX)

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
    Position.x[eid] = Math.max(0, Math.min(BATTLEFIELD_W, Position.x[eid] + (Math.random() - 0.5) * 20))
    Position.y[eid] = Math.max(0, Math.min(BATTLEFIELD_H, Position.y[eid] + (Math.random() - 0.5) * 20))
    StatusComp.value[eid] = STATUS.MOVING
    dirty.add(eid)
  }
}

export function runAttackSystem(dirty: Set<number>, events: GameEvent[], count: number, radius = UNITS_ATTACK_RADIUS): void {
  const attackers = pickRandom(liveEntities, count)
  for (const attacker of attackers) {
    const ax = Position.x[attacker]
    const ay = Position.y[attacker]
    const attackerTeam = TeamComp.id[attacker]
    let nearestDist = Infinity
    let target = -1

    for (const i of liveEntities) {
      if (TeamComp.id[i] === attackerTeam) continue
      const dx = Position.x[i] - ax
      const dy = Position.y[i] - ay
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < radius && dist < nearestDist) {
        nearestDist = dist
        target = i
      }
    }

    if (target === -1) continue

    const damage = 10 + Math.floor(Math.random() * 20)
    Health.current[target] = Math.max(0, Health.current[target] - damage)
    StatusComp.value[attacker] = STATUS.ATTACKING
    StatusComp.value[target] = STATUS.ATTACKING
    dirty.add(attacker)
    dirty.add(target)
    events.push({ type: 'attack', attacker, target })

    if (Health.current[target] <= 0) {
      Health.current[target] = 0
      StatusComp.value[target] = STATUS.DEAD
      events.push({ type: 'destroyed', unit: target, team: TeamComp.id[target] as 0 | 1 })
      const idx = liveEntities.indexOf(target)
      if (idx !== -1) liveEntities.splice(idx, 1)
    }
  }
}

export function runIdleSystem(dirty: Set<number>, count: number): void {
  for (const eid of pickRandom(liveEntities, count)) {
    StatusComp.value[eid] = STATUS.IDLE
    dirty.add(eid)
  }
}
