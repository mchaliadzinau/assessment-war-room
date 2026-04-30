# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A live battle dashboard tracking 20,000 simulated units in real time. Two separate apps: a Node.js/Express server that runs the simulation, and a React client that visualises it.

**Spec:** `ai/specs.md` — the authoritative implementation reference for all tasks (BE-1–BE-10, FE-1–FE-10).  
**Task brief:** `Task/War Room Control.md` — original requirements and evaluation criteria.  
**Wireframe:** `Task/design-guideline.png` — layout reference (map left, panels stacked right).

---

## Dev Commands

### Server (`server/`)
```bash
npm run dev      # ts-node-dev watch mode, port 3001
npm run build    # tsc → dist/
npm start        # node dist/index.js
```

### Client (`client/`)
```bash
npm run dev      # Vite HMR, port 5173
npm run build    # production bundle
npm run preview  # serve production build locally
```

Both apps are started independently. Run server first — the client proxies `/stream`, `/units`, `/zones`, and `/health` to `http://localhost:3001`.

---

## Architecture

### Server

- **ECS (bitecs):** All 20k units live in typed arrays (Position, Health, TeamComp, StatusComp, UnitMeta). No objects per entity in the hot path — component access is `Position.x[eid]`.
- **`liveEntities: number[]`** (exported from `src/simulation/init.ts`): shared mutable array of non-dead entity IDs. All three tick systems (`runMoveSystem`, `runAttackSystem`, `runIdleSystem`) read from this instead of scanning all 20k entities. The attack system splices out an eid when it kills a unit.
- **Ticker** (`src/simulation/ticker.ts`): `EventEmitter` subclass. Fires `'tick'` events at 1s intervals. Guards against double-`start()`. Wraps each tick in try/catch so one bad tick can't kill the interval.
- **SSE** (`src/transport/sse.ts`): On connect, immediately writes a full snapshot then subscribes to ticker. Checks `res.writable` before each write. Unsubscribes on `req.close`.
- **Delta format:** Each tick payload carries only the 200–350 changed entity IDs (`UnitDelta[]`), not all 20k. `buildDeltas(dirty)` reads current ECS state for each dirty eid.

### Client

- **Zustand store** (`src/store/`): Three slices — units, events, perf. `applyDeltas` always produces a **new `Map` reference** (via `new Map(state.units)` + mutations) so both React `useMemo` and Pixi's `useStore.subscribe` fire on every tick.
- **PixiJS map** (`src/components/Map/TacticalMap.tsx`): Initialised once in `useEffect`. Uses `PIXI.ParticleContainer` (20k sprites, one WebGL draw call). Subscribes to the store via `useStore.subscribe` — bypasses React's render cycle entirely. Cleans up with `app.destroy(true)` on unmount.
- **TanStack Virtual** (`src/components/UnitList/`): Virtualises the 20k-row unit list — only ~15 rows rendered at a time.
- **`usePerf`** (`src/hooks/usePerf.ts`): Runs at App root level always. Accumulates FPS/heap into refs and flushes to store every 500ms — 2 re-renders/sec instead of 60. PerfMonitor visibility is toggled via `perfOpen` state in `App.tsx`.
- **`useSSE`** (`src/hooks/useSSE.ts`): Single `EventSource` opened at App root. Snapshot resets the full Map; tick payloads call `applyDeltas`. All message parsing wrapped in try/catch.

### Data flow

```
Ticker (1s interval)
  → emit 'tick' (TickPayload: seq, deltas, events)
    → SSE /stream
      → EventSource (client)
        → applyDeltas → Zustand store (new Map ref)
          → useStore.subscribe → Pixi sprite update (no React render)
          → useMemo([units]) → KpiBar re-render
          → useMemo([units, filter]) → UnitList re-render
```

---

## Key Constraints

- **No DOM rendering for the map** — `PIXI.ParticleContainer` only. 20k divs are explicitly disallowed.
- **No full re-fetch** — clients receive a snapshot once on connect, then deltas only.
- **TypeScript strict, no `any`** — both apps. The `performance.memory` access uses a local typed intersection, not `any`.
- **Search is always `.includes()`** — never `new RegExp(userInput)` (ReDoS risk).
- **`hpMin`/`hpMax` cross-field validation** — server returns 400 if `hpMin > hpMax`.
- **`initUnits()` is called once** — throws on second call. `buildSnapshot()` must be called after it.
