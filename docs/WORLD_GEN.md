# NEON WILDS — Hybrid World Generation ("Authored Bones, Procedural Flesh")

> Owners: World Designer and Technical Architect · Goal added after Milestone 1 · Status: **v2 organic grid shipped in M3** (varied blocks, superblocks, courtyards, squares, state dressing for territory). Next: city graph and Downtown (M4), free-angle grammars (M5), tuning (M7)
>
> **Goal:** a Vesper City that feels **handmade, unique, non-repetitive, organic (not a square grid) and alive**. It combines preplanned, authored structure with deterministic procedural content. Everything is conventional, seeded procedural generation: no generative AI.

## 1. Why not a pure grid, and why not pure procedural

M1's generator is a clean block grid: perfect for proving systems, but every street looks like every other one. Pure procedural cities have the opposite problem: they are endless but forgettable, and stories cannot rely on them. We take the approach used by the best open worlds: **authors decide what matters, generators fill what doesn't, and validators guarantee it all works.**

## 2. The layer pipeline

Each layer is deterministic: `layer(n) = f(authored data, seed, layer(n−1))`. Every layer can be **overridden by hand**, and overrides survive regeneration.

| # | Layer | Authored | Procedural | Output |
|---|---|---|---|---|
| L0 | **Macro map** | Coastline, river and canals, district polygons, elevation zones, highway and rail corridors | — | City outline and district regions |
| L1 | **Anchors** | Landmarks, story sites, faction HQs, set-piece blocks (hand-built in an editor), named arterial routes as splines | Jitter within tolerance zones | Fixed points the generator must respect |
| L2 | **Street network** | Per-district *street grammar* (see §3) | Road growth: tensor-field streamlines + local rules (snap, merge, dead ends, roundabouts, plazas) seeded from arterials | Planar road graph with widths, kinds and names |
| L3 | **Blocks and lots** | Zoning hints (dense, industrial, park, waterfront) | Block faces extracted from the graph → lot subdivision (oriented-bounding-box splits, frontage-aware) → courtyards, alleys, vacant lots | Lots with frontage direction |
| L4 | **Buildings** | District style guides; hero facades | **Building grammar**: footprint × height × facade kit (ground-floor type, window rhythm, signage, fire escapes, roof clutter) × wear | Unique building per lot |
| L5 | **Dressing** | Prop palettes per district and zone | Poisson-disk placement with rules (lamps every 6–9 m along frontage, dumpsters in alleys, cars on curbs, puddles in low spots); wave-function collapse for small details (paving patterns, graffiti clusters) | Props and decals |
| L6 | **Vignettes** (life) | ~150 authored micro-scenes (a street market, a broken-down van with a mechanic, a graffiti crew, a Wildling nest, a Saints soup line, a busker with a Fizzlet) with placement conditions | Weighted placement by context (zone, time, faction control, events) with a per-region uniqueness budget | Living set dressing with NPCs and Wildlings |
| L7 | **State dressing** (dynamic) | Rules per world state | Applied at runtime from simulation state: faction graffiti and colours on controlled blocks, shuttered shops after raids, blackout darkness, flood puddles, Halcyon posters spreading through the Slums | The world visibly reacts |

## 3. Non-square streets: district street grammars

The simulation keeps its fast tile grid (collision, A*, sidewalks). Geometry is generated as **vectors** and **rasterised** to tiles. Roads may run at any angle; the renderer draws them from vector data, so they look smooth, not staircased.

| District | Street grammar | Feel |
|---|---|---|
| Slums | Organic grid: jittered, slightly bent streets; narrow alleys; dead ends; triangular lots where the grid meets the canal | Cramped, improvised |
| Neon Downtown | Strict rotated grid plus one diagonal boulevard; wide avenues; plazas at intersections | Planned, imposing |
| Industrial | Large superblocks following rail spurs; long straight service roads; yards | Sparse, heavy |
| Old Town | Radial and medieval: streets radiating from the cathedral, curving lanes, stairs, squares | Mysterious, disorienting |
| Harbor | Follows the coastline: piers as dead-end spurs, quays, container stacks as canyons | Linear, exposed |
| Outskirts | Curvilinear suburbs, cul-de-sacs, a broken highway loop, forest swallowing the edges | Lonely, wild |

**Seams between districts** are authored transition zones (a bridge, a tunnel mouth, a rail underpass, a market street) so grammars meet believably instead of colliding.

**Buildings and projection:** buildings align to their street frontage. For the oblique ¾ renderer, footprints are rotated to the nearest supported orientation (0°, ±15°, ±30°, 45° kits). Free-angle buildings arrive with the building kit's prerendered rotations, where needed (M7).

## 4. Uniqueness and anti-repetition

- **Combinatorial kits:** each building composes about 8 independent choices (footprint shape, height, ground floor, window rhythm, signage set, roof set, wear, colour), giving tens of thousands of combinations per district style.
- **Uniqueness budget:** no identical facade signature within a 40-tile radius; no repeated vignette within one district per in-game day.
- **Interest curve:** a validator measures *points of interest per 30 seconds of travel* along every road (landmarks, vignettes, shops, views, Wildling habitats) and inserts filler vignettes or flags gaps for authors.
- **Named everything:** procedural streets, shops and buildings get names from district naming grammars (e.g. Slums: `<surname>'s <trade>`; Old Town: `<saint> <street-type>`). Authored names always win.
- **Landmark visibility:** every district has 2+ tall or bright landmarks visible from far away (towers, signs, cranes) for orientation.

## 5. Alive

- Vignettes carry their own small behaviour trees and schedules (the market sets up at 18:00 and packs up at 02:00).
- Habitats come from geometry: puddle-collecting low spots spawn Puddlefin, warm vents attract Cindertail, overgrown lots grow Cracksprout.
- State dressing (L7) makes faction wars, blackouts and the player's actions visible on the streets themselves.
- Weather wear: wet surfaces reflect neon; graffiti accumulates and is painted over; abandoned cars rust over days.

## 6. Determinism, saves and tooling

- World = `generate(authoredData, worldSeed)` + **delta log** (destroyed props, changed dressing, ownership). Saves store only the seed, the authored-data version and the deltas.
- **Validation suite** (extends M1's tests): street-graph planarity, district connectivity, every lot reachable, every anchor placed, sidewalk network connected, no prop on crosswalks, travel-time budgets between story anchors, interest-curve thresholds.
- **Authoring tool** (dev build): view layers, reroll a region with a new sub-seed, pin results ("bake"), and paint overrides. Output is JSON in `packages/sim/src/content/world/`.
- **Performance:** generation per district < 50 ms on a worker thread; tile rasterisation in chunks; render baking per 32×32 chunk.

## 7. Delivery plan

| Milestone | World-gen deliverable |
|---|---|
| M3 | City graph and district seams; vector street network with organic grammar for the **Slums v2** and **Downtown**; lot subdivision; building grammar v1; rasterisation to the tile grid; chunked rendering |
| M4 | Vignette system (≥ 40 vignettes); habitats from geometry; state dressing v1 (faction graffiti, shutters, blackout) |
| M5 | Remaining districts' grammars (Industrial, Old Town radial, Harbor coastline, Outskirts curvilinear); authoring tool; interest-curve validator |
| M7 | Building kit rotations, weather wear, density and performance tuning |

**Acceptance:** blind test — players cannot spot repetition within a 10-minute walk; no straight street longer than 30 tiles without a feature; every district is recognisable from a screenshot.
