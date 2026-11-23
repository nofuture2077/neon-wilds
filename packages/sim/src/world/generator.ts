import { Rng, deriveSeed } from '../core/rng';
import type {
  Building,
  BuildingTemplate,
  DistrictDefinition,
  DistrictLayout,
  Facing,
  Prop,
  Street,
} from './district';
import { TileMap } from './tilemap';
import { Tile } from './tiles';

/** A city block after merging: a rectangle of non-road ground. */
interface BlockRect {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'lots' | 'park' | 'square';
}

/**
 * Deterministically builds a district from a data definition and a seed.
 *
 * Street generation v2 ("organic grid", WORLD_GEN.md §3):
 * - column widths and row heights vary per seed, so no two blocks line up the same way;
 * - some interior road segments are removed, merging neighbouring blocks into
 *   superblocks with T-junctions and L-bends. Removed segments form a matching in
 *   the block-adjacency graph, which provably keeps the road network connected;
 * - deep superblocks get inner courtyards; one block becomes a park, one a market square.
 * Each block has a 2-tile sidewalk ring; crosswalks join block corners across roads.
 */
export function generateDistrict(def: DistrictDefinition, seed: number): DistrictLayout {
  const rng = new Rng(deriveSeed(seed, `district:${def.id}`));
  const { blocksX, blocksY, blockW, blockH, roadW } = def;
  const ws = Array.from({ length: blocksX }, () => Math.max(14, blockW + rng.int(-4, 4)));
  const hs = Array.from({ length: blocksY }, () => Math.max(13, blockH + rng.int(-3, 3)));
  const xs: number[] = [];
  const ys: number[] = [];
  let acc = roadW;
  for (const w of ws) {
    xs.push(acc);
    acc += w + roadW;
  }
  const width = acc;
  acc = roadW;
  for (const h of hs) {
    ys.push(acc);
    acc += h + roadW;
  }
  const height = acc;
  const map = new TileMap(width, height);
  const bandX = (i: number) => (i === 0 ? 0 : xs[i - 1]! + ws[i - 1]!);
  const bandY = (j: number) => (j === 0 ? 0 : ys[j - 1]! + hs[j - 1]!);
  const mid = Math.floor(roadW / 2);

  // Decide merges: each block merges at most once (a matching), never the park, square or spawn block.
  const spawnBx = Math.min(1, blocksX - 1);
  const spawnBy = Math.min(1, blocksY - 1);
  const squareBlock = { bx: (def.parkBlock.bx + 2) % blocksX, by: (def.parkBlock.by + 1) % blocksY };
  const fixed = (bx: number, by: number) =>
    (bx === def.parkBlock.bx && by === def.parkBlock.by) ||
    (bx === spawnBx && by === spawnBy) ||
    (bx === squareBlock.bx && by === squareBlock.by);
  const merged = new Set<string>();
  const removedV: Array<{ i: number; by: number }> = []; // vertical road i between blocks (i-1, by) and (i, by)
  const removedH: Array<{ j: number; bx: number }> = []; // horizontal road j between blocks (bx, j-1) and (bx, j)
  const candidates: Array<{ a: [number, number]; b: [number, number]; vertical: boolean }> = [];
  for (let by = 0; by < blocksY; by++) for (let bx = 0; bx + 1 < blocksX; bx++) candidates.push({ a: [bx, by], b: [bx + 1, by], vertical: true });
  for (let by = 0; by + 1 < blocksY; by++) for (let bx = 0; bx < blocksX; bx++) candidates.push({ a: [bx, by], b: [bx, by + 1], vertical: false });
  for (const c of candidates) {
    const ka = `${c.a[0]}-${c.a[1]}`;
    const kb = `${c.b[0]}-${c.b[1]}`;
    if (merged.has(ka) || merged.has(kb) || fixed(...c.a) || fixed(...c.b) || !rng.chance(0.22)) continue;
    merged.add(ka);
    merged.add(kb);
    if (c.vertical) removedV.push({ i: c.b[0], by: c.a[1] });
    else removedH.push({ j: c.b[1], bx: c.a[0] });
  }

  const blocks: BlockRect[] = [];
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const key = `${bx}-${by}`;
      const kind = bx === def.parkBlock.bx && by === def.parkBlock.by ? 'park' : bx === squareBlock.bx && by === squareBlock.by ? 'square' : 'lots';
      const v = removedV.find((r) => r.by === by && (r.i === bx || r.i === bx + 1));
      const h = removedH.find((r) => r.bx === bx && (r.j === by || r.j === by + 1));
      if (v) {
        if (v.i !== bx + 1) continue; // the left block of a merged pair creates the rectangle
        blocks.push({ key, x: xs[bx]!, y: ys[by]!, w: ws[bx]! + roadW + ws[bx + 1]!, h: hs[by]!, kind });
      } else if (h) {
        if (h.j !== by + 1) continue;
        blocks.push({ key, x: xs[bx]!, y: ys[by]!, w: ws[bx]!, h: hs[by]! + roadW + hs[by + 1]!, kind });
      } else {
        blocks.push({ key, x: xs[bx]!, y: ys[by]!, w: ws[bx]!, h: hs[by]!, kind });
      }
    }
  }

  // 1. Roads with centre lines (intersections stay plain asphalt).
  map.fillRect(0, 0, width, height, Tile.Road);
  for (let i = 0; i <= blocksX; i++) {
    const x = bandX(i) + mid;
    for (let y = 0; y < height; y++) if (!inBand(y, blocksY, bandY, roadW)) map.set(x, y, Tile.RoadLineV);
  }
  for (let j = 0; j <= blocksY; j++) {
    const y = bandY(j) + mid;
    for (let x = 0; x < width; x++) if (!inBand(x, blocksX, bandX, roadW)) map.set(x, y, Tile.RoadLineH);
  }

  // 3. Blocks.
  const buildings: Building[] = [];
  const props: Prop[] = [];
  let propSeq = 0;
  const addProp = (p: Omit<Prop, 'id'>) => props.push({ ...p, id: `prop-${propSeq++}` });

  for (const b of blocks) {
    map.fillRect(b.x, b.y, b.w, b.h, Tile.Sidewalk);
    const ix = b.x + 2;
    const iy = b.y + 2;
    const iw = b.w - 4;
    const ih = b.h - 4;
    if (b.kind === 'park') buildPark(map, rng, ix, iy, iw, ih, addProp);
    else if (b.kind === 'square') buildSquare(map, rng, ix, iy, iw, ih, addProp);
    else buildLots(map, rng, ix, iy, iw, ih, buildings, addProp, b.key);
    placeStreetFurniture(map, rng, b.x, b.y, b.w, b.h, addProp);
  }

  assignBuildingIdentities(buildings, def, rng);

  // 4. Crosswalks between neighbouring blocks next to each intersection, only where both ends are sidewalk.
  for (let i = 1; i < blocksX; i++) {
    for (let by = 0; by < blocksY; by++) {
      if (removedV.some((r) => r.i === i && r.by === by)) continue;
      for (const y of [ys[by]!, ys[by]! + hs[by]! - 1]) {
        if (map.get(bandX(i) - 1, y) !== Tile.Sidewalk || map.get(bandX(i) + roadW, y) !== Tile.Sidewalk) continue;
        for (let x = bandX(i); x < bandX(i) + roadW; x++) map.set(x, y, Tile.CrosswalkH);
      }
    }
  }
  for (let j = 1; j < blocksY; j++) {
    for (let bx = 0; bx < blocksX; bx++) {
      if (removedH.some((r) => r.j === j && r.bx === bx)) continue;
      for (const x of [xs[bx]!, xs[bx]! + ws[bx]! - 1]) {
        if (map.get(x, bandY(j) - 1) !== Tile.Sidewalk || map.get(x, bandY(j) + roadW) !== Tile.Sidewalk) continue;
        for (let y = bandY(j); y < bandY(j) + roadW; y++) map.set(x, y, Tile.CrosswalkV);
      }
    }
  }


  // Parked cars must never block a crosswalk.
  for (let k = props.length - 1; k >= 0; k--) {
    const p = props[k]!;
    if (p.kind !== 'parked-car') continue;
    let onCrosswalk = false;
    for (let ty = p.y; ty < p.y + p.h; ty++) {
      for (let tx = p.x; tx < p.x + p.w; tx++) {
        const t = map.get(tx, ty);
        if (t === Tile.CrosswalkH || t === Tile.CrosswalkV) onCrosswalk = true;
      }
    }
    if (onCrosswalk) props.splice(k, 1);
  }

  map.rebuildCollision();
  for (const p of props) {
    if (!p.solid) continue;
    for (let ty = p.y; ty < p.y + p.h; ty++) for (let tx = p.x; tx < p.x + p.w; tx++) map.block(tx, ty);
  }

  const streets: Street[] = [];
  for (let i = 0; i <= blocksX; i++) {
    streets.push({
      name: def.verticalStreets[i % def.verticalStreets.length] ?? `Street ${i}`,
      axis: 'vertical',
      from: bandX(i),
      to: bandX(i) + roadW - 1,
    });
  }
  for (let j = 0; j <= blocksY; j++) {
    streets.push({
      name: def.horizontalStreets[j % def.horizontalStreets.length] ?? `Row ${j}`,
      axis: 'horizontal',
      from: bandY(j),
      to: bandY(j) + roadW - 1,
    });
  }

  const playerSpawn = {
    x: xs[spawnBx]! + Math.floor(ws[spawnBx]! / 2) + 0.5,
    y: ys[spawnBy]! + 0.5,
  };

  const pedestrianSpawns: { tx: number; ty: number }[] = [];
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      if (map.get(tx, ty) === Tile.Sidewalk && !map.isSolid(tx, ty)) pedestrianSpawns.push({ tx, ty });
    }
  }

  return { id: def.id, name: def.name, map, buildings, props, streets, playerSpawn, pedestrianSpawns };
}

function inBand(v: number, count: number, bandStart: (i: number) => number, roadW: number): boolean {
  for (let i = 0; i <= count; i++) {
    const s = bandStart(i);
    if (v >= s && v < s + roadW) return true;
  }
  return false;
}

/** An open market square: plaza paving, a ring of benches and stalls, lamps. */
function buildSquare(map: TileMap, rng: Rng, ix: number, iy: number, iw: number, ih: number, addProp: AddProp): void {
  map.fillRect(ix, iy, iw, ih, Tile.Plaza);
  const cx = ix + Math.floor(iw / 2);
  const cy = iy + Math.floor(ih / 2);
  if (iw >= 6 && ih >= 6) map.fillRect(cx - 1, cy - 1, 2, 2, Tile.Water); // fountain
  for (let x = ix + 1; x < ix + iw - 1; x += 3) {
    if (rng.chance(0.6)) addProp({ kind: 'bench', x, y: iy + 1, w: 1, h: 1, solid: false, variant: 1, facing: 'south' });
    if (rng.chance(0.6)) addProp({ kind: 'bench', x, y: iy + ih - 2, w: 1, h: 1, solid: false, variant: 1, facing: 'north' });
  }
  addProp({ kind: 'street-lamp', x: cx - 3, y: cy, w: 1, h: 1, solid: false, variant: 1, facing: 'west' });
  addProp({ kind: 'street-lamp', x: cx + 2, y: cy, w: 1, h: 1, solid: false, variant: 1, facing: 'east' });
}

type AddProp = (p: Omit<Prop, 'id'>) => void;

function buildLots(
  map: TileMap,
  rng: Rng,
  ix: number,
  iy: number,
  iw: number,
  ih: number,
  out: Building[],
  addProp: AddProp,
  blockKey: string,
): void {
  // Rows of at most 5 tiles deep; deep superblocks get a courtyard between the alley and the south row.
  const northH = Math.min(5, Math.floor((ih - 2) / 2));
  const southH = Math.min(5, ih - 2 - northH);
  const alleyY = iy + northH;
  const courtyard = ih - northH - 2 - southH;
  map.fillRect(ix, alleyY, iw, 2, Tile.Alley);
  if (courtyard > 0) {
    map.fillRect(ix, alleyY + 2, iw, courtyard, Tile.Plaza);
    for (let x = ix + 2; x < ix + iw - 2; x += 5) {
      if (rng.chance(0.5)) addProp({ kind: 'bench', x, y: alleyY + 2 + Math.floor(courtyard / 2), w: 1, h: 1, solid: false, variant: 1, facing: 'south' });
    }
    if (courtyard >= 13) {
      // Deep superblock: a second ring of buildings around its own inner court, plus a walkway row.
      buildLots(map, rng, ix, alleyY + 2, iw, courtyard - 1, out, addProp, `${blockKey}c`);
    } else if (courtyard >= 5 && iw >= 8) {
      buildPark(map, rng, ix + 1, alleyY + 3, iw - 2, courtyard - 2, addProp, false);
    }
  }

  const fillRow = (rowY: number, rowH: number, facing: Facing) => {
    const end = ix + iw;
    let cx = ix;
    while (cx < end) {
      const remaining = end - cx;
      let w = rng.int(3, 6);
      if (remaining - w < 3) w = remaining;
      if (rng.chance(0.12) && w <= 5) {
        map.fillRect(cx, rowY, w, rowH, Tile.Plaza);
      } else {
        map.fillRect(cx, rowY, w, rowH, Tile.Building);
        const doorX = cx + rng.int(1, w - 2);
        const doorY = facing === 'north' ? rowY : rowY + rowH - 1;
        out.push({
          id: `bld-${blockKey}-${out.length}`,
          x: cx,
          y: rowY,
          w,
          h: rowH,
          name: '',
          kind: 'residential',
          description: '',
          neon: null,
          service: null,
          style: rng.int(0, 5),
          door: { tx: doorX, ty: doorY, facing },
          entrance: { tx: doorX, ty: facing === 'north' ? doorY - 1 : doorY + 1 },
        });
      }
      cx += w;
      if (cx < end && end - cx >= 4 && rng.chance(0.3)) {
        map.fillRect(cx, rowY, 1, rowH, Tile.Alley);
        cx += 1;
      }
    }
  };
  fillRow(iy, northH, 'north');
  fillRow(iy + ih - southH, southH, 'south');

  // Dumpsters only on the alley's upper row, so the lower row always stays open.
  for (let x = ix + 1; x < ix + iw - 1; x++) {
    if (map.get(x, alleyY - 1) === Tile.Building && rng.chance(0.12)) {
      addProp({ kind: 'dumpster', x, y: alleyY, w: 1, h: 1, solid: true, variant: rng.int(0, 2), facing: 'south' });
      x += 2;
    }
  }
}

function buildPark(map: TileMap, rng: Rng, ix: number, iy: number, iw: number, ih: number, addProp: AddProp, pond = true): void {
  map.fillRect(ix, iy, iw, ih, Tile.Grass);
  const pathX = ix + Math.floor(iw / 2) - 1;
  const pathY = iy + Math.floor(ih / 2) - 1;
  map.fillRect(pathX, iy, 2, ih, Tile.Plaza);
  map.fillRect(ix, pathY, iw, 2, Tile.Plaza);

  // Pond in the north-east quadrant, inset so grass always surrounds it.
  const qx = pathX + 3;
  const qw = ix + iw - 1 - qx;
  const qh = pathY - 1 - (iy + 1);
  if (pond && qw >= 3 && qh >= 2) map.fillRect(qx, iy + 1, qw, qh, Tile.Water);

  // Trees on a sparse lattice: no two trees are ever adjacent, so they cannot enclose a tile.
  for (let ty = iy + 1; ty < iy + ih - 1; ty += 3) {
    for (let tx = ix + 1; tx < ix + iw - 1; tx += 3) {
      if (map.get(tx, ty) !== Tile.Grass) continue;
      if (map.get(tx - 1, ty) === Tile.Water || map.get(tx + 1, ty) === Tile.Water) continue;
      if (map.get(tx, ty - 1) === Tile.Water || map.get(tx, ty + 1) === Tile.Water) continue;
      if (rng.chance(0.7)) map.set(tx, ty, Tile.Tree);
    }
  }

  addProp({ kind: 'bench', x: pathX - 1, y: pathY + 3, w: 1, h: 1, solid: false, variant: 0, facing: 'east' });
  addProp({ kind: 'bench', x: pathX + 2, y: pathY - 2, w: 1, h: 1, solid: false, variant: 0, facing: 'west' });
}

function placeStreetFurniture(
  map: TileMap,
  rng: Rng,
  x0: number,
  y0: number,
  bw: number,
  bh: number,
  addProp: AddProp,
): void {
  // Street lamps along the outer sidewalk ring.
  for (let x = x0 + 3; x <= x0 + bw - 4; x += 6) {
    addProp({ kind: 'street-lamp', x, y: y0, w: 1, h: 1, solid: false, variant: 0, facing: 'north' });
    addProp({ kind: 'street-lamp', x, y: y0 + bh - 1, w: 1, h: 1, solid: false, variant: 0, facing: 'south' });
  }
  for (let y = y0 + 4; y <= y0 + bh - 5; y += 6) {
    addProp({ kind: 'street-lamp', x: x0, y, w: 1, h: 1, solid: false, variant: 0, facing: 'west' });
    addProp({ kind: 'street-lamp', x: x0 + bw - 1, y, w: 1, h: 1, solid: false, variant: 0, facing: 'east' });
  }

  // Parked cars in the curb lane, kept clear of crosswalks.
  const isLane = (tx: number, ty: number) => map.get(tx, ty) === Tile.Road;
  for (let x = x0 + 2; x <= x0 + bw - 4; x++) {
    if (isLane(x, y0 - 1) && isLane(x + 1, y0 - 1) && rng.chance(0.14)) {
      addProp({ kind: 'parked-car', x, y: y0 - 1, w: 2, h: 1, solid: false, variant: rng.int(0, 5), facing: 'east' });
      x += 3;
    }
  }
  for (let x = x0 + 2; x <= x0 + bw - 4; x++) {
    if (isLane(x, y0 + bh) && isLane(x + 1, y0 + bh) && rng.chance(0.14)) {
      addProp({ kind: 'parked-car', x, y: y0 + bh, w: 2, h: 1, solid: false, variant: rng.int(0, 5), facing: 'west' });
      x += 3;
    }
  }
  for (let y = y0 + 2; y <= y0 + bh - 4; y++) {
    if (isLane(x0 - 1, y) && isLane(x0 - 1, y + 1) && rng.chance(0.14)) {
      addProp({ kind: 'parked-car', x: x0 - 1, y, w: 1, h: 2, solid: false, variant: rng.int(0, 5), facing: 'south' });
      y += 3;
    }
  }
}

function assignBuildingIdentities(buildings: Building[], def: DistrictDefinition, rng: Rng): void {
  const order = buildings.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = order[i] as number;
    order[i] = order[j] as number;
    order[j] = tmp;
  }
  const residential: BuildingTemplate = {
    name: '',
    kind: 'residential',
    description: '',
  };
  order.forEach((buildingIndex, rank) => {
    const b = buildings[buildingIndex];
    if (!b) return;
    const template = def.namedBuildings[rank] ?? residential;
    if (template.name) {
      b.name = template.name;
      b.kind = template.kind;
      b.description = template.description;
      b.neon = template.neon ?? null;
      b.service = template.service ?? null;
    } else {
      const name = rng.pick(def.residentialNames);
      b.name = name;
      b.kind = 'residential';
      b.description = rng.pick(RESIDENTIAL_FLAVOUR);
    }
  });
}

const RESIDENTIAL_FLAVOUR = [
  'Buzzers with half the names scratched off. Somewhere upstairs a radio plays an old ballad.',
  'The door is propped open with a brick. The stairwell smells of rain and frying onions.',
  'A child has chalked a lopsided Wildling on the step. It has far too many teeth.',
  'Laundry lines zig-zag between windows. Something small and furry is asleep in a basket.',
  'A notice from the landlord: RENT DUE FRIDAY. Under it, in marker: SAYS WHO.',
  'Locked. Through the grille you can hear an argument about whose turn it is to feed the cat-thing.',
];
