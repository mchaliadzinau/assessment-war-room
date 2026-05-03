import { Position, TeamComp } from './world.js'
import { TEAM } from '../types.js'
import type { ZoneDefinition, ZoneState, GameEvent } from '../types.js'
import { BATTLEFIELD_W, BATTLEFIELD_H, liveEntities } from './init.js'

// Zone positions as fractions of battlefield dimensions; r as fraction of shorter axis
type RelativeZone = { cx: number; cy: number; r: number; label: string }
const DEFAULT_ZONES: RelativeZone[] = [
  { cx: 0.20, cy: 0.20, r: 0.060, label: 'Alpha Point' },
  { cx: 0.80, cy: 0.20, r: 0.060, label: 'Bravo Point' },
  { cx: 0.50, cy: 0.50, r: 0.075, label: 'Centre' },
  { cx: 0.20, cy: 0.80, r: 0.060, label: 'Delta Point' },
  { cx: 0.80, cy: 0.80, r: 0.060, label: 'Echo Point' },
  { cx: 0.50, cy: 0.20, r: 0.050, label: 'Foxtrot Point' },
]

function buildZones(): ZoneDefinition[] {
  if (process.env.ZONES_JSON) {
    try {
      const raw = JSON.parse(process.env.ZONES_JSON) as Omit<ZoneDefinition, 'id'>[]
      return raw.map((z, i) => ({ ...z, id: i }))
    } catch {
      console.warn('[capture] ZONES_JSON parse failed — using scaled defaults')
    }
  }
  const rScale = Math.min(BATTLEFIELD_W, BATTLEFIELD_H)
  return DEFAULT_ZONES.map((z, i) => ({
    id: i,
    cx: Math.round(z.cx * BATTLEFIELD_W),
    cy: Math.round(z.cy * BATTLEFIELD_H),
    r:  Math.round(z.r  * rScale),
    label: z.label,
  }))
}

export const ZONES: ZoneDefinition[] = buildZones()

export const zoneStates: ZoneState[] = ZONES.map(z => ({ id: z.id, team: null, progress: 0 }))

const CAPTURE_TICKS = Math.max(1, parseInt(process.env.CAPTURE_TICKS ?? '5', 10) || 5)
const CAPTURE_CONTEST_PENALTY = Math.max(0, parseInt(process.env.CAPTURE_CONTEST_PENALTY ?? '1', 10) || 1)

export function runCaptureSystem(events: GameEvent[]): void {
  for (let zi = 0; zi < ZONES.length; zi++) {
    const zone = ZONES[zi]
    const state = zoneStates[zi]
    const inside = { [TEAM.A]: 0, [TEAM.B]: 0 }

    for (const i of liveEntities) {
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
      state.progress = Math.max(0, state.progress - CAPTURE_CONTEST_PENALTY)
      continue
    }

    const dominant: 0 | 1 = aIn > 0 ? TEAM.A : TEAM.B
    if (dominant === state.team) continue

    state.progress++
    if (state.progress >= CAPTURE_TICKS) {
      state.team = dominant
      state.progress = 0
      events.push({ type: 'capture', zone: zone.id, team: dominant })
    }
  }
}
