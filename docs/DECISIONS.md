# Architecture Decision Records

Short-form ADRs. Status: Accepted unless noted.

### ADR-001 — Monorepo with a renderer-agnostic simulation package
**Context:** We need determinism, headless tests and server-side save validation. **Decision:** `packages/sim` holds all game rules and state; the client and server depend on it. **Consequences:** clear boundaries; the simulation runs under Node and in CI; the renderer can be replaced.

### ADR-002 — Phaser owns the loop and rendering; custom simulation physics instead of Arcade Physics
**Context:** The brief asks Phaser to "own the game loop, rendering, entities, collision and simulation". Arcade Physics bodies are frame-rate coupled, not serialisable, and not testable headlessly. **Decision:** Phaser's scene `update` drives a fixed-step simulation from `@neon-wilds/sim`, which does its own tile collision and movement. Phaser game objects are views. **Consequences:** deterministic replays and save validation; small duplication of physics logic (accepted); Phaser stays the engine for loop, input, cameras, rendering, audio and tweens.

### ADR-003 — ECS-inspired typed records, not a full ECS library
**Context:** "Modular ECS-inspired architecture". **Decision:** typed entity records in arrays plus ordered system functions; typed arrays for hot grids. **Consequences:** trivial serialisation and debugging; we revisit only if profiling shows entity iteration as a bottleneck at more than about 1000 entities.

### ADR-004 — Events out, commands in
The simulation emits plain `SimEvent`s and accepts `PlayerInput` plus queued `SimCommand`s. UI and FX never mutate state. This keeps the simulation authoritative and replayable.

### ADR-005 — Procedural placeholder art behind a key-based manifest
Original art from code until real assets exist. Swapping to files is a manifest change.

### ADR-006 — Defer PostgreSQL and Redis until Milestone 6
The game is offline-first; idle services add operational cost without value. Schema and API are specified now (DATABASE.md, API.md). Redis only if a measured need appears.

### ADR-007 — Oblique ¾ top-down projection (not isometric)
**Context:** The director shared an isometric neon city as the art target; the brief specifies a GTA 2 perspective. **Decision:** keep grid-aligned top-down gameplay, with buildings drawn as roof plus south facade inside their footprints, and dense neon signage, windows, billboards and violet lighting to reach the target mood. **Consequences:** simple collision and pathfinding, readable driving later; isometric remains possible as a renderer-only change thanks to ADR-001.

### ADR-008 — Input latching from DOM key events
Phaser's `JustDown` loses presses shorter than one frame, which the M1 browser smoke test caught. Edge actions (confirm, pause) are latched from `keydown` events in `InputMapper`.

### ADR-009 — No runtime AI, enforced mechanically
All NPC, faction, Wildling, battle and mission logic uses conventional techniques (AI.md). CI fails on LLM SDK dependencies or AI API hosts.

### ADR-010 — Battle presentation: one log, two renderers
The battle engine returns an ordered `BattleLog`. The React store plays it back message by message; each non-text entry is also emitted on the `battleFx` channel, which the Phaser `BattleScene` animates. Neither side decides anything, so text, HP bars and animation cannot disagree.

### ADR-011 — Local saves in IndexedDB without a wrapper library (moved from M6 to M2)
About 100 lines of promise wrapper; envelope with version, CRC-32 and 2 rotating backups. Snapshot migrations are pure functions in `@neon-wilds/sim` so the server can reuse them in M6.

### ADR-012 — Missions as data with an effect DSL
Missions declare objectives (`inspect`, `talk`, `defeat`, `resolve-tag`) and effects (`message`, `give-item`, `spawn-npc`, `start-trainer-battle`, `spawn-quest-wildling`, …). The runtime is ~100 lines and fully deterministic, and the same vocabulary will drive procedural mission templates (AI.md §8).

### ADR-013 — The overworld freezes during turn-based battles
`Simulation.step` only processes commands while a battle is active. This avoids unfair world events mid-battle and keeps battles replayable. World time pauses during battles.

### ADR-014 — Organic grid via a matching of merged blocks
Street generation v2 removes interior road segments only as a *matching* in the block-adjacency graph (each block merges at most once). Removing a matching of dual edges cannot create a cycle of removed edges, so the primal road graph stays connected. This is tested across seeds. Free-angle streets remain the M4/M5 goal (WORLD_GEN.md).

### ADR-015 — Vehicles are simulated in `@neon-wilds/sim`
Same reasons as ADR-002: determinism, saves and headless tests. Bodies use two circles for vehicle/vehicle and vehicle/actor contacts and sampled OBB points against tiles; the player car has a lateral-slip model for drifting. Phaser only renders.

### ADR-016 — Crimes need witnesses
Wanted levels come from what the Wardens know: direct police sight, or civilian calls after a delay. This makes stealth, timing and faction ties (the Saints never call) meaningful, and replaces "global instant wanted level" designs.

### ADR-017 — Procedural music: pure composer + Web Audio rack
The composer is a pure, seeded function (mood, bar) → note events, unit-tested in Node. The engine only schedules and synthesises. No samples and no AI; leitmotifs are handwritten.

### ADR-018 — Behaviour trees as data with path-keyed memory
Trees are plain objects; running state is a `Record<string, number>` keyed by node path on the agent, so a half-finished activity survives save/load and stays deterministic.

### ADR-019 — Relationships are derived from memories
Trust, fear, affection and respect are computed from salience-weighted memory records (rumours count half), not stored separately. One source of truth; decay and gossip automatically change how NPCs feel.

### ADR-020 — Factions plan with GOAP, act through operations
Goals are chosen by utility; plans come from a depth-limited A* over boolean facts. Each step is an operation that lasts hours, spawns crews and moves influence, so strategy is visible and interruptible by the player.

### ADR-021 — Generated missions are data in the save
Generated `MissionDef`s live in progression (bounded: only offered or known missions are kept), so saves replay exactly and the runtime treats generated and handcrafted missions the same way.
