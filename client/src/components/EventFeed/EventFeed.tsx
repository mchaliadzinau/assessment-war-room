import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/index'
import { TEAM } from '../../types'
import type { GameEvent } from '../../types'

function formatEvent(e: GameEvent): string {
  switch (e.type) {
    case 'attack':     return `Unit ${e.attacker} attacked Unit ${e.target}`
    case 'destroyed':  return `Unit ${e.unit} (Team ${e.team === TEAM.A ? 'A' : 'B'}) destroyed`
    case 'capture':    return `Team ${e.team === TEAM.A ? 'A' : 'B'} captured Zone ${e.zone}`
    case 'capturing':  return `Team ${e.team === TEAM.A ? 'A' : 'B'} capturing Zone ${e.zone} (${e.progress}/${e.required})`
    case 'contesting': return `Zone ${e.zone} contested`
    case 'heal':       return `Unit ${e.unit} healed +${e.amount} HP`
    default: {
      const _never: never = e
      return `Unknown event`
    }
  }
}

const EVENT_COLORS: Record<GameEvent['type'], string> = {
  attack:     '#aaa',
  destroyed:  '#ff6666',
  capture:    '#66aaff',
  capturing:  '#66aaff',
  contesting: '#ffaa44',
  heal:       '#66ff99',
}

export function EventFeed() {
  const events = useStore(s => s.events)
  const topRef = useRef<HTMLDivElement>(null)
  const [filterType, setFilterType] = useState<GameEvent['type'] | 'all'>('all')

  const filtered = filterType === 'all'
    ? events
    : events.filter(e => e.type === filterType)

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [filtered.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '200px', overflow: 'hidden',
      background: '#0a0a0a', borderTop: '1px solid #222' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.3rem 0.5rem', borderBottom: '1px solid #1a1a1a',
        fontFamily: 'monospace', fontSize: '0.7rem', color: '#666',
      }}>
        <span>EVENT FEED ({filtered.length})</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as GameEvent['type'] | 'all')}
            style={{
              background: '#111', color: '#aaa', border: '1px solid #333',
              fontSize: '0.65rem', padding: '1px 4px', fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            <option value="all">All</option>
            <option value="attack">Attack</option>
            <option value="destroyed">Destroyed</option>
            <option value="capture">Capture</option>
            <option value="capturing">Capturing</option>
            <option value="contesting">Contesting</option>
            <option value="heal">Heal</option>
          </select>
          <button
            onClick={() => {
              const text = filtered.map(formatEvent).join('\n')
              navigator.clipboard.writeText(text).catch(() => {})
            }}
            style={{
              background: '#1a1a1a', color: '#aaa', border: '1px solid #333',
              fontSize: '0.65rem', padding: '1px 6px', fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            copy
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', fontFamily: 'monospace', fontSize: '0.7rem' }}>
        <div ref={topRef} />
        {filtered.map((e, i) => (
          <div key={`${e.type}-${e.ts}-${i}`} style={{ padding: '2px 0.5rem', color: EVENT_COLORS[e.type], borderBottom: '1px solid #111' }}>
            {formatEvent(e)}
          </div>
        ))}
      </div>
    </div>
  )
}
