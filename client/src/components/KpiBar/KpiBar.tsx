import { useMemo } from 'react'
import { useStore } from '../../store/index'
import { TEAM, STATUS } from '../../types'

export function KpiBar() {
  const units = useStore(s => s.units)
  const zones = useStore(s => s.zones)

  const aliveA = useMemo(
    () => [...units.values()].filter(u => u.team === TEAM.A && u.status !== STATUS.DEAD).length,
    [units]
  )
  const aliveB = useMemo(
    () => [...units.values()].filter(u => u.team === TEAM.B && u.status !== STATUS.DEAD).length,
    [units]
  )
  const destroyed = useMemo(
    () => [...units.values()].filter(u => u.status === STATUS.DEAD).length,
    [units]
  )
  const zoneControl = useMemo(() => ({
    A: zones.filter(z => z.team === TEAM.A).length,
    B: zones.filter(z => z.team === TEAM.B).length,
  }), [zones])

  return (
    <div style={{
      display: 'flex', gap: '2rem', padding: '0.5rem 1rem',
      background: '#111', color: '#eee', fontFamily: 'monospace', fontSize: '0.9rem',
      borderBottom: '1px solid #333',
    }}>
      <span>&#x1F535; Team A: <strong>{aliveA}</strong> alive</span>
      <span>&#x1F534; Team B: <strong>{aliveB}</strong> alive</span>
      <span>&#x1F480; Destroyed: <strong>{destroyed}</strong></span>
      <span>&#x1F3C1; Zones A/B: <strong>{zoneControl.A}/{zoneControl.B}</strong></span>
    </div>
  )
}
