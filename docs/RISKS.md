# NEON WILDS — Risk Register

> Owner: Critical Reviewer · Reviewed every milestone. L = likelihood, I = impact (1–5).

| # | Risk | L | I | Mitigation | Status |
|---|---|---|---|---|---|
| R1 | **Scope.** A GTA-plus-creature-RPG-plus-living-world is enormous | 5 | 5 | Strict milestones with exit criteria; vertical slice before breadth; the 10-species subset; one district per milestone; cut lists per milestone | Active |
| R2 | **Determinism drift** (a stray `Math.random`, Map iteration, float order) breaks replays, save validation and tests | 3 | 4 | Simulation package has no DOM types; determinism and snapshot tests; lint rule banning `Math.random` and `Date` in `sim` (M2) | Mitigated (tests) |
| R3 | **Performance with hundreds of entities** in browser JS | 4 | 4 | Simulation LOD L1/L2/L3, spatial hash, staggered AI ticks, path budgets, pooling; benchmark in CI (M3) | Planned |
| R4 | **Phaser 3 is in maintenance** (Phaser 4 is current) | 3 | 2 | Phaser usage isolated in `apps/client/src/game` (no simulation logic); the renderer is replaceable; pinned to 3.90.0 | Accepted |
| R5 | **Bleeding-edge toolchain** (TypeScript 7, Vite 8, Vitest 5) may have ecosystem gaps | 3 | 2 | Lockfile committed; CI on Node 22; can fall back to TS 5.9 / Vite 7 without code changes | Watch |
| R6 | **Content volume** (32 species, 6 districts, dialogue trees) exceeds art and writing capacity | 4 | 4 | Procedural placeholders, data-driven content, reusable building kit, mission templates; prioritise the Slums plus 2 districts for the slice | Active |
| R7 | **Emergent systems produce incoherent outcomes** (generated missions that cannot be finished, faction death spirals) | 3 | 4 | Completability validation, invariants, week-long headless soak tests, clamps and recovery rules in the faction economy | Planned (M4) |
| R8 | **Save corruption or migration bugs** lose progress | 2 | 5 | Versioned envelope, checksum, rotating backups, migration tests against fixture saves | Mitigated (M2) |
| R9 | **Cloud-save conflicts and cheating** | 3 | 3 | Optimistic revisions, explicit conflict UI, server-side validation with the shared simulation, derived leaderboards | Planned (M6) |
| R10 | **Auth security** | 2 | 5 | argon2id, short JWTs, rotating refresh tokens with reuse detection, rate limits, no custom crypto | Planned (M6) |
| R11 | **React ↔ Phaser state desync** | 3 | 3 | Simulation is the single source of truth; UI only sends commands; one subscription point per concern | Mitigated |
| R12 | **Readability of the ¾ projection** (characters hidden behind buildings, door visibility) | 2 | 3 | Footprint-bounded facades (no overhang); back sides face alleys; focus chevron on doors | Mitigated |
| R13 | **Accidental AI dependency** (a contributor adds an LLM SDK) | 2 | 5 | `scripts/check-no-ai.mjs` in CI; rule in the README | Mitigated |
| R14 | **Software-rendered or low-end GPUs** | 2 | 3 | Canvas fallback (`Phaser.AUTO`); lighting works without shaders; measured 60 FPS under SwiftShader at 1280×800 | Mitigated |
| R15 | **Docker image not yet built in CI history** | 2 | 2 | CI docker job; the local daemon was unavailable during M1 | Open |
| R16 | **Procedural world feels generic or breaks story placements** | 3 | 4 | Authored anchors and overrides, validators (connectivity, interest curve, uniqueness budget), bake-and-pin tooling (WORLD_GEN.md) | Planned (M3) |
| R17 | **Procedural music sounds aimless or tiring; Web Audio CPU cost** | 3 | 3 | Authored leitmotifs and phrase forms, anti-repetition, intensity setting, lookahead scheduler, < 3% CPU budget (AUDIO.md) | Planned (M3) |
