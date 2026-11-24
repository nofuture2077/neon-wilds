# NEON WILDS — Technical Architecture

> Owner: Technical Architect · Authoritative. Changes require an entry in [DECISIONS.md](DECISIONS.md).

## 1. Goals and constraints

| Goal | Consequence |
|---|---|
| Runs in desktop browsers at 60 FPS | Fixed-step simulation, cheap rendering, simulation LOD, spatial partitioning |
| Fully playable offline | All gameplay is client-side; the game ships as a static site on GitHub Pages with no backend (ADR-026) |
| Deterministic, testable world | The simulation is a pure TypeScript package with seeded RNG, no wall clock and no rendering dependencies |
| No runtime AI or inference | Conventional game AI only; enforced in CI (`scripts/check-no-ai.mjs`) |
| Data-driven content | Districts, NPCs, dialogue, creatures and missions are typed data modules, separate from systems |
| Replaceable art | Code refers to texture keys; the manifest maps keys to procedural or file sources |

## 2. Repository layout

```
neon-wilds/
├─ packages/sim/        @neon-wilds/sim — deterministic game simulation (no DOM, no Phaser)
│  ├─ src/core/         rng, events, vector math, cloning
│  ├─ src/world/        tiles, tilemap, district generator, A*, location naming
│  ├─ src/physics/      tile collision (axis-separated swept AABB)
│  ├─ src/ai/           NPC brains (M1: FSM + reactions; grows into AI.md architecture)
│  ├─ src/content/      data: districts, NPC archetypes, NPC roster, dialogue
│  ├─ src/simulation.ts the Simulation facade: step(input), enqueue(cmd), drainEvents(), snapshot()
│  └─ test/             vitest: determinism, collision, pathfinding, generator, interactions
├─ apps/client/         @neon-wilds/client — Vite + React + Phaser 3 + Zustand + Tailwind
│  ├─ src/game/         Phaser: scenes, renderers, input mapping, procedural assets
│  ├─ src/ui/           React screens and overlays (menus, HUD, dialogue, pause)
│  └─ src/state/        Zustand store (UI state only; never the source of truth for the world)
├─ docs/                design and architecture documents
├─ scripts/             repo tooling (no-AI guard)
└─ .github/workflows/ci.yml (checks), pages.yml (GitHub Pages deploy)
```

npm workspaces, strict TypeScript everywhere (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`).

## 3. Runtime architecture (client)

```
 ┌──────────── React (DOM) ─────────────┐        ┌────────── Phaser.Game ───────────────────┐
 │ MainMenu · CharacterCreation · HUD   │        │ BootScene: manifest → textures           │
 │ DialogueBox · PauseMenu · (M2+ menus)│        │ WorldScene (owns the frame loop):        │
 │          ▲ subscribe       │ actions │        │   InputMapper → PlayerInput              │
 │          │                 ▼         │        │   accumulator → sim.step() × N (60 Hz)   │
 │      Zustand store (UI state)  ◄─────┼─events─┤   sim.drainEvents() → store / FX         │
 │                                 ─────┼─cmds──►│   render(interpolation α)                │
 └──────────────────────────────────────┘        └───────────────┬──────────────────────────┘
                                                                  │ owns
                                                   ┌──────────────▼──────────────┐
                                                   │ @neon-wilds/sim Simulation  │
                                                   │ state + systems + content   │
                                                   └─────────────────────────────┘
```

- **Phaser owns the game loop and the world rendering.** `WorldScene.update()` runs a fixed-timestep accumulator (`DT = 1/60`, at most 0.25 s of catch-up per frame), steps the simulation, drains events, and renders with interpolation between the previous and current simulation states.
- **The simulation is authoritative** and lives in `@neon-wilds/sim`. It runs *inside* Phaser's loop but does not depend on Phaser. See [DECISIONS.md, ADR-002](DECISIONS.md) for why this is preferred over Arcade Physics and game objects as the source of truth.
- **React never renders the world.** It renders menus and overlays above the canvas, reads UI state from Zustand, and sends intent back: closing a dialogue becomes the `endDialogue` command through a store subscription.
- **Communication contract:**
  - In: `PlayerInput` (analog move, run, edge-triggered interact) and `SimCommand` (UI-originated intents, queued and applied at the start of the next step).
  - Out: `SimEvent` (plain serialisable data: `dialogue.opened`, `bark`, `npc.shoved`, `building.inspected`, `clock.hour`, …).
  - State reads for rendering are read-only by convention. M2 adds a `ReadonlyDeep` view type.
- **Input:** `InputMapper` maps keyboard and gamepad (standard mapping) to abstract actions. Edge-triggered keys are latched from `keydown` events, because Phaser's `JustDown` drops taps shorter than one frame. React menus get controller navigation through `useGamepadNav`.

## 4. Simulation design

### 4.1 Determinism rules

1. No `Math.random`, `Date`, `performance.now` or DOM APIs inside `packages/sim`. TypeScript `types: []` keeps DOM types out.
2. All randomness comes from `Rng` (mulberry32; state is a single uint32). Independent streams come from `deriveSeed(seed, label)`.
3. Fixed step `DT`. Time of day is derived from ticks.
4. Iteration order is the array order, which is creation order. Maps keyed by id are never iterated for decisions.
5. State is plain JSON-safe data. `snapshot()` / `fromSnapshot()` round-trip exactly, as the tests prove.
6. The district layout is not saved. It is regenerated from `(seed, districtId)`, which is deterministic and tested.

Tests assert that two runs with the same seed and inputs produce byte-identical snapshots, and that a run restored from a snapshot continues identically.

### 4.2 Entities and systems ("ECS-inspired", not a full ECS)

The world uses typed entity records (`PlayerState`, `NpcState`, later `WildlingState`, `VehicleState`) in arrays per kind, updated by system functions in a fixed order:

```
commands → [battle active? stop] → clock → player movement → NPC brains → Wildling spawns (2 Hz) →
Wildling behaviour → vehicles (player / AI / police) → law → contacts/shoves → vehicle contacts →
wild encounters → focus → interaction → ambient barks          (+ hourly: faction strategy, market)
```

Modules added in M3: `world/roads.ts` (lane model, junctions, signals), `world/vehicles.ts` (classes, physics, traffic AI, pursuit), `law/law.ts` (witnesses, heat, police, arrests), `factions/territory.ts` (influence, strategy tick, prices, black market). Client: `audio/` (composer, synth rack, scheduler, music director).

M3 inserts: player driving → AI traffic and police → vehicle contacts → law (witness reports, heat, police units, officers, arrests), and runs the faction strategy and market recovery on every in-game hour.

Battles, missions and progression live in the same package: `battle/` (engine, formulas, AI), `missions/` (runtime + effect DSL), `progression.ts`, and `views.ts` (read-only UI projections such as `battleView` and `progressView`).

Milestones add, in this order: perception → memory → wildlings → vehicles/traffic → wanted → factions (hourly) → economy (hourly) → missions.

A full archetype ECS is rejected for now (ADR-003): with fewer than about 1000 entities per kind, struct-of-arrays gives no measurable benefit in JS, and typed records are far easier to save, test and debug. Hot paths such as collision and pathfinding already use typed arrays.

### 4.3 World representation

- **Tile grid** (`TileMap`): a `Uint8Array` of ground kinds plus a derived `blocked` collision layer that includes solid props. 1 tile = 16 px of reference art; the simulation works in tile units.
- **District generator:** GTA-style road grid → blocks with sidewalk rings → lots (buildings, courts, alleys) and parks; crosswalks connect blocks; props (parked cars, lamps, benches, dumpsters). Named landmarks come from data; everything else is seeded. Invariants are tested: a single connected pedestrian network, reachable entrances, and no props on crosswalks.
- **Chunking (M3):** districts are already self-contained layouts. The city becomes a graph of districts connected by edge portals (bridges, tunnels, highway ramps). Only the current district (plus a border strip of its neighbours) is instantiated in Phaser; tilemap layers are built per 32×32 chunk and culled.

### 4.4 Physics and collision

Axis-separated swept AABB versus the tile collision layer (`moveAndCollide`) gives wall sliding and no tunnelling (moves are sub-stepped at ≤ 0.45 tiles). Actor-to-actor contact uses circle overlap resolution. Vehicles (M3) use a kinematic bicycle model with oriented-box collision against tiles and actors, resolved inside the simulation.

### 4.5 Simulation LOD and scale (M3–M4)

| Level | Scope | Update | Representation |
|---|---|---|---|
| **L1** Nearby | ≤ ~40 tiles from the player (camera plus margin) | Every tick (60 Hz) movement; AI decisions at 10 Hz, staggered | Full: A* paths, steering, perception, collisions |
| **L2** District | Same district, outside L1 | 1 Hz, staggered by entity id | Moves along a precomputed **route graph** (intersections and POIs) with interpolated positions; schedule-driven; no tile collision |
| **L3** Distant | Other districts | Hourly (game time) aggregate | Populations, faction influence, economy and incident counters; no individual entities |

Entities are promoted and demoted at radius boundaries with hysteresis, keeping identity, memory and schedule state. Promotion snaps an L2 entity to the nearest walkable tile on its route. L3 incidents (a gang fight in the Harbor) are resolved by deterministic formulas and leave traces (news, rumours, territory changes) that become visible when the player arrives.

**Spatial partitioning:** a uniform-grid spatial hash (8×8-tile cells) for neighbour and perception queries, rebuilt incrementally on cell change. **Pathfinding budget:** at most N A* searches per tick (M1: 4) with node caps. Long trips use hierarchical routing (route graph first, then A* only to the next waypoint). Paths are cached per (from-cell, to-POI).

**Pooling:** Phaser views for NPCs, vehicles and Wildlings are pooled and bound to simulation entities when they enter L1 and released when they leave. Bark texts and FX are pooled too.

**Targets:** 300+ simulated entities per district (≤ 60 at L1), simulation step ≤ 2 ms p95, render ≤ 8 ms p95 on a 2020 integrated GPU.

## 5. Rendering

- Phaser 3.90 with `type: AUTO` (WebGL, falling back to Canvas), `pixelArt: true`, `roundPixels`, and integer camera zoom (about 16 tiles of vertical view) for crisp pixels at any window size.
- **Projection:** oblique ¾ top-down. Building footprints are split into a roof (seen from above) and a south-facing facade, so art never spills outside collision footprints. A full isometric renderer remains possible later as a renderer-only change.
- Layers: ground tilemap → props → shadows → actors → buildings → canopies → night overlay → additive glows → focus marker → barks.
- **Lighting:** a translucent night overlay driven by a time-of-day curve (with a violet haze even at noon), plus additive glow sprites for lamps, neon signs, shopfronts, windows and trim, some with flicker. Works with both renderers. Weather (rain particles, puddle reflections, fog) arrives in M4.
- Simulation state is interpolated (`prev + (cur − prev) × α`) so 120/144 Hz displays stay smooth.

## 6. Persistence

| Layer | Milestone | Technology | Notes |
|---|---|---|---|
| Local saves | M2 ✅ | IndexedDB (thin wrapper, no dependency) | Multiple slots, autosave on district change and every 5 minutes, `SimSnapshot` with `version`, CRC32 checksum, and the last 3 rotating backups for corruption recovery |
| Save migrations | M2 ✅ | `migrations[v] → v+1` pure functions (`packages/sim/src/migrations.ts`) | Tested against fixture saves from every released version |
| Save export and import | M6 | JSON file with checksum | Replaces cloud saves (ADR-026): players move and back up saves themselves |
| Settings | M2 | `localStorage` | — |

## 7. Backend

- Fastify 5, pino structured JSON logging, configuration validated at startup (`src/config.ts`), and graceful shutdown.
- Hosting: GitHub Pages. `.github/workflows/pages.yml` runs the checks, builds with `BASE_PATH=/<repository>/` and deploys `apps/client/dist`. `public/sw.js` caches the build for offline play (network-first for the page, cache-first for hashed assets, one cache per build id); `public/manifest.webmanifest` makes it installable. The Fastify server and Docker setup were removed in M6 (ADR-026).
- M6 (replanned, ADR-026): no backend. The client is built to static files and deployed to GitHub Pages by GitHub Actions; a service worker caches it for offline play. Accounts, cloud saves and leaderboards are dropped.
- No WebSockets or other network services are planned.

## 8. Testing and quality

| Layer | Tooling | What |
|---|---|---|
| Simulation unit and property tests | vitest | RNG, A*, collision, generator invariants for several seeds, determinism, snapshot round-trip, interaction flows |
| Client unit tests | vitest | Store logic (dialogue paging, HUD de-duplication) |
| Browser e2e smoke | `e2e/smoke.mjs` (playwright-core), CI job `e2e` | New game → mission → trainer battle → capture → save → continue; asserts no console errors and FPS |
| Static | `tsc` strict, no-AI guard | — |

CI (GitHub Actions) runs typecheck, tests, build, the no-AI guard, the browser smoke test and the visual regression test (five frozen city views, `?quickstart&freeze`, compared pixel by pixel with committed baselines; more than 0.5% changed pixels fails and writes a diff image); the Pages workflow deploys.

## 9. Configuration and environments

Build-time setting: `BASE_PATH` (the site path, e.g. `/neon-wilds/`; default `/`). There are no runtime secrets or services. The client reads `import.meta.env.*` only for build-time flags. Dev-only helpers (`?quickstart`, `window.__NEON_WILDS__`) are guarded by `import.meta.env.DEV` and removed from production builds.
