import { Tile, type TileKind, type TileMap, TILE_SIZE } from '@neon-wilds/sim';
import { createCanvas, hashNoise, px, rect, type PixelCanvas } from './canvas';
import { PALETTE as P } from './palette';

const T = TILE_SIZE;

/**
 * Tileset layout: indices 0..15 = Tile kinds, 16..31 = sidewalk curb variants (mask N=1 E=2 S=4 W=8),
 * 32 = Old Town cobbled road, 33..48 = Old Town flagstone sidewalk curb variants,
 * 49 = Outskirts patched lane, 50..65 = Outskirts dirt verge variants.
 */
export const SIDEWALK_VARIANT_BASE = 16;
const OLD_ROAD = 32;
const OLD_SIDEWALK_BASE = 33;
const RURAL_ROAD = 49;
const RURAL_VERGE_BASE = 50;
export const TILESET_COLUMNS = 66;

/** Street surface by district: neon city, Old Town cobbles or Outskirts country lanes. */
export type GroundLook = 'city' | 'old' | 'rural';

/** Map a ground tile to its tileset index, picking curb variants from neighbours. */
export function visualTileIndex(map: TileMap, x: number, y: number, look: GroundLook = 'city'): number {
  const kind = map.get(x, y);
  if (look !== 'city' && (kind === Tile.Road || kind === Tile.RoadLineH || kind === Tile.RoadLineV)) return look === 'old' ? OLD_ROAD : RURAL_ROAD;
  if (kind !== Tile.Sidewalk) return kind;
  const roadish = (k: TileKind) => k === Tile.Road || k === Tile.RoadLineH || k === Tile.RoadLineV || k === Tile.CrosswalkH || k === Tile.CrosswalkV;
  let mask = 0;
  if (roadish(map.get(x, y - 1))) mask |= 1;
  if (roadish(map.get(x + 1, y))) mask |= 2;
  if (roadish(map.get(x, y + 1))) mask |= 4;
  if (roadish(map.get(x - 1, y))) mask |= 8;
  return (look === 'old' ? OLD_SIDEWALK_BASE : look === 'rural' ? RURAL_VERGE_BASE : SIDEWALK_VARIANT_BASE) + mask;
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

  drawCobbles(c, at(OLD_ROAD));
  for (let mask = 0; mask < 16; mask++) drawFlagstones(c, at(OLD_SIDEWALK_BASE + mask), mask);

  drawRuralLane(c, at(RURAL_ROAD));
  for (let mask = 0; mask < 16; mask++) drawVerge(c, at(RURAL_VERGE_BASE + mask), mask);
  return pc;
}

/** Old Town road: rounded setts in staggered rows. */
function drawCobbles(c: CanvasRenderingContext2D, ox: number) {
  rect(c, ox, 0, T, T, 0x1c1820);
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const off = row % 2 === 0 ? 0 : 2;
    for (let x = -off; x < T; x += 4) {
      const n = hashNoise(x + 20, y, 41);
      const col = n < 0.33 ? 0x3a3340 : n < 0.66 ? 0x342e3a : 0x40384a;
      const x0 = Math.max(0, x);
      const w = Math.min(x + 3, T) - x0;
      if (w <= 0) continue;
      rect(c, ox + x0, y, w, 3, col);
      if (x0 === x) px(c, ox + x0, y, 0x544a5e);
    }
  }
}

/** Old Town pavement: big worn flagstones with a stone kerb toward the road. */
function drawFlagstones(c: CanvasRenderingContext2D, ox: number, mask: number) {
  speckle(c, ox, 17, 0x4a4248, 0x564c52, 0x3c353b, 0.08);
  for (let i = 0; i < T; i++) {
    px(c, ox + i, 0, 0x2e282e);
    px(c, ox, i, 0x2e282e);
    if (i < 10) px(c, ox + 10, i, 0x342e34, 0.8);
    if (i > 5) px(c, ox + i, 10, 0x342e34, 0.8);
  }
  const kerb = 0x8a7a68;
  if (mask & 1) {
    rect(c, ox, 0, T, 2, kerb);
    rect(c, ox, 2, T, 1, 0x15121c, 0.6);
  }
  if (mask & 4) {
    rect(c, ox, T - 2, T, 2, kerb);
    rect(c, ox, T - 3, T, 1, 0x15121c, 0.6);
  }
  if (mask & 8) {
    rect(c, ox, 0, 2, T, kerb);
    rect(c, ox + 2, 0, 1, T, 0x15121c, 0.6);
  }
  if (mask & 2) {
    rect(c, ox + T - 2, 0, 2, T, kerb);
    rect(c, ox + T - 3, 0, 1, T, 0x15121c, 0.6);
  }
}

/** Outskirts lane: old asphalt, patched and cracked, with weeds pushing through. */
function drawRuralLane(c: CanvasRenderingContext2D, ox: number) {
  speckle(c, ox, 23, 0x262230, 0x302b3a, 0x1c1924, 0.2);
  for (let i = 0; i < 6; i++) px(c, ox + 3 + i, 4 + ((i * 3) % 5), 0x15121a);
  rect(c, ox + 9, 9, 4, 3, 0x2c2836);
  px(c, ox + 2, 12, 0x2f5a2a);
  px(c, ox + 3, 11, 0x3d6b34);
  px(c, ox + 13, 3, 0x2f5a2a);
}

/** Outskirts verge: packed dirt and tufts of grass, with a worn edge toward the lane. */
function drawVerge(c: CanvasRenderingContext2D, ox: number, mask: number) {
  speckle(c, ox, 29, 0x3a3128, 0x463c30, 0x2e271f, 0.18);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(hashNoise(i, 1, 31) * 14) + 1;
    const y = Math.floor(hashNoise(i, 2, 31) * 14) + 1;
    px(c, ox + x, y, 0x3d6b34);
    px(c, ox + x + 1, y, 0x2f5a2a);
  }
  const edge = 0x221c16;
  if (mask & 1) rect(c, ox, 0, T, 1, edge);
  if (mask & 4) rect(c, ox, T - 1, T, 1, edge);
  if (mask & 8) rect(c, ox, 0, 1, T, edge);
  if (mask & 2) rect(c, ox + T - 1, 0, 1, T, edge);
}
