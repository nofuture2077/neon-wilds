import { Tile, type TileKind, type TileMap, TILE_SIZE } from '@neon-wilds/sim';
import { createCanvas, hashNoise, px, rect, type PixelCanvas } from './canvas';
import { PALETTE as P } from './palette';

const T = TILE_SIZE;

/** Tileset layout: indices 0..15 = Tile kinds, 16..31 = sidewalk curb variants (mask N=1 E=2 S=4 W=8). */
export const SIDEWALK_VARIANT_BASE = 16;
export const TILESET_COLUMNS = 32;

/** Map a ground tile to its tileset index, picking curb variants from neighbours. */
export function visualTileIndex(map: TileMap, x: number, y: number): number {
  const kind = map.get(x, y);
  if (kind !== Tile.Sidewalk) return kind;
  const roadish = (k: TileKind) => k === Tile.Road || k === Tile.RoadLineH || k === Tile.RoadLineV || k === Tile.CrosswalkH || k === Tile.CrosswalkV;
  let mask = 0;
  if (roadish(map.get(x, y - 1))) mask |= 1;
  if (roadish(map.get(x + 1, y))) mask |= 2;
  if (roadish(map.get(x, y + 1))) mask |= 4;
  if (roadish(map.get(x - 1, y))) mask |= 8;
  return SIDEWALK_VARIANT_BASE + mask;
}

function speckle(c: CanvasRenderingContext2D, ox: number, seed: number, base: number, light: number, dark: number, density = 0.12) {
  rect(c, ox, 0, T, T, base);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const n = hashNoise(x, y, seed);
      if (n < density / 2) px(c, ox + x, y, dark);
      else if (n > 1 - density / 2) px(c, ox + x, y, light);
    }
  }
}

function drawAsphalt(c: CanvasRenderingContext2D, ox: number, seed: number) {
  speckle(c, ox, seed, P.asphalt, P.asphaltLight, P.asphaltDark, 0.16);
}

function drawSidewalk(c: CanvasRenderingContext2D, ox: number, mask: number) {
  speckle(c, ox, 7, P.concrete, P.concreteLight, P.concreteDark, 0.1);
  // slab joints
  for (let i = 0; i < T; i++) {
    px(c, ox + i, 0, P.concreteDark);
    px(c, ox + 0, i, P.concreteDark);
    px(c, ox + i, 8, P.concreteDark, 0.6);
    px(c, ox + 8, i, P.concreteDark, 0.6);
  }
  // curbs toward the road
  // Curb with a thin neon strip, as if lit from the signage above.
  if (mask & 1) {
    rect(c, ox, 0, T, 2, P.curb);
    rect(c, ox, 0, T, 1, P.curbNeon, 0.55);
    rect(c, ox, 2, T, 1, P.curbShadow, 0.6);
  }
  if (mask & 4) {
    rect(c, ox, T - 2, T, 2, P.curb);
    rect(c, ox, T - 1, T, 1, P.curbNeon, 0.55);
    rect(c, ox, T - 3, T, 1, P.curbShadow, 0.6);
  }
  if (mask & 8) {
    rect(c, ox, 0, 2, T, P.curb);
    rect(c, ox, 0, 1, T, P.curbNeon, 0.55);
    rect(c, ox + 2, 0, 1, T, P.curbShadow, 0.6);
  }
  if (mask & 2) {
    rect(c, ox + T - 2, 0, 2, T, P.curb);
    rect(c, ox + T - 1, 0, 1, T, P.curbNeon, 0.55);
    rect(c, ox + T - 3, 0, 1, T, P.curbShadow, 0.6);
  }
}

/** Builds the ground tileset as a single strip canvas. */
export function buildTileset(): PixelCanvas {
  const pc = createCanvas(T * TILESET_COLUMNS, T);
  const c = pc.ctx;
  const at = (i: number) => i * T;

  rect(c, at(Tile.Void), 0, T, T, P.void);
  drawAsphalt(c, at(Tile.Road), 1);

  drawAsphalt(c, at(Tile.RoadLineH), 2);
  rect(c, at(Tile.RoadLineH) + 2, 7, 10, 2, P.laneYellow);

  drawAsphalt(c, at(Tile.RoadLineV), 3);
  rect(c, at(Tile.RoadLineV) + 7, 2, 2, 10, P.laneYellow);

  // Zebra bars run parallel to traffic: a west-east crossing over a north-south road has vertical bars.
  drawAsphalt(c, at(Tile.CrosswalkH), 4);
  rect(c, at(Tile.CrosswalkH) + 2, 1, 4, T - 2, P.zebra, 0.85);
  rect(c, at(Tile.CrosswalkH) + 10, 1, 4, T - 2, P.zebra, 0.85);

  drawAsphalt(c, at(Tile.CrosswalkV), 5);
  rect(c, at(Tile.CrosswalkV) + 1, 2, T - 2, 4, P.zebra, 0.85);
  rect(c, at(Tile.CrosswalkV) + 1, 10, T - 2, 4, P.zebra, 0.85);

  drawSidewalk(c, at(Tile.Sidewalk), 0);

  speckle(c, at(Tile.Alley), 8, P.alley, 0x2e2738, P.alleyDark, 0.25);
  rect(c, at(Tile.Alley) + 3, 9, 6, 3, 0x2b2350, 0.8); // puddle reflecting neon
  rect(c, at(Tile.Alley) + 4, 10, 2, 1, 0xff3fa4, 0.5);

  speckle(c, at(Tile.Grass), 9, P.grass, P.grassLight, P.grassDark, 0.35);

  rect(c, at(Tile.Plaza), 0, T, T, P.plaza);
  for (let y = 0; y < T; y += 4) {
    rect(c, at(Tile.Plaza), y, T, 1, P.plazaDark);
    const off = (y / 4) % 2 === 0 ? 0 : 4;
    for (let x = off; x < T; x += 8) rect(c, at(Tile.Plaza) + x, y, 1, 4, P.plazaDark);
  }

  rect(c, at(Tile.Water), 0, T, T, P.water);
  rect(c, at(Tile.Water) + 2, 4, 5, 1, P.waterLight);
  rect(c, at(Tile.Water) + 9, 11, 4, 1, P.waterLight);

  rect(c, at(Tile.Building), 0, T, T, 0x15151c);
  speckle(c, at(Tile.Tree), 12, P.grass, P.grassLight, P.grassDark, 0.35);

  // Fenced vacant lot: packed dirt behind a chain-link fence.
  speckle(c, at(Tile.Lot), 13, 0x2a2228, 0x352b30, 0x1e181d, 0.3);
  for (let i = 0; i < T; i += 4) {
    for (let k = 0; k < 4; k++) {
      px(c, at(Tile.Lot) + ((i + k) % T), k + i, 0x5d5870, 0.5);
      px(c, at(Tile.Lot) + ((i + 3 - k) % T), k + i, 0x5d5870, 0.5);
    }
  }

  for (let mask = 0; mask < 16; mask++) drawSidewalk(c, at(SIDEWALK_VARIANT_BASE + mask), mask);
  return pc;
}
