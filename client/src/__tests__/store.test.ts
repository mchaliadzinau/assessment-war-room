import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store/index'
import { TEAM, STATUS } from '../types'
import type { Unit, UnitDelta, GameEvent } from '../types'

const makeUnit = (id: number, overrides: Partial<Unit> = {}): Unit => ({
  id, x: 100, y: 100, hp: 80, maxHp: 100,
  status: STATUS.IDLE, team: TEAM.A, name: `Alpha-${id}`,
  ...overrides,
})

beforeEach(() => {
  useStore.setState({
    units: new Map(),
    zones: [],
    events: [],
    filter: { team: 'all', status: 'all', hpMin: 0, hpMax: 100, search: '' },
    fps: 0, frameTime: 0, heapMb: 0, apiLatencyMs: 0,
    storeUpdatesPerSec: 0, _updateCount: 0,
  })
})

describe('applySnapshot', () => {
  it('replaces units map entirely', () => {
    useStore.getState().applySnapshot([makeUnit(1), makeUnit(2)], [])
    expect(useStore.getState().units.size).toBe(2)
  })
})

describe('applyDeltas', () => {
  it('updates existing unit fields', () => {
    useStore.getState().applySnapshot([makeUnit(5, { hp: 80 })], [])
    const delta: UnitDelta = { id: 5, hp: 50, status: STATUS.ATTACKING }
    useStore.getState().applyDeltas([delta])
    expect(useStore.getState().units.get(5)?.hp).toBe(50)
    expect(useStore.getState().units.get(5)?.status).toBe(STATUS.ATTACKING)
  })

  it('returns a new Map reference each call', () => {
    useStore.getState().applySnapshot([makeUnit(1)], [])
    const before = useStore.getState().units
    useStore.getState().applyDeltas([{ id: 1, hp: 60 }])
    const after = useStore.getState().units
    expect(after).not.toBe(before)
  })

  it('silently skips unknown ids', () => {
    useStore.getState().applySnapshot([makeUnit(1)], [])
    expect(() => useStore.getState().applyDeltas([{ id: 9999, hp: 0 }])).not.toThrow()
    expect(useStore.getState().units.size).toBe(1)
  })
})

describe('pushEvents', () => {
  it('prepends events newest-first', () => {
    const e1: GameEvent = { type: 'attack', attacker: 1, target: 2, ts: 1 }
    const e2: GameEvent = { type: 'attack', attacker: 3, target: 4, ts: 2 }
    useStore.getState().pushEvents([e1])
    useStore.getState().pushEvents([e2])
    expect(useStore.getState().events[0]).toEqual(e2)
  })

  it('trims to 200 events', () => {
    const batch = Array.from({ length: 250 }, (_, i): GameEvent =>
      ({ type: 'attack', attacker: i, target: i + 1, ts: i })
    )
    useStore.getState().pushEvents(batch)
    expect(useStore.getState().events.length).toBe(200)
  })
})
