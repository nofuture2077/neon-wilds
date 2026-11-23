import type Phaser from 'phaser';
import type { PixelCanvas } from './canvas';
import {
  buildBench,
  buildCar,
  buildContainer,
  buildCruiser,
  buildPuff,
  buildSignal,
  buildVan,
  buildDumpster,
  buildFocusMarker,
  buildGlow,
  buildLamp,
  buildShadow,
  buildTreeCanopy,
} from './props';
import { TILESET_COLUMNS, buildTileset } from './tiles';
import { CAR_COLORS } from './palette';
import { CREATURE_FRAMES, CREATURE_SIZES, buildCreatureSheet, buildSnare, creatureKey } from './creatures';
import { SPECIES } from '@neon-wilds/sim';

/**
 * Asset manifest — the single place that maps texture keys to their source.
 *
 * Today every texture is procedural placeholder art. To ship real art, change
 * an entry to `{ kind: 'file', url: '/assets/...' }` (and drop the PNG into
 * `public/assets`). Gameplay and rendering code only ever refer to the keys.
 */
export type AssetSource =
  | { kind: 'procedural'; build: () => PixelCanvas; frameWidth?: number; frameHeight?: number }
  | { kind: 'file'; url: string; frameWidth?: number; frameHeight?: number };

export const TEXTURES = {
  tileset: 'tileset',
  lamp: 'prop-lamp',
  bench: 'prop-bench',
  dumpster: 'prop-dumpster',
  tree: 'prop-tree',
  shadow: 'fx-shadow',
  glow: 'fx-glow',
  focus: 'ui-focus',
  car: (variant: number) => `prop-car-${variant % CAR_COLORS.length}`,
  vehicle: (classId: string, variant: number) =>
    classId === 'cruiser' ? 'veh-cruiser' : classId === 'van' ? `veh-van-${variant % 6}` : `veh-${classId}-${variant % CAR_COLORS.length}`,
  signal: 'prop-signal',
  container: (variant: number) => `prop-container-${variant % 6}`,
  puff: 'fx-puff',
  snare: 'fx-snare',
  creature: creatureKey,
} as const;

export const MANIFEST: Record<string, AssetSource> = {
  [TEXTURES.tileset]: { kind: 'procedural', build: buildTileset },
  [TEXTURES.lamp]: { kind: 'procedural', build: buildLamp },
  [TEXTURES.bench]: { kind: 'procedural', build: buildBench },
  [TEXTURES.dumpster]: { kind: 'procedural', build: buildDumpster },
  [TEXTURES.tree]: { kind: 'procedural', build: buildTreeCanopy },
  [TEXTURES.shadow]: { kind: 'procedural', build: buildShadow },
  [TEXTURES.glow]: { kind: 'procedural', build: () => buildGlow(64) },
  [TEXTURES.focus]: { kind: 'procedural', build: buildFocusMarker },
  [TEXTURES.snare]: { kind: 'procedural', build: buildSnare },
  [TEXTURES.signal]: { kind: 'procedural', build: buildSignal },
  ...Object.fromEntries([0, 1, 2, 3, 4, 5].map((v) => [`prop-container-${v}`, { kind: 'procedural', build: () => buildContainer(v) } satisfies AssetSource])),
  [TEXTURES.puff]: { kind: 'procedural', build: buildPuff },
  ['veh-cruiser']: { kind: 'procedural', build: buildCruiser },
  ...Object.fromEntries(
    [0, 1, 2, 3, 4, 5].flatMap((v) => [
      [`veh-van-${v}`, { kind: 'procedural', build: () => buildVan(v) } satisfies AssetSource],
      [`veh-compact-${v}`, { kind: 'procedural', build: () => buildCar(v) } satisfies AssetSource],
      [`veh-sedan-${v}`, { kind: 'procedural', build: () => buildCar(v, true) } satisfies AssetSource],
    ]),
  ),
  ...Object.fromEntries(
    Object.keys(SPECIES).flatMap((id) =>
      (['small', 'large'] as const).map((size) => [
        creatureKey(id, size),
        {
          kind: 'procedural',
          build: () => buildCreatureSheet(id, CREATURE_SIZES[size]),
          frameWidth: CREATURE_SIZES[size],
          frameHeight: CREATURE_SIZES[size],
        } satisfies AssetSource,
      ]),
    ),
  ),
  ...Object.fromEntries(
    CAR_COLORS.map((_, i) => [TEXTURES.car(i), { kind: 'procedural', build: () => buildCar(i) } satisfies AssetSource]),
  ),
};

export { TILESET_COLUMNS, CREATURE_FRAMES };

/** Queue file-based assets on the loader (call in `preload`). */
export function queueFileAssets(scene: Phaser.Scene): void {
  for (const [key, src] of Object.entries(MANIFEST)) {
    if (src.kind !== 'file') continue;
    if (src.frameWidth && src.frameHeight) {
      scene.load.spritesheet(key, src.url, { frameWidth: src.frameWidth, frameHeight: src.frameHeight });
    } else {
      scene.load.image(key, src.url);
    }
  }
}

/** Generate all procedural textures that are not already loaded from files (call in `create`). */
export function generateProceduralAssets(scene: Phaser.Scene): void {
  for (const [key, src] of Object.entries(MANIFEST)) {
    if (src.kind !== 'procedural' || scene.textures.exists(key)) continue;
    addCanvasTexture(scene, key, src.build(), src.frameWidth, src.frameHeight);
  }
}

/** Register a canvas as a texture, optionally sliced into equally sized frames. */
export function addCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  pc: PixelCanvas,
  frameWidth?: number,
  frameHeight?: number,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, pc.canvas);
  if (!tex || !frameWidth || !frameHeight) return;
  const cols = Math.floor(pc.canvas.width / frameWidth);
  const rows = Math.floor(pc.canvas.height / frameHeight);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      tex.add(r * cols + col, 0, col * frameWidth, r * frameHeight, frameWidth, frameHeight);
    }
  }
}
