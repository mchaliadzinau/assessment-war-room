import { describe, it, expect, beforeAll } from 'vitest'
import { initUnits, liveEntities } from '../simulation/init.js'
import { runMoveSystem, runAttackSystem, runIdleSystem } from '../simulation/systems.js'
import { Position, Health, StatusComp } from '../simulation/world.js'
import { STATUS } from '../types.js'

beforeAll(() => {
  try { initUnits() } catch { /* already called */ }
})

describe('runMoveSystem', () => {
  it('moves exactly count entities into dirty set', () => {
    const dirty = new Set<number>()
    runMoveSystem(dirty, 10)
    expect(dirty.size).toBe(10)
  })

  it('clamps when count > liveEntities.length', () => {
    const dirty = new Set<number>()
    runMoveSystem(dirty, 99_999)
    expect(dirty.size).toBeLessThanOrEqual(liveEntities.length)
  })

  it('positions stay within [0, 2000]', () => {
    const dirty = new Set<number>()
    runMoveSystem(dirty, 100)
    for (const eid of dirty) {
      expect(Position.x[eid]).toBeGreaterThanOrEqual(0)
      expect(Position.x[eid]).toBeLessThanOrEqual(2000)
      expect(Position.y[eid]).toBeGreaterThanOrEqual(0)
      expect(Position.y[eid]).toBeLessThanOrEqual(2000)
    }
  })

  it('sets status to MOVING for moved entities', () => {
    const dirty = new Set<number>()
    runMoveSystem(dirty, 5)
    for (const eid of dirty) {
      expect(StatusComp.value[eid]).toBe(STATUS.MOVING)
    }
  })
})

describe('runAttackSystem', () => {
  it('hp does not go below 0 after many attack rounds', () => {
    const dirty = new Set<number>()
    const events: import('../types.js').GameEvent[] = []
    for (let i = 0; i < 10; i++) {
      runAttackSystem(dirty, events, 50)
    }
    for (let i = 0; i < 20_000; i++) {
      expect(Health.current[i]).toBeGreaterThanOrEqual(0)
    }
  })

  it('attack events have correct shape', () => {
    const dirty = new Set<number>()
    const events: import('../types.js').GameEvent[] = []
    runAttackSystem(dirty, events, 100)
    for (const e of events) {
      if (e.type === 'attack') {
        expect(typeof e.attacker).toBe('number')
        expect(typeof e.target).toBe('number')
      }
    }
  })
})

describe('runIdleSystem', () => {
  it('sets status to IDLE for count entities', () => {
    const dirty = new Set<number>()
    runIdleSystem(dirty, 5)
    expect(dirty.size).toBe(5)
    for (const eid of dirty) {
      expect(StatusComp.value[eid]).toBe(STATUS.IDLE)
    }
  })
})
