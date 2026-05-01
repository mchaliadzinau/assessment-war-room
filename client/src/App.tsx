import { useState } from 'react'
import { useSSE } from './hooks/useSSE'
import { KpiBar } from './components/KpiBar/KpiBar'
import { TacticalMap } from './components/Map/TacticalMap'
import { UnitList } from './components/UnitList/UnitList'
import { EventFeed } from './components/EventFeed/EventFeed'
import { PerfMonitor } from './components/PerfMonitor/PerfMonitor'

export default function App() {
  const { connected } = useSSE()
  const [perfOpen, setPerfOpen] = useState(false)

  if (!connected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a0f', color: '#eee', fontFamily: 'monospace' }}>
        Connecting to server...
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh',
      background: '#0a0a0f', overflow: 'hidden' }}>
      <KpiBar />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', overflow: 'hidden' }}>
        <TacticalMap />
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderLeft: '1px solid #1a1a1a' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <UnitList />
          </div>
          <EventFeed />
          <div style={{ borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={() => setPerfOpen(o => !o)}
              style={{ width: '100%', padding: '0.3rem', background: '#111',
                color: '#44cc44', border: 'none', cursor: 'pointer',
                fontFamily: 'monospace', fontSize: '0.7rem' }}
            >
              {perfOpen ? 'Hide Perf' : 'Show Perf'}
            </button>
            {perfOpen && <PerfMonitor />}
          </div>
        </div>
      </div>
    </div>
  )
}
