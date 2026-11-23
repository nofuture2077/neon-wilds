# NEON WILDS — Hybrid World Generation ("Authored Bones, Procedural Flesh")

> Owners: World Designer and Technical Architect · Goal added after Milestone 1 · Status: **v3 seamless organic city shipped in M5** (one map for all districts, free-angle curved streets, region grammars, landmarks, parks, docks, vector street rendering). See §8. Next: Old Town and Outskirts regions, vignettes (L6), building rotations (M7)
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

## 8. v3 as built: one seamless city (`world/cityGen.ts`, `content/city.ts`)

Player feedback after M5 part 1: *"all map parts are just squares, all streets follow a fixed grid; I want a seamless, organic map with winding roads, landmarks, and much more diversity in buildings and parks."* v3 replaces the per-district grids with **one 230×170 map** for the whole city:

1. **Regions (L0).** Each district is a region with an anchor point. Region membership is a noise-warped Voronoi diagram, so borders are ragged, not straight. A noisy south-east coastline makes the sea.
2. **Road graph (L2).** Each region seeds nodes on its own rotated, jittered lattice (spacing, jitter, angle per region). Candidate edges form a Gabriel graph; Kruskal's MST guarantees connectivity, and extra edges become loops with a per-region probability. Each edge is a quadratic Bézier with a per-region bend (Slums wind, Downtown is a near-straight rotated grid, Industrial is wide and straight).
3. **Rasterisation.** A distance field to the polylines gives road (≤ 2.6 tiles), sidewalk (≤ 4.6) and block land. Crosswalks are 4-connected tile strips across the road, a few tiles from each junction.
4. **Blocks (L3).** Faces of the road graph become blocks. The open outskirts are split into a built-up fringe along each road and wild land beyond it. Buildings are placed by walking both sides of every street and **rotated to match it** (within ±45°, so the oblique art stays upright and the door side is chosen in the building's own frame); they shrink to fit curves and corners. Deep blocks get a ring of back-lot buildings, aligned with the block, around courtyards. Collision rasterises the rotated footprint to tiles; the renderer draws the turned sprite over yard paving. Other block kinds: parks (pond, ring path, winding paths, trees, benches), docks on the harbor shore, or tiny pockets.
5. **Identity.** Every district's authored buildings are placed once in their own region; the first is the **landmark** on the region's biggest building (Lumen Spire, Furnace Pits, Night Market, Courier Co-op), lit with a big halo. Street names follow the straightest continuation through junctions.
6. **Validation.** Anything walkable that pedestrians cannot reach becomes a fenced `Lot`; buildings whose doors open onto such pockets are removed. Tests check road and sidewalk connectivity, a reachable entrance for every named building, one landmark per region, parks, size variety, region anchors and determinism (`test/citygen.test.ts`). Generation takes about 20–50 ms.

**Traffic** follows lanes on the graph (right-hand traffic, curved turns through the junction centre, two-phase signals at junctions of three or more roads). **Rendering** strokes the graph with Canvas 2D (asphalt, neon curbs, sidewalks, centre lines, zebra crossings, stop lines) and bakes it into 1024 px textures. The tile layer underneath only shows paving. Crossing into another district is just a toast and a change of music; there is no loading.
