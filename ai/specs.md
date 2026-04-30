# Battle Dashboard — Implementation Spec

## Conventions

- All tasks are independent unless a `depends on` note is listed.
- Each task has a clear **done condition** — the definition of done, not a description of effort.
- TypeScript strict mode, no `any`, everywhere.
- Filenames use `kebab-case`. Types use `PascalCase`. Variables/functions use `camelCase`.

---

---

# BACKEND

Stack: Node.js · Express · TypeScript · bitecs · zod

---

## BE-1 — Project scaffold

**What to do**

Create the `server/` directory with the following layout:

```
server/
  src/
    simulation/
    transport/
    api/
    types.ts
    index.ts
  tsconfig.json
  package.json
```

`tsconfig.json` — strict mode, `target: ES2022`, `moduleResolution: bundler`, `outDir: dist`.

`package.json` — scripts: `dev` (ts-node-dev), `build` (tsc), `start` (node dist/index.js).

Dependencies: `express`, `bitecs`, `zod`.
Dev dependencies: `typescript`, `ts-node-dev`, `@types/express`, `@types/node`.

**Done when**

`npm run dev` starts without errors. `src/index.ts` exports a running Express app on port 3001.

---

## BE-2 — Shared types

**File:** `src/types.ts`

**What to do**

Define and export all shared types used across the server. No logic here, types only.

```ts
export const STATUS = {
  IDLE: 0,
  MOVING: 1,
  ATTACKING: 2,
  DEAD: 3,
} as const
export type UnitStatus = typeof STATUS[keyof typeof STATUS]

export const TEAM = { A: 0, B: 1 } as const
export type Team = typeof TEAM[keyof typeof TEAM]

export type UnitSnapshot = {
  id: number
  x: number
  y: number
  hp: number
  maxHp: number
  status: UnitStatus
  team: Team
  name: string
}

export type UnitDelta = {
  id: number
  x?: number
  y?: number
  hp?: number
  status?: UnitStatus
}

export type GameEvent =
  | { type: 'attack';   attacker: number; target: number }
  | { type: 'destroyed'; unit: number; team: Team }
  | { type: 'capture';  zone: number; team: Team }

export type TickPayload = {
  seq: number
  ts: number
  deltas: UnitDelta[]
  events: GameEvent[]
}

export type SnapshotPayload = {
  type: 'snapshot'
  units: UnitSnapshot[]
  zones: ZoneState[]
}

export type ZoneDefinition = {
  id: number
  cx: number
  cy: number
  r: number
  label: string
}

export type ZoneState = {
  id: number
  team: Team | null
  progress: number   // 0–5 ticks toward capture
}
```

**Done when**

File compiles with zero errors. No imports from other local files.

---

## BE-3 — ECS world + component definitions

**File:** `src/simulation/world.ts`

**What to do**

Create and export the bitecs world and all component schemas.

```ts
import { createWorld, defineComponent, Types } from 'bitecs'

export const world = createWorld()

export const Position  = defineComponent({ x: Types.f32, y: Types.f32 })
export const Health    = defineComponent({ current: Types.i16, max: Types.i16 })
export const TeamComp  = defineComponent({ id: Types.ui8 })
export const StatusComp = defineComponent({ value: Types.ui8 })
export const UnitMeta  = defineComponent({ nameIndex: Types.ui16 })
// nameIndex → lookup into a pre-generated names array (avoids string in ECS)
```

Export `UNIT_NAMES: string[]` — an array of 20 000 pre-generated unit names (e.g. `Alpha-0001`, `Bravo-0042`). Names are generated once at module load; `nameIndex` is the entity's index into this array.

**Done when**

Module imports without error. `world`, all five components, and `UNIT_NAMES` are exported.

---

## BE-4 — Unit initialisation

**File:** `src/simulation/init.ts`

**What to do**

Export `function initUnits(): void`.

- Guard: if called a second time, throw `Error('initUnits already called')`.
- Creates exactly 20 000 entities using `addEntity(world)`.
- Adds `Position`, `Health`, `TeamComp`, `StatusComp`, `UnitMeta` to each.
- Team A: entities 0–9 999. Team B: entities 10 000–19 999. bitecs assigns sequential IDs starting at 0 when entities are created in order with no deletions — `nameIndex = eid` is valid for this usage.
- Position: random `x ∈ [0, 2000]`, `y ∈ [0, 2000]`, `f32`.
- Health: `max = 100`, `current = random 0–100`.
- Status: `IDLE`.
- `nameIndex = eid` (entity id is its own name index).

Export `liveEntities: number[]` — mutable array of all non-dead entity IDs, populated by `initUnits()`. Systems read and splice from this array; the attack system removes an eid when it kills a unit. This avoids O(n) filtering on every system call.

Export `function buildSnapshot(): UnitSnapshot[]` — iterates all 20 000 entities and returns the full unit array. Called once on client connect. Must be called after `initUnits()`.

**Done when**

`initUnits()` runs without error. Second call throws. `buildSnapshot()` returns an array of exactly 20 000 items with correct types. `liveEntities.length === 20000` after init.

---

## BE-5 — Tick systems

**File:** `src/simulation/systems.ts`

**What to do**

Export three pure system functions. Each receives the dirty set and events array as out-parameters to mutate. All three use the exported `liveEntities` array from `init.ts` — never iterate all 20k entities to find live ones.

### `runMoveSystem(dirty: Set<number>, count: number): void`

- Clamp: `const actual = Math.min(count, liveEntities.length)`.
- Picks `actual` distinct live entities at random (Fisher-Yates partial shuffle on `liveEntities`).
- Moves each: `x += (Math.random() - 0.5) * 20`, `y += (Math.random() - 0.5) * 20`.
- Clamps x and y to `[0, 2000]`.
- Sets `StatusComp.value[eid] = STATUS.MOVING`.
- Adds eid to `dirty`.

### `runAttackSystem(dirty: Set<number>, events: GameEvent[], count: number): void`

- Clamp: `const actual = Math.min(count, liveEntities.length)`.
- Picks `actual` distinct live entities at random as attackers.
- For each attacker, scans **all 20k entities** (O(n) linear scan — acceptable at 1s interval, see trade-off note in README). Skip entities where `StatusComp.value[candidate] === STATUS.DEAD` — dead units must not be targeted.
- Finds the nearest alive enemy (opposite team) within radius 200.
- **Only if a target is found:** subtract `10 + Math.floor(Math.random() * 20)` from `Health.current[target]`. Set both attacker and target status to `ATTACKING`. Add both to `dirty`. Push `attack` event.
- If `Health.current[target] <= 0`: clamp to `Health.current[target] = 0`, set status `DEAD`, push `destroyed` event. Remove target from `liveEntities` (splice by value).
- If no target within radius: attacker status is left unchanged (do not set ATTACKING when nothing was hit).

### `runIdleSystem(dirty: Set<number>, count: number): void`

- Clamp: `const actual = Math.min(count, liveEntities.length)`.
- Picks `actual` live entities.
- Sets status to `IDLE`. Adds to `dirty`.

**Done when**

All three functions are exported and typed. Each mutates only the dirty set, events array, `liveEntities`, and ECS component arrays — no other side effects. When fewer live units exist than `count`, uses all available without error.

---

## BE-6 — Capture zone system

**File:** `src/simulation/capture.ts`

**What to do**

Export `ZONES: ZoneDefinition[]` — 6 fixed zones spread across the 2000×2000 map:

```ts
{ id: 0, cx: 400,  cy: 400,  r: 120, label: 'Alpha Point' }
{ id: 1, cx: 1600, cy: 400,  r: 120, label: 'Bravo Point' }
{ id: 2, cx: 1000, cy: 1000, r: 150, label: 'Centre' }
{ id: 3, cx: 400,  cy: 1600, r: 120, label: 'Delta Point' }
{ id: 4, cx: 1600, cy: 1600, r: 120, label: 'Echo Point' }
{ id: 5, cx: 1000, cy: 400,  r: 100, label: 'Foxtrot Point' }
```

Export `zoneStates: ZoneState[]` — one entry per zone, initialised with `team: null, progress: 0`.

Export `function runCaptureSystem(events: GameEvent[]): void`:

- For each zone, count alive units inside radius (O(20k) scan — 6 × 20k = 120k comparisons, negligible).
- `inside = { [TEAM.A]: 0, [TEAM.B]: 0 }`.
- **No units present** (both counts 0) → no change to progress or ownership.
- **Contested** (both counts > 0) → `progress` decrements by 1, min 0.
- **Uncontested** (exactly one team present): that team is dominant.
  - If dominant team === current owner → no change.
  - If dominant team ≠ current owner → `progress++`.
  - If `progress >= 5` → set `zoneState.team = dominant`, reset `progress = 0`, push `capture` event.

**Done when**

`runCaptureSystem` mutates `zoneStates` correctly and pushes capture events. Unit tests not required but logic must be deterministic given fixed inputs.

---

## BE-7 — Tick orchestrator

**File:** `src/simulation/ticker.ts`

**What to do**

Export `class Ticker` with:

```ts
class Ticker extends EventEmitter {
  private seq = 0
  private intervalId: ReturnType<typeof setInterval> | null = null

  start(): void   // begins setInterval(tick, 1000); no-op if already running
  stop(): void    // clears interval, sets intervalId to null

  private tick(): void
}
```

`tick()` implementation:

```ts
private tick() {
  try {
    const dirty = new Set<number>()
    const events: GameEvent[] = []

    const total = 200 + Math.floor(Math.random() * 150)
    const moveCount   = Math.floor(total * 0.5)
    const attackCount = Math.floor(total * 0.35)
    const idleCount   = total - moveCount - attackCount

    runMoveSystem(dirty, moveCount)
    runAttackSystem(dirty, events, attackCount)
    runIdleSystem(dirty, idleCount)
    runCaptureSystem(events)

    const payload: TickPayload = {
      seq: this.seq++,
      ts: Date.now(),
      deltas: buildDeltas(dirty),
      events,
    }

    this.emit('tick', payload)
  } catch (err) {
    console.error('[Ticker] tick error:', err)
    // interval continues — one bad tick must not stop the simulation
  }
}
```

`start()` guard:
```ts
start() {
  if (this.intervalId !== null) return
  this.intervalId = setInterval(() => this.tick(), 1000)
}
```

Export `buildDeltas(dirty: Set<number>): UnitDelta[]` — maps each dirty eid to a `UnitDelta` including all mutable fields (x, y, hp, status). HP is always the clamped value (never negative).

**Done when**

`ticker.start()` emits `'tick'` events at ~1s intervals. Calling `start()` twice does not double the tick rate. `ticker.stop()` stops emission. Payload matches `TickPayload` type.

---

## BE-8 — SSE transport

**File:** `src/transport/sse.ts`

**What to do**

Export `function registerSseRoute(app: Express, ticker: Ticker): void`.

Route: `GET /stream`

On connect:
1. Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `Access-Control-Allow-Origin: *`.
2. Write snapshot immediately: `data: ${JSON.stringify(snapshotPayload)}\n\n`.
3. Subscribe to `ticker` `'tick'` event — before each write check `res.writable`; skip the write and unsubscribe if false (client disconnected mid-tick).
4. Write each tick payload as `data: ${JSON.stringify(payload)}\n\n`.
5. On `req.on('close')` — unsubscribe from ticker.

No library needed. Raw `res.write`.

> **Seq gap on reconnect:** SSE reconnects automatically. The server sends a fresh snapshot on every new connection, which resets client state. The client's seq gap detector will fire once after reconnect (snapshot has no seq); this is expected and harmless.

**Done when**

Connecting with `curl -N http://localhost:3001/stream` shows a snapshot followed by tick events every ~1s. Disconnecting does not crash the server.

---

## BE-9 — REST endpoints + validation

**File:** `src/api/routes.ts`

**What to do**

Export `function registerApiRoutes(app: Express): void`.

### `GET /units`

Query params (all optional), validated with zod:

```ts
const querySchema = z.object({
  team:      z.enum(['A', 'B']).optional(),
  status:    z.enum(['idle','moving','attacking','dead']).optional(),
  hpMin:     z.coerce.number().min(0).max(100).optional(),
  hpMax:     z.coerce.number().min(0).max(100).optional(),
  search:    z.string().max(50).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(500).default(100),
})
```

After schema validation, apply cross-field check:
```ts
if (parsed.hpMin !== undefined && parsed.hpMax !== undefined && parsed.hpMin > parsed.hpMax) {
  return res.status(400).json({ error: 'hpMin must be ≤ hpMax' })
}
```

Name search must use `unit.name.toLowerCase().includes(search.toLowerCase())` — never `new RegExp(search)` (ReDoS risk with user-controlled input).

If `page * pageSize` exceeds the filtered total, return `{ total, page, pageSize, units: [] }` — not an error.

Response:
```ts
{
  total: number
  page: number
  pageSize: number
  units: UnitSnapshot[]
}
```

Validation failure → `400` with `{ error: string }`.

### `GET /zones`

Returns current `zoneStates` merged with `ZONES` definitions. No query params.

### `GET /health`

Returns `{ ok: true, uptime: process.uptime() }`. Used by client perf monitor to measure API latency.

**Done when**

All three endpoints respond correctly. Invalid query params return 400 with a readable error message.

---

## BE-10 — Entry point wiring

**File:** `src/index.ts`

**What to do**

```ts
import express from 'express'
import cors from 'cors'
import { initUnits } from './simulation/init'
import { Ticker } from './simulation/ticker'
import { registerSseRoute } from './transport/sse'
import { registerApiRoutes } from './api/routes'

const app = express()
app.use(cors())
app.use(express.json())

initUnits()

const ticker = new Ticker()
registerSseRoute(app, ticker)
registerApiRoutes(app)

app.listen(3001, () => console.log('Server ready on :3001'))
ticker.start()
```

**Done when**

`npm run dev` starts cleanly. All routes respond. SSE stream emits ticks.

---

---

# FRONTEND

Stack: React 18 · TypeScript · Vite · Zustand · PixiJS v7 · TanStack Virtual

---

## FE-1 — Project scaffold

**What to do**

`npm create vite@latest client -- --template react-ts`

Directory layout after setup:

```
client/
  src/
    store/
    hooks/
    components/
      Map/
      UnitList/
      EventFeed/
      KpiBar/
      PerfMonitor/
    lib/
    types.ts
    App.tsx
    main.tsx
  vite.config.ts
  tsconfig.json
```

`vite.config.ts` — proxy `/stream`, `/units`, `/zones`, and `/health` to `http://localhost:3001`.

Additional dependencies: `zustand`, `pixi.js@7`, `@tanstack/react-virtual`.

**Done when**

`npm run dev` starts. `http://localhost:5173` shows a blank React app. No type errors.

---

## FE-2 — Shared client types

**File:** `src/types.ts`

Mirror the server's shared types. Do not import from the server package — duplicate the types. This is intentional: FE and BE are separate deployable units.

```ts
export const STATUS = { IDLE: 0, MOVING: 1, ATTACKING: 2, DEAD: 3 } as const
export type UnitStatus = typeof STATUS[keyof typeof STATUS]

export const TEAM = { A: 0, B: 1 } as const
export type Team = typeof TEAM[keyof typeof TEAM]

export type Unit = {
  id: number
  x: number
  y: number
  hp: number
  maxHp: number
  status: UnitStatus
  team: Team
  name: string
}

export type UnitDelta = {
  id: number
  x?: number
  y?: number
  hp?: number
  status?: UnitStatus
}

export type GameEvent =
  | { type: 'attack';    attacker: number; target: number; ts: number }
  | { type: 'destroyed'; unit: number; team: Team; ts: number }
  | { type: 'capture';   zone: number; team: Team; ts: number }

export type ZoneState = {
  id: number
  label: string
  cx: number
  cy: number
  r: number
  team: Team | null
  progress: number
}

export type FilterState = {
  team: Team | 'all'
  status: UnitStatus | 'all'
  hpMin: number
  hpMax: number
  search: string
}
```

**Done when**

File compiles. No imports from server code.

---

## FE-3 — Zustand store

**Files:** `src/store/units.ts`, `src/store/events.ts`, `src/store/perf.ts`, `src/store/index.ts`

**What to do**

Three separate slices combined with Zustand's `create`.

### units slice

```ts
interface UnitsSlice {
  units: Map<number, Unit>
  zones: ZoneState[]
  filter: FilterState
  applySnapshot: (units: Unit[], zones: ZoneState[]) => void
  applyDeltas: (deltas: UnitDelta[]) => void
  applyZoneEvents: (events: GameEvent[]) => void
  setFilter: (f: Partial<FilterState>) => void
}
```

`applyDeltas` — creates a new Map reference on every call so that Zustand subscribers (both React `useMemo` and Pixi's `useStore.subscribe`) detect the change:

```ts
applyDeltas: (deltas) => set(state => {
  const next = new Map(state.units)   // shallow copy — O(20k) at 1 tick/sec is acceptable
  for (const d of deltas) {
    const unit = next.get(d.id)
    if (!unit) continue               // unknown ID — skip silently
    next.set(d.id, { ...unit, ...d })
  }
  return { units: next }
})
```

If using Immer, call `enableMapSet()` once at app startup before the store is created.

`applySnapshot` — replaces the Map entirely (called once on connect and on SSE reconnect).

`setFilter` — updates filter state. Derived filtered list is computed in a selector, not stored.

### events slice

```ts
interface EventsSlice {
  events: GameEvent[]           // last 200 events, newest first
  pushEvents: (e: GameEvent[]) => void
}
```

`pushEvents` — prepends to array, trims to 200.

### perf slice

```ts
interface PerfSlice {
  fps: number
  frameTime: number
  heapMb: number
  apiLatencyMs: number
  storeUpdatesPerSec: number
  _updateCount: number          // internal counter, reset each second
  _setPerfField: (key: keyof PerfState, value: number) => void
  _incrementUpdateCount: () => void
}
```

### `src/store/index.ts`

```ts
export const useStore = create<UnitsSlice & EventsSlice & PerfSlice>()(...)
```

**Done when**

Store imports cleanly. `applyDeltas` with a 350-item array runs in < 2ms (verify with `console.time`). Selectors are exported as typed hooks.

---

## FE-4 — SSE connection hook

**File:** `src/hooks/useSSE.ts`

**What to do**

```ts
export function useSSE(): { connected: boolean; seq: number }
```

- Opens `new EventSource('/stream')` on mount.
- On `message`: wrap the entire handler in `try/catch` — a malformed JSON payload must not crash the hook.
  - If `data.type === 'snapshot'` → call `applySnapshot`, `applyZoneEvents`.
  - Else → call `applyDeltas`, `pushEvents`, `_incrementUpdateCount`.
- Tracks `connected` state via `onopen` / `onerror`.
- Tracks last received `seq` — logs `console.warn('[SSE] seq gap detected — state will resync on next snapshot')` if `seq !== prev + 1`. No manual recovery needed; SSE reconnect sends a fresh snapshot.
- Closes `EventSource` on unmount.

**Done when**

Hook connects on app load. Reconnects automatically on disconnect (EventSource native behaviour). Console shows no type errors.

---

## FE-5 — KPI bar

**File:** `src/components/KpiBar/KpiBar.tsx`

**What to do**

Subscribes to units store. Computes four KPIs inline (not in the store):

```ts
const aliveA    = useMemo(() => [...units.values()].filter(u => u.team === TEAM.A && u.status !== STATUS.DEAD).length, [units])
const aliveB    = useMemo(() => [...units.values()].filter(u => u.team === TEAM.B && u.status !== STATUS.DEAD).length, [units])
const destroyed = useMemo(() => [...units.values()].filter(u => u.status === STATUS.DEAD).length, [units])
const zoneControl = useMemo(() => ({
  A: zones.filter(z => z.team === TEAM.A).length,
  B: zones.filter(z => z.team === TEAM.B).length,
}), [zones])
```

> `[units]` as a memo dependency works correctly because `applyDeltas` always returns a new Map reference (see FE-3). The memo recomputes exactly once per tick.

Displays as a horizontal bar: `Team A: {aliveA} alive · Team B: {aliveB} alive · Destroyed: {destroyed} · Zones A/B: {zoneControl.A}/{zoneControl.B}`.

No styling requirements beyond readable layout.

**Done when**

Numbers update on each SSE tick. Destroyed count increases monotonically.

---

## FE-6 — Unit list panel

**File:** `src/components/UnitList/UnitList.tsx`

**What to do**

- Reads `units` and `filter` from store.
- Computes filtered + sorted list with `useMemo`:
  - Filter by team, status, hpMin/hpMax, name search (case-insensitive substring).
  - Sort: dead units last, then by hp descending.
- Renders with `@tanstack/react-virtual` (windowed list — do not render all 20k rows).
  - Row height: 40px.
  - Each row shows: name, team badge, status badge, HP bar (width = `hp/maxHp * 100%`).

Filter controls (above the list):
- Team select: All / A / B
- Status select: All / Idle / Moving / Attacking / Dead
- HP range: two number inputs (0–100)
- Name search: text input with debounce (300ms)

**Done when**

Scrolling 20k rows is smooth. Filter changes update the list instantly. Dead units appear at the bottom.

---

## FE-7 — Event feed

**File:** `src/components/EventFeed/EventFeed.tsx`

**What to do**

- Reads `events` from store (last 200).
- Renders a scrollable list, newest at top.
- Each event type has a distinct format:
  - `attack`: `Unit {attacker} attacked Unit {target}`
  - `destroyed`: `Unit {unit} (Team {team}) destroyed`
  - `capture`: `Team {team} captured Zone {zone}`
- Auto-scrolls to top on new events (events are prepended).
- No virtualisation needed — 200 items max.

**Done when**

Events appear within 1 tick of occurrence. List does not grow beyond 200 items.

---

## FE-8 — PixiJS tactical map

**File:** `src/components/Map/TacticalMap.tsx`

**What to do**

This component owns its own PixiJS application. It does **not** re-render via React after mount.

### Initialisation (once, in `useEffect`)

```ts
if (!canvasRef.current) return  // null guard — should never be null after mount

const app = new PIXI.Application({
  width: canvasWidth,
  height: canvasHeight,
  backgroundColor: 0x0a0a0f,
  antialias: false,
  resolution: window.devicePixelRatio,
})
canvasRef.current.appendChild(app.view)

const container = new PIXI.ParticleContainer(20_000, {
  position: true,
  tint: true,
  alpha: true,
})
app.stage.addChild(container)
```

Create a 4×4 white square texture programmatically:

```ts
const g = new PIXI.Graphics()
g.beginFill(0xffffff)
g.drawRect(0, 0, 4, 4)
g.endFill()
const dotTexture = app.renderer.generateTexture(g)
```

Create all 20 000 sprites up front. Store in `sprites: PIXI.Sprite[]` ref indexed by entity id. Set initial position and tint from snapshot.

The `useEffect` cleanup must destroy the Pixi app and unsubscribe from the store:
```ts
return () => {
  unsubscribe()
  app.destroy(true)  // true = destroy children and textures
}
```

### Tick updates

Subscribe to the store's raw `units` Map via `useStore.subscribe` (not `useStore` — avoids React re-render):

```ts
const unsubscribe = useStore.subscribe(
  state => state.units,
  (units) => {
    for (const unit of units.values()) {
      const s = sprites[unit.id]
      if (!s) continue  // bounds guard — unit.id outside 0–19999 would be undefined
      s.x = unit.x * scaleX
      s.y = unit.y * scaleY
      s.tint = unit.team === TEAM.A ? 0x4488ff : 0xff4444
      s.alpha = unit.status === STATUS.DEAD ? 0.15 : 1
    }
  }
)
```

> Note: subscribe callback receives the full Map but only recently-changed units actually move — this is acceptable since Pixi's ParticleContainer only uploads dirty GPU data. If profiling shows this is a bottleneck, switch to subscribing to a `lastDeltas` ref instead.

### Zone overlays

Draw zone circles as `PIXI.Graphics` on a separate layer (not in ParticleContainer). Each circle: semi-transparent fill (alpha 0.15) + solid stroke (alpha 0.8), coloured by owner (`0x4488ff` Team A / `0xff4444` Team B / `0x888888` neutral). This layer re-draws only on zone capture events — subscribe to `state.zones` separately from the units subscription.

**Done when**

Canvas renders all 20 000 dots. Chrome DevTools shows ≥ 55 FPS during normal ticking. Dead units are visually distinct (faded). Zone circles are visible.

---

## FE-9 — Performance monitor

**File:** `src/components/PerfMonitor/PerfMonitor.tsx`
**File:** `src/hooks/usePerf.ts`

**What to do**

### `usePerf.ts`

This hook runs independently of all other store subscriptions. It writes to the perf slice via `_setPerfField`, flushing every 500ms — not every frame.

```ts
export function usePerf() {
  const setPerfField = useStore(s => s._setPerfField)
  const incrementUpdateCount = useStore(s => s._incrementUpdateCount)

  useEffect(() => {
    // FPS + frame time
    const frame = { count: 0, last: performance.now() }
    let raf: number
    const loop = (now: number) => {
      frame.count++
      if (now - frame.last >= 500) {
        const fps = Math.round((frame.count / (now - frame.last)) * 1000)
        const frameTime = Math.round((now - frame.last) / frame.count)
        setPerfField('fps', fps)
        setPerfField('frameTime', frameTime)
        type PerfMemory = { usedJSHeapSize: number }
        const mem = (performance as Performance & { memory?: PerfMemory }).memory
        if (mem) {
          setPerfField('heapMb', Math.round(mem.usedJSHeapSize / 1048576))
        }
        frame.count = 0
        frame.last = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // API latency — PerformanceObserver on resource entries for /health
    // Use 'health' (not '/health') — Vite proxy and browser may record the full origin URL
    const po = new PerformanceObserver(list => {
      const entries = list.getEntries().filter(e => e.name.includes('health'))
      if (entries.length > 0) {
        setPerfField('apiLatencyMs', Math.round(entries[entries.length - 1].duration))
      }
    })
    po.observe({ type: 'resource', buffered: false })

    // Store update rate — count incremented by SSE hook, read every second
    const rateInterval = setInterval(() => {
      const count = useStore.getState()._updateCount
      setPerfField('storeUpdatesPerSec', count)
      useStore.setState({ _updateCount: 0 })
    }, 1000)

    // Ping /health every 5s to get a fresh latency reading
    const pingInterval = setInterval(() => fetch('/health'), 5000)

    return () => {
      cancelAnimationFrame(raf)
      po.disconnect()
      clearInterval(rateInterval)
      clearInterval(pingInterval)
    }
  }, [])
}
```

### `PerfMonitor.tsx`

Reads only from perf slice. Renders a fixed panel (position: fixed, bottom-right).

Displays:

| Metric | Healthy | Warning | Critical |
|---|---|---|---|
| FPS | ≥ 55 | 30–54 | < 30 |
| Frame time | < 18ms | 18–33ms | > 33ms |
| Heap | < 200 MB | 200–400 MB | > 400 MB |
| API latency | < 100ms | 100–300ms | > 300ms |
| Store updates/s | — | — | — |

Each metric renders with a colour indicator (green / amber / red) so health is legible at a glance.

Panel is togglable. The `open` boolean state lives in `App.tsx` (via `useState`) and is passed as a prop to `PerfMonitor`. When closed, the panel DOM is not mounted but `usePerf` still runs at the root level — ensuring zero rendering cost when hidden and uninterrupted metric collection.

**Done when**

FPS counter reflects actual browser FPS. Heap shows a plausible MB value in Chrome. Panel can be toggled without affecting map FPS.

---

## FE-10 — App assembly

**File:** `src/App.tsx`

**What to do**

Layout matches the design wireframe: map fills the left, panels stack on the right.

```tsx
export default function App() {
  const { connected } = useSSE()
  const [perfOpen, setPerfOpen] = useState(false)
  usePerf()

  if (!connected) return <div>Connecting…</div>

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh' }}>
      <KpiBar />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
        {/* Left: tactical map takes all remaining width */}
        <TacticalMap />
        {/* Right: panels stacked vertically */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <UnitList />
          <EventFeed />
          <button onClick={() => setPerfOpen(o => !o)}>
            {perfOpen ? 'Hide Perf' : 'Show Perf'}
          </button>
          {perfOpen && <PerfMonitor />}
        </div>
      </div>
    </div>
  )
}
```

`useSSE` and `usePerf` are called once at the root level. No prop drilling — components read from the store directly. The perf toggle button sits above the panel in the right column.

**Done when**

App renders all panels. Map occupies the left column. SSE connects on load. Refreshing the page reconnects cleanly.

---

---

# README sections required

## Setup instructions

```
# Server
cd server && npm install && npm run dev

# Client (separate terminal)
cd client && npm install && npm run dev
```

## Architecture Decisions

Must cover (in bullet form):

- **ECS with bitecs** — typed arrays for 20k entities, cache-friendly iteration, O(1) component access by entity id.
- **No spatial index** — O(n) scan for attack target lookup is ~7M comparisons/tick; at 1s tick interval this is < 5ms and not worth the added complexity. Decision would reverse at 100ms ticks.
- **SSE over WebSocket** — server pushes only, no bidirectional need, SSE reconnects automatically, no handshake overhead, works through standard proxies.
- **PixiJS ParticleContainer over DOM / plain Canvas 2D** — WebGL batch draw; 20k sprites in one draw call. Plain Canvas 2D would require 20k `fillRect` calls per frame. DOM (divs) would require 20k layout calculations.
- **Zustand over Redux** — minimal boilerplate, slices compose without reducers, `subscribe` API allows imperative updates from PixiJS without triggering React re-renders.
- **`useStore.subscribe` in TacticalMap** — PixiJS render loop is imperative; using `useStore` hook would cause React to re-render the component on every tick. `subscribe` bypasses React's render cycle entirely.
- **Ref-accumulator in PerfMonitor** — writing to state at 60fps would cause 60 React re-renders/second across the tree. Accumulating into a ref and flushing every 500ms keeps it to 2 re-renders/second.
- **TanStack Virtual for unit list** — rendering 20k list rows in the DOM is not viable; virtualisation renders only the ~15 visible rows at any time.
- **Delta-only wire format** — clients never re-fetch all 20k units. Each tick payload contains only the 200–350 changed units, keeping SSE message size to ~15–25 KB/tick.