import { useEffect, useRef } from 'react'
import { useStore } from '../../store/index'
import { TEAM } from '../../types'
import type { GameEvent } from '../../types'

function formatEvent(e: GameEvent): string {
  switch (e.type) {
    case 'attack':    return `Unit ${e.attacker} attacked Unit ${e.target}`
    case 'destroyed': return `Unit ${e.unit} (Team ${e.team === TEAM.A ? 'A' : 'B'}) destroyed`
    case 'capture':   return `Team ${e.team === TEAM.A ? 'A' : 'B'} captured Zone ${e.zone}`
  }
}

const EVENT_COLORS: Record<GameEvent['type'], string> = {
  attack: '#aaa',
  destroyed: '#ff6666',
  capture: '#66aaff',
}

export function EventFeed() {
  const events = useStore(s => s.events)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [events.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '200px', overflow: 'hidden',
      background: '#0a0a0a', borderTop: '1px solid #222' }}>
      <div style={{ padding: '0.3rem 0.5rem', color: '#666', fontSize: '0.7rem',
        borderBottom: '1px solid #1a1a1a', fontFamily: 'monospace' }}>
        EVENT FEED ({events.length})
      </div>
      <div style={{ flex: 1, overflow: 'auto', fontFamily: 'monospace', fontSize: '0.7rem' }}>
        <div ref={topRef} />
        {events.map((e, i) => (
          <div key={i} style={{ padding: '2px 0.5rem', color: EVENT_COLORS[e.type], borderBottom: '1px solid #111' }}>
            {formatEvent(e)}
          </div>
        ))}
      </div>
    </div>
  )
}
