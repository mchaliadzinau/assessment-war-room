import { describe, it, expect, beforeAll } from 'vitest'
import { Ticker } from '../simulation/ticker.js'
import { initUnits } from '../simulation/init.js'

beforeAll(() => {
  try { initUnits() } catch { /* already called */ }
})

describe('Ticker', () => {
  it('emits tick events', async () => {
    const ticker = new Ticker()
    const payloads: unknown[] = []
    ticker.on('tick', (p) => payloads.push(p))
    ticker.start()
    await new Promise(r => setTimeout(r, 2100))
    ticker.stop()
    expect(payloads.length).toBeGreaterThanOrEqual(2)
  }, 5000)

  it('start() is idempotent', async () => {
    const ticker = new Ticker()
    const payloads: unknown[] = []
    ticker.on('tick', (p) => payloads.push(p))
    ticker.start()
    ticker.start()
    await new Promise(r => setTimeout(r, 1100))
    ticker.stop()
    expect(payloads.length).toBe(1)
  }, 5000)

  it('payload has correct shape', async () => {
    const ticker = new Ticker()
    let payload: unknown
    ticker.on('tick', (p) => { payload = p })
    ticker.start()
    await new Promise(r => setTimeout(r, 1100))
    ticker.stop()
    expect(payload).toMatchObject({
      seq: expect.any(Number),
      ts: expect.any(Number),
      deltas: expect.any(Array),
      events: expect.any(Array),
    })
  }, 5000)
})
