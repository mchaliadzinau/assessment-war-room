import { useMemo, useRef, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStore } from '../../store/index'
import { TEAM, STATUS } from '../../types'

const STATUS_LABELS: Record<number, string> = {
  0: 'IDLE', 1: 'MOVING', 2: 'ATTACKING', 3: 'DEAD',
}

export function UnitList() {
  const units = useStore(s => s.units)
  const filter = useStore(s => s.filter)
  const setFilter = useStore(s => s.setFilter)

  const [searchDraft, setSearchDraft] = useState(filter.search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback((val: string) => {
    setSearchDraft(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setFilter({ search: val }), 300)
  }, [setFilter])

  const filtered = useMemo(() => {
    const list = [...units.values()].filter(u => {
      if (filter.team !== 'all' && u.team !== filter.team) return false
      if (filter.status !== 'all' && u.status !== filter.status) return false
      if (u.hp < filter.hpMin || u.hp > filter.hpMax) return false
      if (filter.search && !u.name.toLowerCase().includes(filter.search.toLowerCase())) return false
      return true
    })
    list.sort((a, b) => {
      if (a.status === STATUS.DEAD && b.status !== STATUS.DEAD) return 1
      if (a.status !== STATUS.DEAD && b.status === STATUS.DEAD) return -1
      return b.hp - a.hp
    })
    return list
  }, [units, filter])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0d0d0d' }}>
      <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', borderBottom: '1px solid #222' }}>
        <select
          value={filter.team === 'all' ? 'all' : String(filter.team)}
          onChange={e => {
            const v = e.target.value
            setFilter({ team: v === 'all' ? 'all' : (Number(v) as 0 | 1) })
          }}
          style={{ background: '#1a1a1a', color: '#eee', border: '1px solid #333', padding: '2px' }}
        >
          <option value="all">All Teams</option>
          <option value="0">Team A</option>
          <option value="1">Team B</option>
        </select>
        <select
          value={filter.status === 'all' ? 'all' : String(filter.status)}
          onChange={e => {
            const v = e.target.value
            setFilter({ status: v === 'all' ? 'all' : (Number(v) as 0|1|2|3) })
          }}
          style={{ background: '#1a1a1a', color: '#eee', border: '1px solid #333', padding: '2px' }}
        >
          <option value="all">All Status</option>
          <option value="0">Idle</option>
          <option value="1">Moving</option>
          <option value="2">Attacking</option>
          <option value="3">Dead</option>
        </select>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <input type="number" min={0} max={100} value={filter.hpMin}
            onChange={e => setFilter({ hpMin: Number(e.target.value) })}
            style={{ width: '3rem', background: '#1a1a1a', color: '#eee', border: '1px solid #333' }} />
          <input type="number" min={0} max={100} value={filter.hpMax}
            onChange={e => setFilter({ hpMax: Number(e.target.value) })}
            style={{ width: '3rem', background: '#1a1a1a', color: '#eee', border: '1px solid #333' }} />
        </div>
        <input
          type="text" value={searchDraft}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search name..."
          style={{ background: '#1a1a1a', color: '#eee', border: '1px solid #333', padding: '2px' }}
        />
        <span style={{ color: '#666', fontSize: '0.75rem' }}>{filtered.length} units</span>
      </div>
      <div ref={parentRef} style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(row => {
            const unit = filtered[row.index]
            return (
              <div key={unit.id} style={{
                position: 'absolute', top: row.start, left: 0, right: 0,
                height: 40, display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0 0.5rem', borderBottom: '1px solid #1a1a1a',
                opacity: unit.status === STATUS.DEAD ? 0.4 : 1,
                fontSize: '0.75rem', color: '#ccc', fontFamily: 'monospace',
              }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%',
                  background: unit.team === TEAM.A ? '#4488ff' : '#ff4444',
                  flexShrink: 0, display: 'inline-block' }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.name}</span>
                <span style={{ width: 60, color: '#888' }}>{STATUS_LABELS[unit.status]}</span>
                <div style={{ width: 50, height: 6, background: '#222', borderRadius: 3 }}>
                  <div style={{ width: `${(unit.hp / unit.maxHp) * 100}%`, height: '100%',
                    background: unit.hp > 50 ? '#44cc44' : unit.hp > 25 ? '#ccaa22' : '#cc4444',
                    borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
