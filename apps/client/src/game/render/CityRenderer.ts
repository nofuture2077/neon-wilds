import Phaser from 'phaser';
import { TILE_SIZE, Tile, type DistrictLayout, type Prop } from '@neon-wilds/sim';
import { buildBuilding } from '../assets/buildings';
import { TEXTURES, addCanvasTexture } from '../assets/manifest';
import { visualTileIndex } from '../assets/tiles';
import { Depth } from './depth';
import type { Lighting } from './lighting';

const T = TILE_SIZE;
const LAMP_TINTS = [0xffb070, 0xff6fc0, 0x6fe8ff, 0xffb070] as const;

/**
 * Builds the static visuals of a district from its simulation layout:
 * ground tilemap, buildings, props, tree canopies and light sources.
 * Pure presentation — nothing here feeds back into the simulation.
 */
export function renderCity(scene: Phaser.Scene, layout: DistrictLayout, lighting: Lighting): void {
  renderGround(scene, layout);
  for (const b of layout.buildings) {
    const key = `building-${b.id}`;
    const art = buildBuilding(b);
    addCanvasTexture(scene, key, art.canvas);
    scene.add
      .rectangle(b.x * T + 6, b.y * T + 4, b.w * T, b.h * T, 0x000000, 0.45)
      .setOrigin(0, 0)
      .setDepth(Depth.buildingShadow);
    scene.add.image(b.x * T, b.y * T, key).setOrigin(0, 0).setDepth(Depth.buildings);
    for (const l of art.lights) {
      lighting.add(b.x * T + l.x, b.y * T + l.y, l.color, l.scale, 0.75, l.day, l.flicker ? 0.08 : 0);
    }
  }

  for (const p of layout.props) renderProp(scene, p, lighting);

  for (let ty = 0; ty < layout.map.height; ty++) {
    for (let tx = 0; tx < layout.map.width; tx++) {
      if (layout.map.get(tx, ty) === Tile.Tree) {
        scene.add.image((tx + 0.5) * T, (ty + 0.5) * T, TEXTURES.tree).setDepth(Depth.canopy);
      }
    }
  }
}

function renderGround(scene: Phaser.Scene, layout: DistrictLayout): void {
  const { map } = layout;
  const data: number[][] = [];
  for (let y = 0; y < map.height; y++) {
    const row: number[] = [];
    for (let x = 0; x < map.width; x++) row.push(visualTileIndex(map, x, y));
    data.push(row);
  }
  const tilemap = scene.make.tilemap({ data, tileWidth: T, tileHeight: T });
  const tileset = tilemap.addTilesetImage(TEXTURES.tileset, TEXTURES.tileset, T, T, 0, 0);
  if (!tileset) throw new Error('Failed to create tileset');
  tilemap.createLayer(0, tileset, 0, 0)?.setDepth(Depth.ground);
}

function renderProp(scene: Phaser.Scene, p: Prop, lighting: Lighting): void {
  const cx = (p.x + p.w / 2) * T;
  const cy = (p.y + p.h / 2) * T;
  switch (p.kind) {
    case 'parked-car':
      // Parked cars are simulated vehicles now (VehicleViews renders them).
      break;
    case 'street-lamp': {
      // Lamp heads lean over the curb.
      const off = { north: [0, -5], south: [0, 5], east: [5, 0], west: [-5, 0] }[p.facing];
      const lx = cx + (off?.[0] ?? 0);
      const ly = cy + (off?.[1] ?? 0);
      scene.add.image(lx, ly, TEXTURES.lamp).setDepth(Depth.canopy);
      const tint = LAMP_TINTS[(p.x * 7 + p.y * 3) % LAMP_TINTS.length]!;
      lighting.add(lx, ly, tint, 0.7, 0.38);
      break;
    }
    case 'bench':
      scene.add.image(cx, cy, TEXTURES.bench).setRotation(p.facing === 'north' || p.facing === 'south' ? Math.PI / 2 : 0).setDepth(Depth.groundProps);
      break;
    case 'dumpster':
      scene.add.image(cx, cy, TEXTURES.dumpster).setDepth(Depth.groundProps);
      break;
  }
}
