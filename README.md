# NEON WILDS

A browser-based, top-down open-world creature RPG: catch, raise and battle **Wildlings** while living on the edge of the law in **Vesper City**, a dense neon metropolis whose citizens, gangs and creatures all remember what you did.

Built with TypeScript, Phaser 3, React, Zustand and Tailwind. It runs entirely in the browser: no server, no account, playable offline after the first visit.

> **No runtime AI.** NEON WILDS uses no LLMs, generative AI or external inference. All NPC, faction, creature, battle and mission behaviour is conventional game AI: FSMs, hierarchical state machines, behaviour trees, utility AI, GOAP and A*. CI enforces this with `npm run lint:no-ai`.

## Status

**The full game is playable.** One seamless city with six districts (the Slums, Neon Downtown, the Harbor, the Industrial Zone, Old Town and the Outskirts), a three-act story with five endings (one secret), five faction questlines, character arcs, 36 Wildling species, 40 street scenes, and a first-time guide that explains the loop. Milestone 6 turns it into a static release on GitHub Pages; see [docs/ROADMAP.md](docs/ROADMAP.md).

## Play and deploy

The game is a static site. Every push to `main` or `master` runs the [Pages workflow](.github/workflows/pages.yml): tests, a production build for the repository's path (`https://<user>.github.io/<repository>/`) and a deploy. One-time setup: **Settings → Pages → Source: GitHub Actions**.

Saves live in the browser (IndexedDB, three slots plus an autosave, with backups). The load menu can export a save to a file and import it elsewhere. A service worker caches the game, so it keeps working offline.

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
| `npm test` | All unit tests (sim and client) |
| `npm run typecheck` | Strict TypeScript across all workspaces |
| `npm run build` | Production build of the static site (`apps/client/dist`; set `BASE_PATH=/repo/` for a subpath) |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Typecheck + tests + no-AI guard |
| `npm run e2e` | Browser smoke test against a running dev server (`CHROME_PATH` optional) |

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
docs/          design and architecture documents
scripts/       tooling (no-AI guard)
```

## Documentation

| Document | Purpose |
|---|---|
| [Game Design Document](docs/GDD.md) | Pillars, systems, creatures, combat, sandbox, progression |
| [World Design](docs/WORLD.md) | Vesper City, districts, factions, characters, story, endings |
| [Technical Architecture](docs/ARCHITECTURE.md) | Simulation/render split, determinism, LOD, persistence, static hosting |
| [Game AI Architecture](docs/AI.md) | Perception, memory, HSM + utility, BTs, GOAP factions, missions |
| [Domain Model](docs/DOMAIN_MODEL.md) | Core types, implemented and planned |
| [Asset Pipeline](docs/ASSET_PIPELINE.md) | Art direction, specs, manifest, replacement workflow |
| [Roadmap](docs/ROADMAP.md) · [Risks](docs/RISKS.md) · [Decisions](docs/DECISIONS.md) | Planning and ADRs |
| [World Generation](docs/WORLD_GEN.md) | Hybrid authored + procedural city (street plan, districts, vignettes) |
| [Procedural Soundtrack](docs/AUDIO.md) | Algorithmic synthwave composer and Web Audio synths |
| [M1](docs/reviews/M1.md) · [M2](docs/reviews/M2.md) · [M3](docs/reviews/M3.md) · [M4](docs/reviews/M4.md) · [M5](docs/reviews/M5.md) reviews | Test results, fixed bugs, known issues |

All characters, creatures, places, art and text are original.
