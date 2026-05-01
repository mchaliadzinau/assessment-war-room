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

    const rateInterval = setInterval(() => {
      const count = useStore.getState()._updateCount
      setPerfField('storeUpdatesPerSec', count)
      useStore.setState({ _updateCount: 0 })
    }, 1000)

    const pingInterval = setInterval(() => { void fetch('/health') }, 5000)

    return () => {
      cancelAnimationFrame(raf)
      po.disconnect()
      clearInterval(rateInterval)
      clearInterval(pingInterval)
    }
  }, [])
}
