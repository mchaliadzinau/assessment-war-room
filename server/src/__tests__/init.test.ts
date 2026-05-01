import { describe, it, expect } from 'vitest'
import { TEAM } from '../types.js'

describe('initUnits', () => {
  it('creates exactly 20000 entities', async () => {
    const { initUnits, liveEntities } = await import('../simulation/init.js')
    initUnits()
    expect(liveEntities.length).toBe(20_000)
  })

  it('throws on second call', async () => {
    const { initUnits } = await import('../simulation/init.js')
    expect(() => initUnits()).toThrow('initUnits already called')
  })
})

describe('buildSnapshot', () => {
  it('returns 20000 items with correct shape', async () => {
    const { buildSnapshot } = await import('../simulation/init.js')
    const snap = buildSnapshot()
    expect(snap).toHaveLength(20_000)
    const first = snap[0]
    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('x')
    expect(first).toHaveProperty('hp')
    expect(first).toHaveProperty('team')
    expect(first).toHaveProperty('name')
  })

  it('team A is entities 0–9999, team B is 10000–19999', async () => {
    const { buildSnapshot } = await import('../simulation/init.js')
    const snap = buildSnapshot()
    expect(snap[0].team).toBe(TEAM.A)
    expect(snap[9999].team).toBe(TEAM.A)
    expect(snap[10000].team).toBe(TEAM.B)
    expect(snap[19999].team).toBe(TEAM.B)
  })
})
