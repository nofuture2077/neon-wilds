# NEON WILDS — Asset Pipeline and Art Direction

> Owner: Art Director. All art and audio are original. No AI-generated assets are shipped (consistent with the project's no-generative-AI rule); placeholder art is procedural code.

## 1. Art direction

**Target look:** a dense, rain-soaked cyberpunk Slums at night, shown from an oblique ¾ top-down view (GTA 2 framing with visible building facades):

- **Palette:** violet-charcoal asphalt and concrete (`#1f1b2a`, `#3b3548`); building walls in muted plums, slate and teal-greys; accents in **hot pink `#ff3fa4`, cyan `#00e5ff`, amber `#ffb347`, violet `#b37dff`, mint `#4fffb0`**.
- **Density:** every block layers neon blade signs, shopfront glow, rooftop billboards, AC units, vents, water tanks, fire escapes and lit windows in mixed colours.
- **Lighting:** a violet haze even by day; at night additive glows from signs, lamps (pink, cyan and sodium), windows and neon curb strips. Flickering signs are rare and deliberate.
- **Readability first:** walkable ground is darker and flatter than solid buildings; characters carry a dark outline and a drop shadow; the interaction target gets a yellow chevron.
- The art-direction reference shared by the director (a dense isometric neon cityscape) is the **target mood**. We keep the oblique top-down projection for gameplay readability (ADR-007).

## 2. Technical specs

| Asset | Size | Notes |
|---|---|---|
| Ground tile | 16×16 | Tileset strip; indices 0–15 ground kinds, 16–31 sidewalk curb variants (N=1 E=2 S=4 W=8) |
| Building | footprint × 16 px | Roof (top) + south facade (FLOOR_H 11 px per storey, ground floor 14 px); door and sign positions come from simulation data |
| Character | 16×16 × 4 frames | Drawn facing **north**, rotated by heading; frames: neutral, left stride, neutral, right stride |
| Vehicle | 14×28 (compact) to 16×40 (truck) | Facing north; damage states as extra frames (M3) |
| Wildling (overworld) | 16×16 or 24×24, 4 frames | Facing south (¾ view); idle, walk ×2, action |
| Wildling (battle) | 64×64 front, 64×64 back | 2–4 frame idle loops |
| UI | — | Press Start 2P (headings), VT323 (body); Tailwind tokens in `apps/client/src/index.css` |
| Audio | OGG + M4A fallback | Loudness normalised to −16 LUFS (music), −20 LUFS (SFX) |

Rendering uses integer zoom only (`pixelArt: true`, `roundPixels: true`). Never author sub-pixel art or scale by non-integers.

## 3. How assets are wired

Gameplay and rendering code refer only to **texture keys**. `apps/client/src/game/assets/manifest.ts` maps each key to a source:

```ts
[TEXTURES.lamp]: { kind: 'procedural', build: buildLamp },          // today
[TEXTURES.lamp]: { kind: 'file', url: '/assets/props/lamp.png' },   // drop-in replacement
```

`BootScene.preload` queues all `file` entries; `BootScene.create` generates the `procedural` ones that were not loaded from files. Per-entity textures (buildings, characters with custom appearance) are generated in `WorldScene` from simulation data. Their file-based replacement is a **building kit**: tileable facade, roof and sign atlases composed by the same layout code (M7).

## 4. Production workflow (when real art arrives)

1. Author in Aseprite with the shared palette file (`art/palette/neon-wilds.gpl`, added with the first real asset).
2. Export sprite sheets with JSON (`--sheet-type packed --data *.json --format json-array`) to `art/export/`.
3. `npm run assets` (M7) packs atlases per scene (`free-tex-packer-core`, a build-time dev dependency only) into `apps/client/public/assets/atlases/`, generates typed key constants, and fails on missing keys referenced by the manifest.
4. Switch manifest entries from `procedural` to `file`. Procedural generators stay as fallbacks for tests and missing assets.
5. Visual regression: Playwright screenshots of fixed seeds and times (`?quickstart&seed=1337&time=22:30`) compared with a perceptual threshold.

## 5. Folder layout

```
apps/client/public/assets/
  atlases/        packed atlases + json (generated)
  tiles/  characters/  wildlings/  vehicles/  props/  ui/
  audio/music/  audio/sfx/
art/              source .aseprite files (git LFS), palette, export scripts
```

## 6. Loading strategy

Boot loads only the core atlas (UI, player, current district tiles). District and battle atlases load lazily on district entry or first battle, with a short in-world transition. Audio streams per district.
