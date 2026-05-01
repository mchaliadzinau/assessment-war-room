import { Position, StatusComp, TeamComp } from './world.js'
import { STATUS, TEAM } from '../types.js'
import type { ZoneDefinition, ZoneState, GameEvent } from '../types.js'

export const ZONES: ZoneDefinition[] = [
  { id: 0, cx: 400,  cy: 400,  r: 120, label: 'Alpha Point' },
  { id: 1, cx: 1600, cy: 400,  r: 120, label: 'Bravo Point' },
  { id: 2, cx: 1000, cy: 1000, r: 150, label: 'Centre' },
  { id: 3, cx: 400,  cy: 1600, r: 120, label: 'Delta Point' },
  { id: 4, cx: 1600, cy: 1600, r: 120, label: 'Echo Point' },
  { id: 5, cx: 1000, cy: 400,  r: 100, label: 'Foxtrot Point' },
]

export const zoneStates: ZoneState[] = ZONES.map(z => ({ id: z.id, team: null, progress: 0 }))

export function runCaptureSystem(events: GameEvent[]): void {
  for (let zi = 0; zi < ZONES.length; zi++) {
    const zone = ZONES[zi]
    const state = zoneStates[zi]
    const inside = { [TEAM.A]: 0, [TEAM.B]: 0 }

    for (let i = 0; i < 20_000; i++) {
      if (StatusComp.value[i] === STATUS.DEAD) continue
      const dx = Position.x[i] - zone.cx
      const dy = Position.y[i] - zone.cy
      if (dx * dx + dy * dy <= zone.r * zone.r) {
        inside[TeamComp.id[i] as 0 | 1]++
      }
    }

    const aIn = inside[TEAM.A]
    const bIn = inside[TEAM.B]

    if (aIn === 0 && bIn === 0) continue

    if (aIn > 0 && bIn > 0) {
      state.progress = Math.max(0, state.progress - 1)
      continue
    }

    const dominant: 0 | 1 = aIn > 0 ? TEAM.A : TEAM.B
    if (dominant === state.team) continue

    state.progress++
    if (state.progress >= 5) {
      state.team = dominant
      state.progress = 0
      events.push({ type: 'capture', zone: zone.id, team: dominant })
    }
  }
}
