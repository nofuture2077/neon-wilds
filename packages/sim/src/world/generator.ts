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

/**
 * Deterministically builds a district from a data definition and a seed.
 *
 * Layout model (GTA-style grid):
 *   road band | block | road band | block | ... | road band
 * Each block has a 2-tile sidewalk ring. Building blocks contain two rows of
 * lots facing the sidewalks, separated by a service alley. One block is a park.
 * Crosswalks connect block corners so pedestrians never need to walk on roads.
 */
export function generateDistrict(def: DistrictDefinition, seed: number): DistrictLayout {
  const rng = new Rng(deriveSeed(seed, `district:${def.id}`));
  const { blocksX, blocksY, blockW, blockH, roadW } = def;
  const width = roadW + blocksX * (blockW + roadW);
  const height = roadW + blocksY * (blockH + roadW);
  const map = new TileMap(width, height);

  const bandX = (i: number) => i * (blockW + roadW);
  const bandY = (j: number) => j * (blockH + roadW);
  const blockX = (bx: number) => roadW + bx * (blockW + roadW);
  const blockY = (by: number) => roadW + by * (blockH + roadW);
  const inVBand = (x: number) => x % (blockW + roadW) < roadW;
  const inHBand = (y: number) => y % (blockH + roadW) < roadW;
  const mid = Math.floor(roadW / 2);

  // 1. Roads with centre lines (intersections stay plain asphalt).
  map.fillRect(0, 0, width, height, Tile.Road);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = inVBand(x);
      const h = inHBand(y);
      if (v && !h && x % (blockW + roadW) === mid) map.set(x, y, Tile.RoadLineV);
      if (h && !v && y % (blockH + roadW) === mid) map.set(x, y, Tile.RoadLineH);
    }
  }

  // 2. Crosswalks between neighbouring blocks, adjacent to each intersection.
  for (let i = 1; i < blocksX; i++) {
    for (let by = 0; by < blocksY; by++) {
      for (const y of [blockY(by), blockY(by) + blockH - 1]) {
        for (let x = bandX(i); x < bandX(i) + roadW; x++) map.set(x, y, Tile.CrosswalkH);
      }
    }
  }
  for (let j = 1; j < blocksY; j++) {
    for (let bx = 0; bx < blocksX; bx++) {
      for (const x of [blockX(bx), blockX(bx) + blockW - 1]) {
        for (let y = bandY(j); y < bandY(j) + roadW; y++) map.set(x, y, Tile.CrosswalkV);
      }
    }
  }

  // 3. Blocks.
  const buildings: Building[] = [];
  const props: Prop[] = [];
  let propSeq = 0;
  const addProp = (p: Omit<Prop, 'id'>) => props.push({ ...p, id: `prop-${propSeq++}` });

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const x0 = blockX(bx);
      const y0 = blockY(by);
      map.fillRect(x0, y0, blockW, blockH, Tile.Sidewalk);
      const ix = x0 + 2;
      const iy = y0 + 2;
      const iw = blockW - 4;
      const ih = blockH - 4;
      if (bx === def.parkBlock.bx && by === def.parkBlock.by) {
        buildPark(map, rng, ix, iy, iw, ih, addProp);
      } else {
        buildLots(map, rng, ix, iy, iw, ih, buildings, addProp, `${bx}-${by}`);
      }
      placeStreetFurniture(map, rng, x0, y0, blockW, blockH, addProp);
    }
  }

  assignBuildingIdentities(buildings, def, rng);

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

  const spawnBx = Math.min(1, blocksX - 1);
  const spawnBy = Math.min(1, blocksY - 1);
  const playerSpawn = {
    x: blockX(spawnBx) + Math.floor(blockW / 2) + 0.5,
    y: blockY(spawnBy) + 0.5,
  };

  const pedestrianSpawns: { tx: number; ty: number }[] = [];
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      if (map.get(tx, ty) === Tile.Sidewalk && !map.isSolid(tx, ty)) pedestrianSpawns.push({ tx, ty });
    }
  }

  return { id: def.id, name: def.name, map, buildings, props, streets, playerSpawn, pedestrianSpawns };
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
  const northH = Math.floor((ih - 2) / 2);
  const southH = ih - 2 - northH;
  const alleyY = iy + northH;
  map.fillRect(ix, alleyY, iw, 2, Tile.Alley);

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
  fillRow(alleyY + 2, southH, 'south');

  // Dumpsters only on the alley's upper row, so the lower row always stays open.
  for (let x = ix + 1; x < ix + iw - 1; x++) {
    if (map.get(x, alleyY - 1) === Tile.Building && rng.chance(0.12)) {
      addProp({ kind: 'dumpster', x, y: alleyY, w: 1, h: 1, solid: true, variant: rng.int(0, 2), facing: 'south' });
      x += 2;
    }
  }
}

function buildPark(map: TileMap, rng: Rng, ix: number, iy: number, iw: number, ih: number, addProp: AddProp): void {
  map.fillRect(ix, iy, iw, ih, Tile.Grass);
  const pathX = ix + Math.floor(iw / 2) - 1;
  const pathY = iy + Math.floor(ih / 2) - 1;
  map.fillRect(pathX, iy, 2, ih, Tile.Plaza);
  map.fillRect(ix, pathY, iw, 2, Tile.Plaza);

  // Pond in the north-east quadrant, inset so grass always surrounds it.
  const qx = pathX + 3;
  const qw = ix + iw - 1 - qx;
  const qh = pathY - 1 - (iy + 1);
  if (qw >= 3 && qh >= 2) map.fillRect(qx, iy + 1, qw, qh, Tile.Water);

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
      addProp({ kind: 'parked-car', x, y: y0 - 1, w: 2, h: 1, solid: true, variant: rng.int(0, 5), facing: 'east' });
      x += 3;
    }
  }
  for (let x = x0 + 2; x <= x0 + bw - 4; x++) {
    if (isLane(x, y0 + bh) && isLane(x + 1, y0 + bh) && rng.chance(0.14)) {
      addProp({ kind: 'parked-car', x, y: y0 + bh, w: 2, h: 1, solid: true, variant: rng.int(0, 5), facing: 'west' });
      x += 3;
    }
  }
  for (let y = y0 + 2; y <= y0 + bh - 4; y++) {
    if (isLane(x0 - 1, y) && isLane(x0 - 1, y + 1) && rng.chance(0.14)) {
      addProp({ kind: 'parked-car', x: x0 - 1, y, w: 1, h: 2, solid: true, variant: rng.int(0, 5), facing: 'south' });
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
