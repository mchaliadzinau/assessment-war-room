import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { ZONES, zoneStates, runCaptureSystem } from '../simulation/systems/capture.js'
import { Position, StatusComp, TeamComp } from '../simulation/world.js'
import { initUnits, liveEntities } from '../simulation/init.js'
import { TEAM, STATUS } from '../types.js'
import type { GameEvent } from '../types.js'

beforeAll(() => {
  try { initUnits() } catch { /* already initialised in another test file */ }
})

beforeEach(() => {
  zoneStates.forEach(z => { z.team = null; z.progress = 0 })
})

describe('ZONES', () => {
  it('has 6 zones', () => expect(ZONES).toHaveLength(6))
})

describe('runCaptureSystem — empty zone', () => {
  it('no change when zone is empty', () => {
    for (const eid of liveEntities) {
      Position.x[eid] = 1999
      Position.y[eid] = 1999
    }
    runCaptureSystem([])
    expect(zoneStates[0].progress).toBe(0)
    expect(zoneStates[0].team).toBeNull()
  })
})

describe('runCaptureSystem — uncontested', () => {
  it('increments progress when one team dominates', () => {
    const zone = ZONES[0]
    // Move all units away first
    for (const eid of liveEntities) { Position.x[eid] = 1999; Position.y[eid] = 1999 }
    // Place one team A unit inside
    const unitA = liveEntities[0]
    Position.x[unitA] = zone.cx
    Position.y[unitA] = zone.cy
    TeamComp.id[unitA] = TEAM.A
    StatusComp.value[unitA] = STATUS.IDLE
    runCaptureSystem([])
    expect(zoneStates[0].progress).toBe(1)
  })

  it('captures zone after 5 ticks', () => {
    const zone = ZONES[0]
    for (const eid of liveEntities) { Position.x[eid] = 1999; Position.y[eid] = 1999 }
    const unitA = liveEntities[0]
    Position.x[unitA] = zone.cx
    Position.y[unitA] = zone.cy
    TeamComp.id[unitA] = TEAM.A
    StatusComp.value[unitA] = STATUS.IDLE
    const events: GameEvent[] = []
    for (let i = 0; i < 5; i++) runCaptureSystem(events)
    expect(zoneStates[0].team).toBe(TEAM.A)
    expect(events.some(e => e.type === 'capture')).toBe(true)
    expect(zoneStates[0].progress).toBe(0)
  })
})

describe('runCaptureSystem — contested', () => {
  it('decrements progress, min 0', () => {
    zoneStates[0].progress = 3
    const zone = ZONES[0]
    for (const eid of liveEntities) { Position.x[eid] = 1999; Position.y[eid] = 1999 }
    const unitA = liveEntities[0]
    const unitB = liveEntities[liveEntities.length > 10000 ? 10000 : liveEntities.length - 1]
    Position.x[unitA] = zone.cx; Position.y[unitA] = zone.cy
    TeamComp.id[unitA] = TEAM.A; StatusComp.value[unitA] = STATUS.IDLE
    Position.x[unitB] = zone.cx; Position.y[unitB] = zone.cy
    TeamComp.id[unitB] = TEAM.B; StatusComp.value[unitB] = STATUS.IDLE
    runCaptureSystem([])
    expect(zoneStates[0].progress).toBe(2)
  })
})
