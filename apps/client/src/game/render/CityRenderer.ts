import Phaser from 'phaser';
import { TILE_SIZE, Tile, regionOf, type DistrictLayout, type Prop } from '@neon-wilds/sim';
import { buildBuilding } from '../assets/buildings';
import { TEXTURES, addCanvasTexture } from '../assets/manifest';
import { type GroundLook, visualTileIndex } from '../assets/tiles';
import { Depth } from './depth';
import type { Lighting } from './lighting';
import type { StaticCuller } from './culler';

const T = TILE_SIZE;
const LAMP_TINTS = [0xffb070, 0xff6fc0, 0x6fe8ff, 0xffb070] as const;

/**
 * Builds the static visuals of the city from its simulation layout: ground
 * tilemap, vector streets, buildings, props, tree canopies and light sources.
 * Pure presentation — nothing here feeds back into the simulation.
 */
export function renderCity(scene: Phaser.Scene, layout: DistrictLayout, lighting: Lighting, culler: StaticCuller): void {
  renderGround(scene, layout);
  for (const b of layout.buildings) {
    const key = `building-${b.id}`;
    const art = buildBuilding(b, b.region === 'downtown' || b.landmark, b.region === 'oldtown' || b.region === 'outskirts');
    addCanvasTexture(scene, key, art.canvas);
    // Buildings turn with their street; rotated ones are filtered smoothly so the edges don't shimmer.
    if (b.angle !== 0) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const cx = (b.x + b.w / 2) * T;
    const cy = (b.y + b.h / 2) * T;
    const cos = Math.cos(b.angle);
    const sin = Math.sin(b.angle);
    const at = (lx: number, ly: number) => {
      const dx = lx - (b.w * T) / 2;
      const dy = ly - (b.h * T) / 2;
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    };
    culler.add(scene.add.rectangle(cx + 6, cy + 4, b.w * T, b.h * T, 0x000000, 0.45).setRotation(b.angle).setDepth(Depth.buildingShadow));
    culler.add(scene.add.image(cx, cy, key).setRotation(b.angle).setDepth(Depth.buildings));
    for (const l of art.lights) {
      const p = at(l.x, l.y);
      lighting.add(p.x, p.y, l.color, l.scale, 0.75, l.day, l.flicker ? 0.08 : 0, l.scale <= 0.3 ? 'window' : 'neon');
    }
    if (b.landmark) {
      // Landmarks glow from afar: a big halo in the building's neon colour.
      lighting.add(cx, cy, b.neon ?? 0xff3fa4, 2.6, 0.35, 0.1, 0.03, 'neon');
    }
  }

  for (const p of layout.props) renderProp(scene, p, lighting, regionOf(layout, p.x, p.y).style, culler);

  for (let ty = 0; ty < layout.map.height; ty++) {
    for (let tx = 0; tx < layout.map.width; tx++) {
      if (layout.map.get(tx, ty) === Tile.Tree) {
        culler.add(scene.add.image((tx + 0.5) * T, (ty + 0.5) * T, TEXTURES.tree).setDepth(Depth.canopy));
      }
    }
  }
}

function renderGround(scene: Phaser.Scene, layout: DistrictLayout): void {
  const { map } = layout;
  const looks: GroundLook[] = layout.regions.map((r) => (r.style === 'oldtown' ? 'old' : r.style === 'outskirts' ? 'rural' : 'city'));
  const data: number[][] = [];
  for (let y = 0; y < map.height; y++) {
    const row: number[] = [];
    for (let x = 0; x < map.width; x++) row.push(visualTileIndex(map, x, y, looks[layout.regionMap[y * map.width + x]!] ?? 'city'));
    data.push(row);
  }
  const tilemap = scene.make.tilemap({ data, tileWidth: T, tileHeight: T });
  const tileset = tilemap.addTilesetImage(TEXTURES.tileset, TEXTURES.tileset, T, T, 0, 0);
  if (!tileset) throw new Error('Failed to create tileset');
  tilemap.createLayer(0, tileset, 0, 0)?.setDepth(Depth.ground);
}

function renderProp(scene: Phaser.Scene, p: Prop, lighting: Lighting, style: string, culler: StaticCuller): void {
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
      culler.add(scene.add.image(lx, ly, TEXTURES.lamp).setDepth(Depth.canopy));
      // Industrial streets burn sodium orange; elsewhere lamps mix warm white with neon tints.
      // Industrial streets burn sodium orange, Old Town has gas lamps; elsewhere warm white mixes with neon.
      const tint = style === 'industrial' ? 0xff9a30 : style === 'oldtown' || style === 'outskirts' ? 0xffc46b : LAMP_TINTS[(p.x * 7 + p.y * 3) % LAMP_TINTS.length]!;
      lighting.add(lx, ly, tint, 0.7, 0.38, 0, 0, 'lamp');
      break;
    }
    case 'bench':
      culler.add(scene.add.image(cx, cy, TEXTURES.bench).setRotation(p.facing === 'north' || p.facing === 'south' ? Math.PI / 2 : 0).setDepth(Depth.groundProps));
      break;
    case 'container':
      culler.add(scene.add.image(cx + 3, cy + 4, TEXTURES.container(p.variant)).setTint(0x000000).setAlpha(0.4).setDepth(Depth.shadows));
      culler.add(scene.add.image(cx, cy, TEXTURES.container(p.variant)).setDepth(Depth.groundProps + 1));
      break;
    case 'dumpster':
      culler.add(scene.add.image(cx, cy, TEXTURES.dumpster).setDepth(Depth.groundProps));
      break;
  }
}
