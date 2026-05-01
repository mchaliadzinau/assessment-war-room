import { describe, it, expect } from 'vitest'
import { STATUS, TEAM } from '../types.js'

describe('shared types', () => {
  it('STATUS values are 0–3', () => {
    expect(STATUS.IDLE).toBe(0)
    expect(STATUS.MOVING).toBe(1)
    expect(STATUS.ATTACKING).toBe(2)
    expect(STATUS.DEAD).toBe(3)
  })

  it('TEAM values are 0 and 1', () => {
    expect(TEAM.A).toBe(0)
    expect(TEAM.B).toBe(1)
  })
})
