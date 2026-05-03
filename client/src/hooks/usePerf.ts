import { useEffect } from 'react'
import { useStore } from '../store/index'

type PerfMemory = { usedJSHeapSize: number }

export function usePerf() {
  const setPerfField = useStore(s => s._setPerfField)

  useEffect(() => {
    const frame = { count: 0, last: performance.now() }
    let raf: number

    const loop = (now: number) => {
      frame.count++
      if (now - frame.last >= 500) {
        const elapsed = now - frame.last
        setPerfField('fps', Math.round((frame.count / elapsed) * 1000))
        setPerfField('frameTime', Math.round(elapsed / frame.count))
        const mem = (performance as Performance & { memory?: PerfMemory }).memory
        if (mem) setPerfField('heapMb', Math.round(mem.usedJSHeapSize / 1_048_576))
        frame.count = 0
        frame.last = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const po = new PerformanceObserver((list) => {
      const entries = list.getEntries().filter(e => e.name.includes('health'))
      if (entries.length > 0) {
        setPerfField('apiLatencyMs', Math.round(entries[entries.length - 1].duration))
      }
    })
    po.observe({ type: 'resource', buffered: false })

    // NOTE: Why the RAF loop is the authoritative source for frameTime, not this observer:
    //
    // 1. RAF measures perceived frame time — the gap between paint callbacks is exactly
    //    what the user experiences as jank. Long-task duration is a JS-scheduler metric,
    //    not a rendering metric.
    //
    // 2. Long task duration ≠ frame drop. A 60 ms task that finishes before the next
    //    vsync still produces a 16 ms frame. The browser can batch or pipeline work so
    //    the displayed frame time is lower than the task duration.
    //
    // 3. Long tasks fire only when a task exceeds 50 ms. Between occurrences the field
    //    would be stale; the RAF loop samples continuously every ~16 ms and flushes an
    //    average every 500 ms, so the value is always current.
    //
    // This observer is kept because it is an explicit spec requirement (BE/FE perf
    // instrumentation). It writes to frameTime only as a secondary signal — the RAF
    // average will overwrite it on the next 500 ms flush.
    let poLongTask: PerformanceObserver | null = null
    try {
      poLongTask = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        if (entries.length > 0) {
          const worst = Math.max(...entries.map(e => e.duration))
          setPerfField('frameTime', Math.round(worst))
        }
      })
      poLongTask.observe({ type: 'longtask', buffered: false })
    } catch {
      // longtask not supported in this browser
    }

    const rateInterval = setInterval(() => {
      const count = useStore.getState()._updateCount
      setPerfField('storeUpdatesPerSec', count)
      useStore.setState({ _updateCount: 0 })
    }, 1000)

    const pingInterval = setInterval(() => { void fetch('/health') }, 5000)

    return () => {
      cancelAnimationFrame(raf)
      po.disconnect()
      poLongTask?.disconnect()
      clearInterval(rateInterval)
      clearInterval(pingInterval)
    }
  }, [])
}
