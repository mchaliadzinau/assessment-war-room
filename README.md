# War Room
## Game logic
- **Attacking** — 35% of units selected per tick become attackers. Each attacks the nearest enemy within `UNITS_ATTACK_RADIUS`.

- **Capturing** — 6 circular zones by default (overridable via `.env`). Each tick, alive units inside each zone are counted:
    - **Empty** → no change.
    - **Contested** (both teams present) → `progress` decrements by `CAPTURE_CONTEST_PENALTY`, min 0.
    - **Uncontested** (one team only) → `progress` increments. Zone captured after `CAPTURE_TICKS` consecutive uncontested ticks.  

- **Healing** — idle units inside a friendly-owned zone are healed each tick after `HEAL_IDLE_TICKS` consecutive idle ticks.

## Setup

Run `nvm use` or install compatible NodeJS version (v22.12.0+)

### Server

```bash
cd server
npm install
npm run dev
```

Starts on **http://localhost:3001**. Configuration is read from `server/.env`:

```
TICK_INTERVAL_MS=1000      # simulation tick rate (ms)
UNITS_TOTAL=20000          # total units across both teams
# UNITS_TEAM_A_COUNT=10000 # team A unit count; defaults to half of UNITS_TOTAL
UNITS_PER_TICK=500         # units processed per tick (movement/attack/idle)
UNITS_PER_TICK_JITTER=150  # ± random variance on units-per-tick
UNITS_ATTACK_RADIUS=100    # max distance (battlefield units) for an attack to land
HEAL_IDLE_TICKS=3          # consecutive idle ticks before a unit begins healing
HEAL_AMOUNT=5              # HP restored per healing tick
BATTLEFIELD_W=2000         # battlefield width in simulation units
BATTLEFIELD_H=1000         # battlefield height in simulation units
CAPTURE_TICKS=5            # uncontested ticks required to capture a zone
CAPTURE_CONTEST_PENALTY=1  # progress decremented per tick while a zone is contested
```

All values have sensible defaults; you can run without editing `.env`.

### Client

```bash
cd client
npm install
npm run dev
```

Opens on **http://localhost:5173**. The Vite dev server proxies `/stream`, `/units`, `/zones`, and `/health` to `localhost:3001`, so no CORS configuration is needed.

> Start the server first, then the client.

---

## Running tests

```bash
# Server
cd server && npm test

# Client
cd client && npm test
```

---

## Architecture Decisions

This implementation is purpose-built for the given task, but with substantial headroom: up to 50,000 units at a 100ms tick on sufficiently powerful hardware. 
Beyond that, a spatial index and transport replacement (e.g. WebRTC) become necessary. 
Browser parallelisation via Web Workers is unlikely to yield meaningful gains — the bottleneck is thread communication overhead: typed arrays must either be copied (expensive) or transferred (the main thread loses access). At that scale a native application with a proper ECS is the more appropriate direction.

### Server
- ECS with bitecs — 20,000 units stored in flat typed arrays via bitecs. Zero per-entity heap allocation in the hot path. Component access is O(1) (Position.x[eid]). 
    - Each tick ±350 units are selected via Fisher-Yates partial shuffle; 35% become attackers, 50% movers, the rest idle.
    - `liveEntities` array — shared number[] of non-dead entity IDs. All systems iterate this instead of all 20k slots. Shrinks naturally as units die.
    - **Move system** — ~175 movers/tick. At 1s intervals each unit moves on average every ~114 ticks.
    - **Attack system** — most expensive per tick. 175–227 attackers each scan all live units: worst case 227 × 20,000 = 4.54M comparisons. Each comparison is arithmetic only. ~5ms of the 1,000ms tick budget (0.5%). Spatial index not necessary at this scale; straightforward to add later since systems are isolated.
    - **Capture system** — 6 zones × 20k units = 120k comparisons/tick. Negligible.
    - **Heal system** — only fires for IDLE units with ≥ HEAL_IDLE_TICKS consecutive idle ticks. Worst case 20k × 6 = 120k zone checks.

- Delta-only SSE — full snapshot sent once on connect. Each tick carries only changed units (200–350 UnitDelta entries, < 20 KB/tick).
- Ticker as EventEmitter — tick loop emits 'tick' events. Each tick wrapped in try/catch so one bad frame cannot kill the interval. SSE handler subscribes to the emitter; transport and simulation are fully decoupled.
- Zod validation — all query params validated at the edge. Cross-field hpMin/hpMax validation returns HTTP 400 before touching simulation state.

### Client
- PixiJS ParticleContainer — all 20,000 units rendered as sprites in one WebGL draw call per frame. DOM rendering explicitly avoided.
- Zustand with new Map references — `applyDeltas` always produces a new Map so useMemo and useStore.subscribe fire reliably. PixiJS subscriber bypasses React's render cycle; only KPIs and unit list trigger re-renders.
- TanStack Virtual — unit list renders ~15 rows at a time regardless of filtered subset size.
- ResizeObserver + autoDensity — canvas resizes via ResizeObserver; recalculates scale and repositions all particles in one pass. autoDensity: true with resolution: devicePixelRatio for sharp retina rendering.
usePerf at 2 Hz — FPS and heap sampled at 60 Hz into refs, flushed to the store every 500ms. At most 2 re-renders/second from the perf panel.
- No RegExp on user input — search uses String.prototype.includes(). new RegExp(userInput) is never called, eliminating ReDoS exposure.

