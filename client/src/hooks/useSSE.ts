import { useEffect, useState } from 'react'
import { useStore } from '../store/index'
import type { Unit, ZoneState, UnitDelta, GameEvent } from '../types'

type SnapshotMessage = {
  type: 'snapshot'
  units: Unit[]
  zones: ZoneState[]
}

type TickMessage = {
  seq: number
  ts: number
  deltas: UnitDelta[]
  events: GameEvent[]
}

export function useSSE(): { connected: boolean; seq: number } {
  const [connected, setConnected] = useState(false)
  const [seq, setSeq] = useState(-1)
  const applySnapshot = useStore(s => s.applySnapshot)
  const applyDeltas = useStore(s => s.applyDeltas)
  const applyZoneEvents = useStore(s => s.applyZoneEvents)
  const pushEvents = useStore(s => s.pushEvents)
  const incrementUpdateCount = useStore(s => s._incrementUpdateCount)

  useEffect(() => {
    const es = new EventSource('/stream')
    let prevSeq = -1

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string) as SnapshotMessage | TickMessage
        if ('type' in data && data.type === 'snapshot') {
          applySnapshot(data.units, data.zones)
        } else {
          const tick = data as TickMessage
          if (prevSeq !== -1 && tick.seq !== prevSeq + 1) {
            console.warn('[SSE] seq gap detected — state will resync on next snapshot')
          }
          prevSeq = tick.seq
          setSeq(tick.seq)
          applyDeltas(tick.deltas)
          const stamped = tick.events.map(e => ({ ...e, ts: tick.ts }))
          pushEvents(stamped as GameEvent[])
          applyZoneEvents(stamped as GameEvent[])
          incrementUpdateCount()
        }
      } catch {
        console.error('[SSE] failed to parse message')
      }
    }

    return () => es.close()
  }, [])

  return { connected, seq }
}
