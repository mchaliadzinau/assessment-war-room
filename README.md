# War Room
## Game logic
### Attacking
- Each tick 35% of updated units per tick become attackers. Nearest enemy unit is selected (within UNITS_ATTACK_RADIUS) and receives damage.
### Capturing
- For each zone, count alive units inside its radius (be default 6 circular zones are precreated based on hardcoded logic and size of the battlefield but can be overriden in `.env`).
- If **No units present** → no change to progress or ownership.
- If **Contested** (there are units of both teams) → `progress` decrements by CAPTURE_CONTEST_PENALTY, min 0.
- If **Uncontested** (exactly one team present): that team is dominant. Team need to remain dominant for CAPTURE_TICKS to become the owner of the zone.
### Healing
- Units that remain idle for several consecutive ticks while inside a zone captured by their own team are healed each tick.

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

### Server

- **ECS with bitecs** — 20,000 units are stored in flat typed arrays (`Float32Array`, `Int32Array`, avoids strings in ECS) via the bitecs entity-component system. Zero per-entity heap allocation in the hot path. Access: `Position.x[eid]` → O(1). This keeps GC pressure negligible and tick throughput high even at 10 Hz. Each tick ±350 units are selected for update, 35% becomes attackers, 50% moves and the rest becomes idle (the distribution is uniform thanks to Fisher-Yates shuffle):
    - Move system: with 20,000 live units and 50%(~175) movers per tick at 1s intervals, each unit gets a move turn on average every ~114 seconds. 
    - Attack system is the most resource heavy one (most comparisons per tick of any system) but it should run well at 1s tick:
      O(n) scan for attack target lookup is ~3.5–4.5M comparisons/tick. Only 35% of `UNITS_PER_TICK` (500) become attackers — 175–227 per tick depending on jitter. Each scans all live units: 227 × 20,000 = 4.54M comparisons worst case. A single comparison is just arithmetic + one `Math.sqrt`. Modern JS engines execute these at roughly 1 billion simple operations per second; spending ~5ms of the 1,000ms tick budget on this is 0.5%.
      Optimizations like Spatial Index is not necessary at this point, but should be relatively easy to implement given that systems are isolated.
    - Capture system's zone membership check (6 × 20k = 120k comparisons) is an order of magnitude cheaper than the Attack system.
    - Heal system: the inner zone loop (6 iterations) only fires for units that are IDLE and have accumulated ≥ HEAL_IDLE_TICKS consecutive idle ticks. In the worst case all 20,000 units idle and eligible: 20,000 × 6 = 120,000 zone distance checks.
- **`liveEntities` shared array** — a single mutable `number[]` holds every non-dead entity ID. All three systems (move, attack, idle/heal) iterate over this instead of scanning all 20k slots each tick. When a unit dies, the attack system splices it out immediately, keeping the iteration set small as the battle progresses.

- **Delta-only SSE transport** — on connect the client receives a full snapshot (~20k units, sent once). Every subsequent tick carries only the 200–350 entity IDs whose state actually changed (`UnitDelta[]`). This keeps the per-tick payload well under 20 KB regardless of unit count.

- **Ticker as EventEmitter** — the 1 Hz tick loop lives in a dedicated `Ticker` class that emits `'tick'` events. Each tick is wrapped in try/catch so a single bad frame cannot kill the interval. The SSE handler simply subscribes to the emitter; transport and simulation are fully decoupled.

- **Zod input validation** — all query parameters (filter endpoints, SSE params) are validated with Zod schemas. `hpMin`/`hpMax` cross-field validation returns HTTP 400 before touching simulation state.

### Client

- **PixiJS ParticleContainer** — all 20,000 units are rendered as `PIXI.Particle` sprites in a single `ParticleContainer`, which issues one WebGL draw call per frame. DOM rendering for map dots is explicitly avoided; at this scale it would be unusable.

- **`ResizeObserver` + `autoDensity`** — canvas sizing is driven by a `ResizeObserver`: on every resize it calls `app.renderer.resize`, then recalculates `scaleX`/`scaleY` and repositions all particles in one pass. `autoDensity: true` combined with `resolution: devicePixelRatio` produces sharp rendering on retina displays.

- **Zustand store with new Map references** — `applyDeltas` always produces a `new Map(state.units)` so both React `useMemo` hooks and PixiJS's `useStore.subscribe` fire reliably on every tick. The PixiJS subscriber bypasses React's render cycle entirely — only KPI counts and the unit list trigger React re-renders.

- **TanStack Virtual for the unit list** — the 20k-row list renders only ~15 rows at a time. Filtering and sorting are applied inside a `useMemo`; the virtualiser never sees more rows than the filtered subset.

- **`usePerf` at 2 Hz** — FPS and heap samples are accumulated into refs at 60 Hz but flushed to the Zustand store only every 500 ms. This means the perf panel causes at most 2 React re-renders per second instead of 60.

- **No RegExp on user input** — the unit search filter uses `String.prototype.includes()` throughout. `new RegExp(userInput)` is never called, eliminating ReDoS exposure.
