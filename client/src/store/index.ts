import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Unit, UnitDelta, GameEvent, ZoneState, FilterState } from '../types'

interface UnitsSlice {
  units: Map<number, Unit>
  zones: ZoneState[]
  filter: FilterState
  /** IDs changed in the last tick. null = snapshot (full refresh needed). */
  lastDeltaIds: number[] | null
  applySnapshot: (units: Unit[], zones: ZoneState[]) => void
  applyDeltas: (deltas: UnitDelta[]) => void
  applyZoneEvents: (events: GameEvent[]) => void
  setFilter: (f: Partial<FilterState>) => void
}

interface EventsSlice {
  events: GameEvent[]
  maxEvents: number
  pushEvents: (e: GameEvent[]) => void
  setMaxEvents: (n: number) => void
}

type PerfKey = 'fps' | 'frameTime' | 'heapMb' | 'apiLatencyMs' | 'storeUpdatesPerSec' | '_updateCount'

interface PerfSlice {
  fps: number
  frameTime: number
  heapMb: number
  apiLatencyMs: number
  storeUpdatesPerSec: number
  _updateCount: number
  _setPerfField: (key: PerfKey, value: number) => void
  _incrementUpdateCount: () => void
}

type StoreState = UnitsSlice & EventsSlice & PerfSlice

export const useStore = create<StoreState>()(subscribeWithSelector((set) => ({
  // Units slice
  units: new Map(),
  zones: [],
  filter: { team: 'all', status: 'all', hpMin: 0, hpMax: 100, search: '' },
  lastDeltaIds: null,

  applySnapshot: (units, zones) => set({
    units: new Map(units.map(u => [u.id, u])),
    zones,
    lastDeltaIds: null,
  }),

  applyDeltas: (deltas) => set((state) => {
    const next = new Map(state.units)
    for (const d of deltas) {
      const unit = next.get(d.id)
      if (!unit) continue
      next.set(d.id, { ...unit, ...d })
    }
    return { units: next, lastDeltaIds: deltas.map(d => d.id) }
  }),

  applyZoneEvents: (events) => set((state) => {
    const zones = [...state.zones]
    for (const e of events) {
      if (e.type === 'capture') {
        const z = zones.find(z => z.id === e.zone)
        if (z) z.team = e.team
      }
    }
    return { zones }
  }),

  setFilter: (f) => set((state) => ({ filter: { ...state.filter, ...f } })),

  // Events slice
  events: [],
  maxEvents: 1000,
  pushEvents: (incoming) => set((state) => ({
    events: [...incoming, ...state.events].slice(0, state.maxEvents),
  })),
  setMaxEvents: (n) => set((state) => ({
    maxEvents: n,
    events: state.events.slice(0, n),
  })),

  // Perf slice
  fps: 0,
  frameTime: 0,
  heapMb: 0,
  apiLatencyMs: 0,
  storeUpdatesPerSec: 0,
  _updateCount: 0,
  _setPerfField: (key, value) => set({ [key]: value } as Partial<StoreState>),
  _incrementUpdateCount: () => set((s) => ({ _updateCount: s._updateCount + 1 })),
})))
