# NEON WILDS

A browser-based, top-down open-world creature RPG: catch, raise and battle **Wildlings** while living on the edge of the law in **Vesper City**, a dense neon metropolis whose citizens, gangs and creatures all remember what you did.

Built with TypeScript, Phaser 3, React, Zustand, Tailwind and Fastify.

> **No runtime AI.** NEON WILDS uses no LLMs, generative AI or external inference. All NPC, faction, creature, battle and mission behaviour is conventional game AI: FSMs, hierarchical state machines, behaviour trees, utility AI, GOAP and A*. CI enforces this with `npm run lint:no-ai`.

## Status

**Milestone 4, Traditional Game AI, is complete.** NPCs follow daily routines, remember and gossip about what you do, and react accordingly. Halcyon and the Gutter Saints plan operations you can see and disrupt. Weather and world events change the night, and a job board generates missions. On top of M3: Explore a procedurally laid-out neon Slums at night and play the opening mission *Last Run*. Bond with the Glitchling and catch 10 species of Wildlings in turn-based battles. Steal cars and drift through signal-controlled traffic. Outrun the Wardens, or get busted. Pick a side as the Gutter Saints and Halcyon fight over the blocks around you. The synthwave soundtrack is composed live by an algorithm. See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next: M5 brings the city graph, Downtown and the story campaign.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

Dev shortcut: `http://localhost:5173/?quickstart&seed=1337&time=22:30` skips the menus. In dev builds, F3 toggles the AI debug overlay and `window.__NEON_WILDS__` exposes the simulation.

**Where do I go?** The objective panel (top left) says what to do and which street it's near. A yellow marker bounces over the target, and an arrow at the screen edge points to it when it's off screen. The pause menu's Map tab shows every objective.

| Command | What it does |
|---|---|
| `npm run dev` | Client dev server (Vite, HMR) |
| `npm run dev:server` | API server in watch mode (port 3000; Vite proxies `/api`) |
| `npm test` | All unit tests (sim, client, server) |
| `npm run typecheck` | Strict TypeScript across all workspaces |
| `npm run build` | Production build of client and server |
| `npm run check` | Typecheck + tests + no-AI guard |
| `npm run e2e` | Browser smoke test against a running dev server (`CHROME_PATH` optional) |
| `docker compose up --build` | Full stack on http://localhost:3000 (server serves the built client) |

Requires Node ≥ 22.

## Controls

| Action | Keyboard | Controller |
|---|---|---|
| Move | WASD / arrows | Left stick / d-pad |
| Run | Shift | B / RT |
| Talk / interact / advance | E / Space / Enter | A |
| Enter / exit vehicle | F | Y |
| Drive (accelerate / brake / steer), handbrake | W / S / A D, Shift | Stick, B / RT |
| Pause menu (party, bag, index, journal, save) | Esc | Start |
| Menus | Arrows + Enter, Esc to go back | D-pad + A, B to go back |

## Repository

```
packages/sim   deterministic game simulation (rules, AI, content); no DOM, no Phaser
apps/client    Phaser world rendering + React UI
apps/server    Fastify backend (health now; accounts and cloud saves in M6)
docs/          design and architecture documents
scripts/       tooling (no-AI guard)
```

## Documentation

| Document | Purpose |
|---|---|
| [Game Design Document](docs/GDD.md) | Pillars, systems, creatures, combat, sandbox, progression |
| [World Design](docs/WORLD.md) | Vesper City, districts, factions, characters, story, endings |
| [Technical Architecture](docs/ARCHITECTURE.md) | Simulation/render split, determinism, LOD, persistence, backend |
| [Game AI Architecture](docs/AI.md) | Perception, memory, HSM + utility, BTs, GOAP factions, missions |
| [Domain Model](docs/DOMAIN_MODEL.md) | Core types, implemented and planned |
| [Database Schema](docs/DATABASE.md) | PostgreSQL schema and save conflict resolution |
| [API Specification](docs/API.md) | REST endpoints |
| [Asset Pipeline](docs/ASSET_PIPELINE.md) | Art direction, specs, manifest, replacement workflow |
| [Roadmap](docs/ROADMAP.md) · [Risks](docs/RISKS.md) · [Decisions](docs/DECISIONS.md) | Planning and ADRs |
| [World Generation](docs/WORLD_GEN.md) | Hybrid authored + procedural city (organic streets, vignettes) |
| [Procedural Soundtrack](docs/AUDIO.md) | Algorithmic synthwave composer and Web Audio synths |
| [M1](docs/reviews/M1.md) · [M2](docs/reviews/M2.md) · [M3](docs/reviews/M3.md) · [M4](docs/reviews/M4.md) reviews | Test results, fixed bugs, known issues |

All characters, creatures, places, art and text are original.
