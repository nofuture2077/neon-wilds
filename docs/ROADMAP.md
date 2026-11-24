# NEON WILDS — Development Roadmap

> Owner: Game Director and Technical Architect. Each milestone is independently playable and testable. After each one: run tests, do a code review, validate performance, record decisions, list remaining issues, and confirm the game is still playable.

| # | Milestone | Status | Deliverable |
|---|---|---|---|
| 1 | Playable foundation | **Done** | A playable character exploring a living Slums district |
| 2 | Creature gameplay | **Done** | Complete creature collection loop, plus local saves |
| 3 | Open-world sandbox | **Done** | Vehicles, traffic, police and wanted levels, factions, economy |
| 4 | Traditional game AI | **Done** | Living world: HSM and utility NPCs, memory, relationships, Wildling BTs, faction GOAP, simulation LOD |
| 5 | Story and content | **Done** (stretch goals open): six districts, full campaign with five endings, faction and character arcs, full roster ([review](reviews/M5.md)) | Playable campaign: Acts I–III, faction arcs, procedural missions, endings |
| 6 | Static release | **Done** (deploy waits for the first push) | No backend: the game ships as a static site on GitHub Pages, with local saves, save export and import, offline play |
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

## M4 — Traditional game AI ✅ ([review](reviews/M4.md))

Delivered: BT runtime, daily routines with utility AI, memory, gossip and relationships, crowds and level-of-detail, faction GOAP with operations and crews, world director (weather and events), procedural missions with a job board, objective waypoints, and the AI debug overlay. The city graph, Downtown and the routing polish move to M5.


Also carried over from M3: the multi-district city graph, Downtown (rotated grid plus a diagonal boulevard), pedestrian crowd density and car-ejection pedestrians, hierarchical road routing, and junction reservation.


Perception, memory records and gossip, relationship graph, needs and emotion, HSM and utility activity selection, BT runtime, daily schedules per role, Wildling BT profiles and populations, faction strategic layer (utility goals + GOAP operations) for Saints and Halcyon (then the others), world director (weather, events), mission generator prototype, AI debug overlay, week-long headless soak test.

**Exit:** NPCs keep schedules and react to and remember the player; two factions change territory autonomously; one faction changes behaviour in response to a world event; a generated mission is offered, completed and has consequences.

## M5 — Story and content (part 1 ✅, part 2 next)

Part 1 delivered: city graph and Downtown; branching choices; Acts I–III (7 story missions); Saints and Halcyon arcs; four endings with a state-built epilogue. Since then: Harbor and the Compact arc, the Industrial Zone and the Iron Chain arc, keyboard-only battles with auto-advancing text, and **world generation v4**: one seamless city on an irregular orthogonal street plan, with landmarks, avenues, alleys, plazas, parks and docks ([WORLD_GEN.md §8–9](WORLD_GEN.md)). Part 2 so far: **Old Town** and the **Verdant Choir arc** (*The Founders' Vault*: murals, the Vault, Thorn's sabotage, the Cantor's choice), five Old Town species, and an Old Town look and music mood; then the **Outskirts** (country lanes, forest, farmhouses) and the secret **Hollow** ending: eight founders’ murals across all six districts lead to Hollowstag, and the Glitchling evolves into the Resonant. Character arcs: **Vik** (five battles in all: noodles, the Spire rooftop and title night; friend and finale ally, or bitter foe on Halcyon chips), **Juno** (a stray Fizzlet and a recall drive), **Bram** (field readings and a tuning fork for the finale), and **Saltmaw**, the Harbor legend, at berth nine. The **full roster** is in: all 32 catalogued species plus the Glitchling, Resonant, Hollowstag and Saltmaw. **Faction questlines**: three missions per faction after its Act II arc, unlocked by reputation (Trusted, 20+) and ending in a champion finale: Saints (*Soup Run*, *The Grey Van*, *Hold the Line*), Halcyon (*Field Test*, *Rogue Asset*, *Internal Audit*: Varga can turn against the Trust), Compact (*Tunnel Run*, *Customs*, *The Midnight Auction*), Choir (*Pilgrimage*, *Open the Cages*, *Canticle*) and Iron Chain (*Picket Line*, *Strikebreakers*, *The Crooked Card*). Champions and Varga count as allies for The Chorus. **Gameplay-loop pass** (player feedback: *"what is the point of hijacking a car? how do I catch Wildlings? I don't get the loop"*): a first-time guide (one tip per situation, shown once and saved: catching, the job board, Snares, healing, driving, being wanted, each district), a "How to play" section under Controls, cars about 30% faster, Express courier jobs that need a car and pay double, a chop shop at the Scrapyard Exchange for stolen cars, and Co-op Index bounties at 5, 10, 15, 20, 25 and 30 species. Fast travel: the **Co-op shuttle** at the job board runs to every visited district (30₵). **Vignettes**: 40 authored street scenes placed per city with hours, extras, barks and small one-time rewards ([WORLD_GEN.md §10](WORLD_GEN.md)). M5 content is complete; stretch goals: more faction missions toward the planned 6–8 each, state dressing (L7), more vignettes toward ~150.


First: the multi-district city graph and Downtown (carried over from M3/M4), then the narrative.


Acts I–III, five faction arcs, branching dialogue trees, procedural mission templates (≥ 12 categories), world events, Old Town / Harbor / Outskirts districts, the remaining 22 species, at least three endings plus the secret ending, and the epilogue builder.

## M6 — Static release (GitHub Pages) ✅

*Replanned (ADR-026): there is no backend. The game is hosted as a static site on GitHub Pages and everything runs in the browser.*

- [x] `.github/workflows/pages.yml`: checks, a production build for the repository path (`BASE_PATH=/<repository>/`, or `/` for a `<user>.github.io` site) and a deploy on every push to `main`/`master`. One-time setup: Settings → Pages → Source: GitHub Actions.
- [x] Saves stay local (IndexedDB, three slots plus autosave, backups). **Export and import** of save files (JSON with a checksum) in the load menu, with a notice that saves live in the browser.
- [x] Offline play: a service worker (network-first for the page, cache-first for hashed assets, one cache per build), a web app manifest and icons; verified by reloading the production build offline.
- [x] Local statistics and 29 achievements in a Records tab, instead of online leaderboards.
- [x] Removed `apps/server`, the Dockerfile, `docker-compose.yml`, the Docker CI job, `.env.example`, `API.md` and `DATABASE.md`.
- [x] Credits screen with the font licences (SIL OFL 1.1, shipped under `licenses/`).
- [ ] Cross-browser smoke test (Firefox, WebKit) — only Chromium is automated so far.
- [ ] Choose a licence for the code and content (a project decision for the owner).

Bundle: ~660 kB game code + ~1.2 MB Phaser (about 530 kB gzipped in total).

**Exit:** a fresh visitor opens the GitHub Pages URL, plays, saves, reloads, exports the save, imports it in another browser and continues; the game loads and runs offline after the first visit.

## M7 — Polish

Audio (SFX, ambience, procedural music mixing and leitmotif variation), animation passes, battle VFX, weather FX, balancing, and the replacement art pipeline.

## Vertical-slice acceptance mapping

| Criterion | Milestone |
|---|---|
| Explore a functioning urban district | M1 ✅ (one seamless four-district city since M5) |
| ≥ 10 creatures encountered and captured; battles functional | M2 ✅ |
| NPC schedules, reactions, memory | M4 ✅ |
| ≥ 2 factions operate independently and change influence | M4 ✅ (GOAP) |
| Vehicles and traffic; police respond to crime | M3 ✅ |
| ≥ 5 playable missions; deterministic dynamic missions | M4 ✅ (3 handcrafted + 5 templates) |
| Save and reload | M2 ✅ (local) → M6 (save export and import) |
| Offline play without external services | M1 ✅ (by design) → M6 (service worker, static hosting) |
| Zero generative AI / LLM runtime dependencies | ✅ enforced in CI |
