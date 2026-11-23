# NEON WILDS — Development Roadmap

> Owner: Game Director and Technical Architect. Each milestone is independently playable and testable. After each one: run tests, do a code review, validate performance, record decisions, list remaining issues, and confirm the game is still playable.

| # | Milestone | Status | Deliverable |
|---|---|---|---|
| 1 | Playable foundation | **Done** | A playable character exploring a living Slums district |
| 2 | Creature gameplay | **Done** | Complete creature collection loop, plus local saves |
| 3 | Open-world sandbox | **Done** | Vehicles, traffic, police and wanted levels, factions, economy |
| 4 | Traditional game AI | Next | Living world: HSM and utility NPCs, memory, relationships, Wildling BTs, faction GOAP, simulation LOD |
| 5 | Story and content | Planned | Playable campaign: Acts I–III, faction arcs, procedural missions, endings |
| 6 | Backend and persistence | Planned | Accounts, cloud saves, sync, leaderboards |
| 7 | Polish | Planned | Audio, animation, performance, UX, balancing, regression suite |

## M1 — Playable foundation ✅

- [x] Monorepo with npm workspaces, strict TypeScript, Vite, React, Phaser 3.90, Zustand, Tailwind 4, Fastify
- [x] Deterministic simulation package (seeded RNG, fixed step, snapshot/restore)
- [x] District generator: roads, crosswalks, sidewalks, alleys, park, 40+ buildings, landmarks, props
- [x] Player movement (walk/run, acceleration, wall sliding); tile collision; integer-zoom follow camera
- [x] 14 NPCs: A* wandering on the pedestrian network, ambient barks, conversations, shove reactions, grudges
- [x] Day/night lighting with neon, lamps and flicker; oblique ¾ buildings matching the art-direction target
- [x] Main menu, character creation (name and appearance with a live preview), HUD, dialogue, pause, controls
- [x] Keyboard and controller input (game and menus)
- [x] Tests (51), CI workflow, Dockerfile, no-AI guard, documentation set

## M2 — Creature gameplay ✅ ([review](reviews/M2.md))

1. Type chart, species and skill data; the 10-species subset (GDD §6.3) with procedural placeholder sprites.
2. Wildlings in the overworld: spawn zones per habitat and time; basic BT (idle, wander, flee, approach, sleep).
3. Encounter start (contact or lunge; sneak bonus); battle scene (Phaser) plus battle UI (React overlay).
4. Battle engine in `sim` (pure, seeded): turn order, damage, status, switching, items, flee, XP, levels, evolution.
5. Battle AI v1 (AI.md §5): expected-damage scoring, switching and healing thresholds, two difficulty tiers.
6. Capture (Snares, formula, shakes), party (6) and storage, Index screen, inventory, clinic healing.
7. **Local saves** (IndexedDB, 3 slots, autosave, versioning, checksum and backups). Moved forward from M6 so the creature loop is persistent (review decision R-M1-3).
8. Three playable missions: *Last Run* (story intro), *Binbandit Chase*, *Vik's First Challenge*.
9. Playwright smoke test in CI; balance spreadsheet for the type chart and stats.

**Exit criteria:** catch all 10 species; win and lose battles; evolve two lines; save, reload and continue identically; 60 FPS with 30 overworld Wildlings.

## Cross-cutting goals (added after M1)

- **Hybrid world generation**: authored bones plus procedural flesh, with organic non-grid streets, unique buildings, vignettes and state-driven dressing. See [WORLD_GEN.md](WORLD_GEN.md). Starts in M3.
- **Procedural synthwave soundtrack**: an algorithmic composer and Web Audio synthesiser, reactive to district, time, danger and battles. See [AUDIO.md](AUDIO.md). v1 in M3.

## M3 — Open-world sandbox ✅ ([review](reviews/M3.md))

Delivered: street generation v2 (organic grid), vehicles and traffic with signals, Wardens (witnesses, wanted levels, pursuit, arrests, resprays), factions with reputation and territory, a dynamic economy with a black market, and procedural synthwave music v1. Downtown and the multi-district city graph move to M4.

Original plan:

Multi-district city graph (Slums + Downtown + Industrial edges); spatial hash and simulation LOD L1/L2; route graph; vehicles (bicycle model, collisions, damage, entering and stealing); lane-graph traffic with intersections; pedestrian crowd density per district and time; witness pipeline; wanted levels 1–3 with Warden units; faction reputation; shops and price indices; black market; Gutter Saints and Halcyon presence in the world. **World gen 2.0** (vector street networks with organic grammars for Slums v2 and Downtown, lot subdivision, building grammar v1). **Music v1** (procedural synthwave, Slums night and battle moods).

**Exit:** steal a car, crash it, escape a 2-star pursuit; buy and sell with district price differences; reputation changes from actions; 200 entities in the district at 60 FPS.

## M4 — Traditional game AI

Also carried over from M3: the multi-district city graph, Downtown (rotated grid plus a diagonal boulevard), pedestrian crowd density and car-ejection pedestrians, hierarchical road routing, and junction reservation.


Perception, memory records and gossip, relationship graph, needs and emotion, HSM and utility activity selection, BT runtime, daily schedules per role, Wildling BT profiles and populations, faction strategic layer (utility goals + GOAP operations) for Saints and Halcyon (then the others), world director (weather, events), mission generator prototype, AI debug overlay, week-long headless soak test.

**Exit:** NPCs keep schedules and react to and remember the player; two factions change territory autonomously; one faction changes behaviour in response to a world event; a generated mission is offered, completed and has consequences.

## M5 — Story and content

Acts I–III, five faction arcs, branching dialogue trees, procedural mission templates (≥ 12 categories), world events, Old Town / Harbor / Outskirts districts, the remaining 22 species, at least three endings plus the secret ending, and the epilogue builder.

## M6 — Backend and persistence

Postgres + migrations, auth, account management, cloud saves with conflict resolution, offline queue and sync, statistics, leaderboards, OpenAPI docs, rate limiting, and Docker Compose with Postgres (and Redis only if justified).

## M7 — Polish

Audio (SFX, ambience, procedural music mixing and leitmotif variation), animation passes, battle VFX, weather FX, accessibility (rebinding, colour-blind-safe UI, text size), performance profiling and pooling, regression and visual tests, balancing, and the replacement art pipeline.

## Vertical-slice acceptance mapping

| Criterion | Milestone |
|---|---|
| Explore a functioning urban district | M1 ✅ |
| ≥ 10 creatures encountered and captured; battles functional | M2 ✅ |
| NPC schedules, reactions, memory | M1 (reactions, short-term grudge) → M4 |
| ≥ 2 factions operate independently and change influence | M3 ✅ (rules) → M4 (GOAP) |
| Vehicles and traffic; police respond to crime | M3 ✅ |
| ≥ 5 playable missions; deterministic dynamic missions | M2 ✅ (3) → M4/M5 |
| Save and reload | M2 ✅ (local) → M6 (cloud) |
| Offline play without external services | M1 ✅ (by design) |
| Zero generative AI / LLM runtime dependencies | ✅ enforced in CI |
