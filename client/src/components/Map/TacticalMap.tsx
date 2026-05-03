import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { useStore } from '../../store/index'
import { TEAM, STATUS } from '../../types'
import type { Unit, FilterState } from '../../types'

function matchesFilter(unit: Unit, f: FilterState): boolean {
  if (f.team !== 'all' && unit.team !== f.team) return false
  if (f.status !== 'all' && unit.status !== f.status) return false
  const hpPct = unit.maxHp > 0 ? (unit.hp / unit.maxHp) * 100 : 0
  if (hpPct < f.hpMin || hpPct > f.hpMax) return false
  if (f.search && !unit.name.includes(f.search)) return false
  return true
}

export function TacticalMap() {
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const el = canvasRef.current
    let app: PIXI.Application | null = null
    let unsubUnits: (() => void) | null = null
    let unsubZones: (() => void) | null = null
    let destroyed = false
    let ro: ResizeObserver | null = null

    ;(async () => {
      const cfg = await fetch('/config').then(r => r.json()) as { battlefieldW: number; battlefieldH: number; unitsTotal: number }
      const MAP_W: number = cfg.battlefieldW
      const MAP_H: number = cfg.battlefieldH
      const UNITS_TOTAL: number = cfg.unitsTotal

      app = new PIXI.Application()
      await app.init({
        width: el.clientWidth,
        height: el.clientHeight,
        backgroundColor: 0x0a0a0f,
        antialias: false,
        resolution: window.devicePixelRatio ?? 1,
        autoDensity: true,
      })

      let scaleX = app.screen.width  / MAP_W
      let scaleY = app.screen.height / MAP_H

      if (destroyed) {
        if (app) app.destroy(true)
        return
      }

      const canvas = app.canvas as HTMLCanvasElement
      canvas.style.display = 'block'
      el.appendChild(canvas)

      // Build dot texture via Graphics
      const g = new PIXI.Graphics()
      g.beginPath()
      g.rect(0, 0, 4, 4)
      g.fill({ color: 0xffffff })
      const dotTexture = app.renderer.generateTexture(g)

      // ParticleContainer for units — color must be dynamic so alpha/tint updates upload every frame
      const container = new PIXI.ParticleContainer({ dynamicProperties: { color: true } })
      app.stage.addChild(container)

      // Zone overlay
      const zoneLayer = new PIXI.Graphics()
      app.stage.addChild(zoneLayer)

      // Create one Particle per possible unit slot (up to 20_000)
      const particles: PIXI.Particle[] = []
      const initialUnits = useStore.getState().units

      for (let i = 0; i < UNITS_TOTAL; i++) {
        const unit = initialUnits.get(i)
        const particle = new PIXI.Particle({
          texture: dotTexture,
          x: unit ? unit.x * scaleX : -10,
          y: unit ? unit.y * scaleY : -10,
          anchorX: 0.5,
          anchorY: 0.5,
          tint: unit ? (unit.team === TEAM.A ? 0x4488ff : 0xff4444) : 0xffffff,
          alpha: unit ? (unit.status === STATUS.DEAD ? 0.15 : 1) : 0,
        })
        container.addParticle(particle)
        particles.push(particle)
      }

      function drawZones() {
        if (!zoneLayer) return
        zoneLayer.clear()
        const zones = useStore.getState().zones
        for (const zone of zones) {
          const color = zone.team === TEAM.A ? 0x4488ff
                      : zone.team === TEAM.B ? 0xff4444
                      : 0x888888
          zoneLayer.beginPath()
          zoneLayer.circle(zone.cx * scaleX, zone.cy * scaleY, zone.r * Math.min(scaleX, scaleY))
          zoneLayer.fill({ color, alpha: 0.15 })
          zoneLayer.stroke({ color, alpha: 0.8, width: 1.5 })
        }
      }
      drawZones()

      unsubUnits = useStore.subscribe((state, prevState) => {
        const { units, filter, lastDeltaIds } = state
        const filterChanged = state.filter !== prevState.filter
        const idsToUpdate = (!filterChanged && lastDeltaIds !== null)
          ? lastDeltaIds
          : null

        if (idsToUpdate) {
          for (const id of idsToUpdate) {
            const unit = units.get(id)
            const p = particles[id]
            if (!unit || !p) continue
            p.x = unit.x * scaleX
            p.y = unit.y * scaleY
            p.tint = unit.team === TEAM.A ? 0x4488ff : 0xff4444
            p.alpha = !matchesFilter(unit, filter) ? 0 : unit.status === STATUS.DEAD ? 0.15 : 1
          }
        } else {
          for (const unit of units.values()) {
            const p = particles[unit.id]
            if (!p) continue
            p.x = unit.x * scaleX
            p.y = unit.y * scaleY
            p.tint = unit.team === TEAM.A ? 0x4488ff : 0xff4444
            p.alpha = !matchesFilter(unit, filter) ? 0 : unit.status === STATUS.DEAD ? 0.15 : 1
          }
        }
      })

      // Subscribe only to zones — fires drawZones only when zones array reference changes
      unsubZones = useStore.subscribe((state) => state.zones, () => {
        drawZones()
      })

      ro = new ResizeObserver((entries) => {
        if (!app) return
        const { width, height } = entries[0].contentRect
        if (width === 0 || height === 0) return
        app.renderer.resize(width, height)
        scaleX = width  / MAP_W
        scaleY = height / MAP_H
        const { units, filter } = useStore.getState()
        for (const unit of units.values()) {
          const p = particles[unit.id]
          if (!p) continue
          p.x = unit.x * scaleX
          p.y = unit.y * scaleY
          p.alpha = !matchesFilter(unit, filter) ? 0 : unit.status === STATUS.DEAD ? 0.15 : 1
        }
        drawZones()
      })
      ro.observe(el)
    })()

    return () => {
      destroyed = true
      if (ro) ro.disconnect()
      if (unsubUnits) unsubUnits()
      if (unsubZones) unsubZones()
      if (app) app.destroy(true)
    }
  }, [])

  return <div ref={canvasRef} style={{ width: '100%', height: '100%', background: '#0a0a0f' }} />
}
