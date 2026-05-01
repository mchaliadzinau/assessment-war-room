import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { useStore } from '../../store/index'
import { TEAM, STATUS } from '../../types'

const MAP_W = 2000
const MAP_H = 2000

export function TacticalMap() {
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const el = canvasRef.current
    let app: PIXI.Application | null = null
    let unsubUnits: (() => void) | null = null
    let unsubZones: (() => void) | null = null
    let destroyed = false

    ;(async () => {
      const canvasWidth  = el.clientWidth  || 800
      const canvasHeight = el.clientHeight || 600
      const scaleX = canvasWidth  / MAP_W
      const scaleY = canvasHeight / MAP_H

      app = new PIXI.Application()
      await app.init({
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: 0x0a0a0f,
        antialias: false,
        resolution: window.devicePixelRatio ?? 1,
      })

      if (destroyed) {
        if (app) app.destroy(true)
        return
      }

      el.appendChild(app.canvas as HTMLCanvasElement)

      // Build dot texture via Graphics
      const g = new PIXI.Graphics()
      g.beginPath()
      g.rect(0, 0, 4, 4)
      g.fill({ color: 0xffffff })
      const dotTexture = app.renderer.generateTexture(g)

      // ParticleContainer for units
      const container = new PIXI.ParticleContainer()
      app.stage.addChild(container)

      // Zone overlay
      const zoneLayer = new PIXI.Graphics()
      app.stage.addChild(zoneLayer)

      // Create one Particle per possible unit slot (up to 20_000)
      const particles: PIXI.Particle[] = []
      const initialUnits = useStore.getState().units

      for (let i = 0; i < 20_000; i++) {
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

      unsubUnits = useStore.subscribe((state) => {
        const units = state.units
        for (const unit of units.values()) {
          const p = particles[unit.id]
          if (!p) continue
          p.x = unit.x * scaleX
          p.y = unit.y * scaleY
          p.tint = unit.team === TEAM.A ? 0x4488ff : 0xff4444
          p.alpha = unit.status === STATUS.DEAD ? 0.15 : 1
        }
      })

      // Subscribe only to zones — fires drawZones only when zones array reference changes
      unsubZones = useStore.subscribe((state) => state.zones, () => {
        drawZones()
      })
    })()

    return () => {
      destroyed = true
      if (unsubUnits) unsubUnits()
      if (unsubZones) unsubZones()
      // TODO fix Uncaught TypeError: this._cancelResize is not a function
      // if (app) app.destroy(true)
    }
  }, [])

  return <div ref={canvasRef} style={{ width: '100%', height: '100%', background: '#0a0a0f' }} />
}
