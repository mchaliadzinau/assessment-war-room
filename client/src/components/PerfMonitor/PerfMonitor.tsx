type Level = 'healthy' | 'warning' | 'critical'
const LEVEL_COLOR: Record<Level, string> = {
  healthy: '#44cc44',
  warning: '#ccaa22',
  critical: '#cc4444',
}

function fpsLevel(v: number): Level   { return v >= 55 ? 'healthy' : v >= 30 ? 'warning' : 'critical' }
function ftLevel(v: number): Level    { return v < 18  ? 'healthy' : v <= 33 ? 'warning' : 'critical' }
function heapLevel(v: number): Level  { return v < 200 ? 'healthy' : v <= 400 ? 'warning' : 'critical' }
function latLevel(v: number): Level   { return v < 100 ? 'healthy' : v <= 300 ? 'warning' : 'critical' }

function Metric({ label, value, unit, level }: { label: string; value: number; unit: string; level: Level }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
      <span style={{ color: '#888', fontSize: '0.7rem' }}>{label}</span>
      <span style={{ color: LEVEL_COLOR[level], fontSize: '0.75rem', fontWeight: 'bold' }}>
        {value}{unit}
      </span>
    </div>
  )
}

export function PerfMonitor() {
  const fps                = 60
  const frameTime          = 1
  const heapMb             = 1
  const apiLatencyMs       = 50
  const storeUpdatesPerSec = 25

  return (
    <div style={{
      padding: '0.5rem', background: '#0d1a0d', border: '1px solid #1a331a',
      fontFamily: 'monospace', minWidth: 160,
    }}>
      <div style={{ color: '#44cc44', fontSize: '0.7rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>
        PERFORMANCE
      </div>
      <Metric label="FPS"         value={fps}               unit=""   level={fpsLevel(fps)} />
      <Metric label="Frame"       value={frameTime}         unit="ms" level={ftLevel(frameTime)} />
      <Metric label="Heap"        value={heapMb}            unit="MB" level={heapLevel(heapMb)} />
      <Metric label="API latency" value={apiLatencyMs}      unit="ms" level={latLevel(apiLatencyMs)} />
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
        <span style={{ color: '#888', fontSize: '0.7rem' }}>Updates/s</span>
        <span style={{ color: '#aaa', fontSize: '0.75rem' }}>{storeUpdatesPerSec}</span>
      </div>
    </div>
  )
}
