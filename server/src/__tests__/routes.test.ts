import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import { initUnits } from '../simulation/init.js'
import { registerApiRoutes } from '../api/routes.js'

let app: express.Express

beforeAll(() => {
  try { initUnits() } catch { /* already called */ }
  app = express()
  app.use(cors())
  app.use(express.json())
  registerApiRoutes(app)
})

describe('GET /health', () => {
  it('returns ok and uptime', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(typeof res.body.uptime).toBe('number')
  })
})

describe('GET /zones', () => {
  it('returns 6 zones', async () => {
    const res = await request(app).get('/zones')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(6)
    expect(res.body[0]).toHaveProperty('label')
    expect(res.body[0]).toHaveProperty('cx')
  })
})

describe('GET /units', () => {
  it('returns paginated units', async () => {
    const res = await request(app).get('/units?pageSize=10')
    expect(res.status).toBe(200)
    expect(res.body.units).toHaveLength(10)
    expect(res.body.total).toBe(20_000)
  })

  it('filters by team A', async () => {
    const res = await request(app).get('/units?team=A&pageSize=500')
    expect(res.status).toBe(200)
    expect(res.body.units.every((u: {team: number}) => u.team === 0)).toBe(true)
  })

  it('returns 400 for invalid team', async () => {
    const res = await request(app).get('/units?team=C')
    expect(res.status).toBe(400)
  })

  it('returns 400 when hpMin > hpMax', async () => {
    const res = await request(app).get('/units?hpMin=80&hpMax=20')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/hpMin/)
  })

  it('returns empty units for out-of-range page', async () => {
    const res = await request(app).get('/units?page=9999&pageSize=100')
    expect(res.status).toBe(200)
    expect(res.body.units).toHaveLength(0)
  })

  it('search is safe against regex-like input', async () => {
    const res = await request(app).get('/units?search=((a%2B)%2B)&pageSize=5')
    expect(res.status).toBe(200)
  })
})
