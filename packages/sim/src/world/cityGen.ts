import { Rng, deriveSeed } from '../core/rng';
import type { Building, BuildingTemplate, CityBlock, DistrictLayout, Facing, Prop } from './district';
import { TileMap } from './tilemap';
import { Tile } from './tiles';

/**
 * World generation v3 — one seamless, organic city (WORLD_GEN.md).
 *
 * Layers:
 *  1. Regions: authored anchors per district, organic borders (noise-warped
 *     Voronoi), a ragged coastline in the south-east.
 *  2. Road graph: per-region nodes on a rotated, jittered lattice (Downtown
 *     near-regular, Slums wild), a Gabriel graph (planar), a spanning tree
 *     plus extra edges for loops, and gently winding Bezier edges.
 *  3. Rasterisation: road and sidewalk tiles by distance to the curves,
 *     crosswalks a few tiles out from every junction.
 *  4. Blocks: whatever the roads leave free, flood-filled into irregular
 *     shapes; each becomes buildings along its frontage plus courtyards,
 *     an organic park, a plaza, docks or wilderness depending on region.
 *  5. Identity: authored landmarks and named buildings per region,
 *     street names that follow the straightest continuation.
 * Invariants (tested): connected road network, connected pedestrian
 * network, every entrance reachable, every named place placed exactly once.
 */
export interface RegionDefinition {
  id: string;
  name: string;
  style: 'slums' | 'downtown' | 'harbor' | 'industrial';
  /** Anchor in map fractions. */
  anchor: { x: number; y: number };
  spacing: number;
  jitter: number;
  /** Street lattice rotation (radians). */
  angle: number;
  /** How much edges bend (0 = straight). */
  curviness: number;
  /** Extra (non-tree) edges kept, 0..1. */
  loops: number;
  buildingW: [number, number];
  buildingH: [number, number];
  parkChance: number;
  namedBuildings: BuildingTemplate[];
  residentialNames: string[];
  streetNames: string[];
}

export interface CityDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  regions: RegionDefinition[];
  spawnRegion: string;
}

export interface RoadNode {
  id: number;
  x: number;
  y: number;
  edges: number[];
}

export interface RoadEdge {
  id: number;
  a: number;
  b: number;
  /** Centre line from node a to node b, roughly one point per tile. */
  points: { x: number; y: number }[];
  length: number;
  name: string;
}

export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadEdge[];
}

export const ROAD_HALF = 2.6;
export const SIDEWALK_OUTER = 4.6;
export const CROSSWALK_AT = 4.2;
/** How deep the built-up fringe along outskirt roads reaches before the land turns wild. */
const OUTSKIRT_FRINGE = 13;

export function generateCity(def: CityDefinition, seed: number): DistrictLayout {
  const rng = new Rng(deriveSeed(seed, `city:${def.id}`));
  const W = def.width;
  const H = def.height;
  const map = new TileMap(W, H);
  const noise = makeNoise(deriveSeed(seed, 'noise'));

  // 1. Regions and sea -----------------------------------------------------------------------
  const regionMap = new Uint8Array(W * H);
  const sea = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x / W;
      const fy = y / H;
      // Ragged south-east coastline.
      const coast = fx * 0.62 + fy * 0.38 + (noise(x * 0.06, y * 0.06) - 0.5) * 0.06;
      if (coast > 0.87) sea[y * W + x] = 1;
      let best = 0;
      let bestD = Infinity;
      def.regions.forEach((r, i) => {
        const dx = fx - r.anchor.x;
        const dy = (fy - r.anchor.y) * (H / W);
        const d = Math.hypot(dx, dy) + (noise(x * 0.035 + i * 17, y * 0.035) - 0.5) * 0.09;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      regionMap[y * W + x] = best;
    }
  }
  const isSea = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || sea[Math.floor(y) * W + Math.floor(x)] === 1;
  const regionAtXY = (x: number, y: number) => regionMap[Math.min(H - 1, Math.max(0, Math.floor(y))) * W + Math.min(W - 1, Math.max(0, Math.floor(x)))]!;

  // 2. Road graph ----------------------------------------------------------------------------------
  const nodes: RoadNode[] = [];
  def.regions.forEach((r, ri) => {
    const ax = r.anchor.x * W;
    const ay = r.anchor.y * H;
    const cos = Math.cos(r.angle);
    const sin = Math.sin(r.angle);
    const span = Math.ceil(Math.max(W, H) / r.spacing) + 2;
    for (let gy = -span; gy <= span; gy++) {
      for (let gx = -span; gx <= span; gx++) {
        const lx = gx * r.spacing + rng.range(-r.jitter, r.jitter) * r.spacing;
        const ly = gy * r.spacing + rng.range(-r.jitter, r.jitter) * r.spacing;
        const x = ax + lx * cos - ly * sin;
        const y = ay + lx * sin + ly * cos;
        if (x < 8 || y < 8 || x > W - 8 || y > H - 8) continue;
        if (regionAtXY(x, y) !== ri) continue;
        if (nearSea(isSea, x, y, 9)) continue;
        if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < r.spacing * 0.55)) continue;
        nodes.push({ id: nodes.length, x, y, edges: [] });
      }
    }
  });

  // Gabriel graph: edge (i, j) if no other node lies inside the circle with diameter ij.
  const maxSpacing = Math.max(...def.regions.map((r) => r.spacing));
  const candidates: Array<{ a: number; b: number; len: number }> = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const A = nodes[i]!;
      const B = nodes[j]!;
      const len = Math.hypot(A.x - B.x, A.y - B.y);
      if (len > maxSpacing * 1.9) continue;
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      const r2 = (len / 2) ** 2;
      let blocked = false;
      for (let k = 0; k < nodes.length && !blocked; k++) {
        if (k === i || k === j) continue;
        const C = nodes[k]!;
        if ((C.x - mx) ** 2 + (C.y - my) ** 2 < r2) blocked = true;
      }
      if (blocked || segmentCrossesSea(isSea, A, B)) continue;
      candidates.push({ a: i, b: j, len });
    }
  }
  // Spanning tree (Kruskal) for guaranteed connectivity, then extra edges for loops.
  candidates.sort((p, q) => p.len - q.len || p.a - q.a || p.b - q.b);
  const parent = nodes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const chosen: Array<{ a: number; b: number }> = [];
  for (const c of candidates) {
    const ra = find(c.a);
    const rb = find(c.b);
    if (ra !== rb) {
      parent[ra] = rb;
      chosen.push(c);
    } else {
      const region = def.regions[regionAtXY((nodes[c.a]!.x + nodes[c.b]!.x) / 2, (nodes[c.a]!.y + nodes[c.b]!.y) / 2)]!;
      if (rng.chance(region.loops)) chosen.push(c);
    }
  }
  // Keep only the largest connected component.
  const comp = new Map<number, number>();
  for (const c of chosen) comp.set(find(c.a), (comp.get(find(c.a)) ?? 0) + 1);
  const mainRoot = [...comp.entries()].sort((p, q) => q[1] - p[1])[0]?.[0];
  const edges: RoadEdge[] = [];
  for (const c of chosen) {
    if (find(c.a) !== mainRoot) continue;
    const A = nodes[c.a]!;
    const B = nodes[c.b]!;
    const region = def.regions[regionAtXY((A.x + B.x) / 2, (A.y + B.y) / 2)]!;
    const len = Math.hypot(A.x - B.x, A.y - B.y);
    const bend = rng.range(-1, 1) * region.curviness * len * 0.28;
    const nx = -(B.y - A.y) / len;
    const ny = (B.x - A.x) / len;
    let cx = (A.x + B.x) / 2 + nx * bend;
    let cy = (A.y + B.y) / 2 + ny * bend;
    if (segmentCrossesSea(isSea, A, { x: cx, y: cy }) || segmentCrossesSea(isSea, { x: cx, y: cy }, B)) {
      cx = (A.x + B.x) / 2;
      cy = (A.y + B.y) / 2;
    }
    const steps = Math.max(2, Math.ceil(len));
    const points: { x: number; y: number }[] = [];
    let total = 0;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = (1 - t) * (1 - t) * A.x + 2 * (1 - t) * t * cx + t * t * B.x;
      const y = (1 - t) * (1 - t) * A.y + 2 * (1 - t) * t * cy + t * t * B.y;
      const prev = points[points.length - 1];
      if (prev) total += Math.hypot(x - prev.x, y - prev.y);
      points.push({ x, y });
    }
    const e: RoadEdge = { id: edges.length, a: c.a, b: c.b, points, length: total, name: '' };
    edges.push(e);
    A.edges.push(e.id);
    B.edges.push(e.id);
  }
  // Drop orphan nodes and re-index.
  const used = nodes.filter((n) => n.edges.length > 0);
  const remap = new Map(used.map((n, i) => [n.id, i]));
  const graph: RoadGraph = {
    nodes: used.map((n, i) => ({ id: i, x: n.x, y: n.y, edges: [] })),
    edges: edges.map((e) => ({ ...e, a: remap.get(e.a)!, b: remap.get(e.b)! })),
  };
  for (const e of graph.edges) {
    graph.nodes[e.a]!.edges.push(e.id);
    graph.nodes[e.b]!.edges.push(e.id);
  }
  nameStreets(graph, def, regionAtXY, rng);

  // 3. Rasterise roads and sidewalks -------------------------------------------------------
  const dist = new Float32Array(W * H).fill(Infinity);
  const nearestEdge = new Int32Array(W * H).fill(-1);
  const stamp = (px: number, py: number, qx: number, qy: number, edgeId: number) => {
    const minX = Math.max(0, Math.floor(Math.min(px, qx) - SIDEWALK_OUTER - 1));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(px, qx) + SIDEWALK_OUTER + 1));
    const minY = Math.max(0, Math.floor(Math.min(py, qy) - SIDEWALK_OUTER - 1));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(py, qy) + SIDEWALK_OUTER + 1));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = segDist(x + 0.5, y + 0.5, px, py, qx, qy);
        const i = y * W + x;
        if (d < dist[i]!) {
          dist[i] = d;
          if (edgeId >= 0) nearestEdge[i] = edgeId;
        }
      }
    }
  };
  for (const e of graph.edges) for (let k = 1; k < e.points.length; k++) stamp(e.points[k - 1]!.x, e.points[k - 1]!.y, e.points[k]!.x, e.points[k]!.y, e.id);
  for (const n of graph.nodes) stamp(n.x, n.y, n.x, n.y, -1);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (sea[i]) map.set(x, y, Tile.Water);
      else if (dist[i]! <= ROAD_HALF) map.set(x, y, Tile.Road);
      else if (dist[i]! <= SIDEWALK_OUTER) map.set(x, y, Tile.Sidewalk);
      else map.set(x, y, Tile.Void); // to be filled by blocks
    }
  }

  // Crosswalks a few tiles out from each junction, across the road.
  for (const e of graph.edges) {
    for (const end of [0, 1] as const) {
      const node = graph.nodes[end === 0 ? e.a : e.b]!;
      if (node.edges.length < 2) continue;
      const p = pointAtDistance(e.points, end === 0 ? CROSSWALK_AT : e.length - CROSSWALK_AT);
      if (!p || e.length < CROSSWALK_AT * 3) continue;
      const along = Math.abs(p.tx) > Math.abs(p.ty);
      // A 4-connected strip from the sidewalk on one side to the other, so pedestrians can always cross.
      const reachOut = ROAD_HALF + 1.2;
      const ax = p.x + p.ty * reachOut;
      const ay = p.y - p.tx * reachOut;
      const bx = p.x - p.ty * reachOut;
      const by = p.y + p.tx * reachOut;
      if (map.get(Math.floor(ax), Math.floor(ay)) !== Tile.Sidewalk || map.get(Math.floor(bx), Math.floor(by)) !== Tile.Sidewalk) continue;
      const path: number[] = [];
      let cx = Math.floor(ax);
      let cy = Math.floor(ay);
      const steps = Math.ceil(reachOut * 2 * 4);
      for (let k = 1; k <= steps; k++) {
        const nx = Math.floor(ax + ((bx - ax) * k) / steps);
        const ny = Math.floor(ay + ((by - ay) * k) / steps);
        if (nx !== cx && ny !== cy) path.push(ny * W + cx); // fill the diagonal corner
        if (nx !== cx || ny !== cy) path.push(ny * W + nx);
        cx = nx;
        cy = ny;
      }
      for (const i of path) if (map.tiles[i] === Tile.Road) map.tiles[i] = along ? Tile.CrosswalkV : Tile.CrosswalkH;
    }
  }

  // 4. Blocks ------------------------------------------------------------------------------------
  const blockId = new Int32Array(W * H).fill(-1);
  const blocks: CityBlock[] = [];
  const blockTiles: number[][] = [];
  const floodVoid = (start: number, mark: Int32Array, id: number, same: (i: number) => boolean): number[] => {
    const tiles: number[] = [];
    const stack = [start];
    mark[start] = id;
    while (stack.length) {
      const i = stack.pop()!;
      tiles.push(i);
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (map.tiles[ni] === Tile.Void && mark[ni] === -1 && same(ni)) {
          mark[ni] = id;
          stack.push(ni);
        }
      }
    }
    return tiles;
  };
  // Faces enclosed by roads become blocks. The open outskirts (faces touching the map edge) are
  // split into a built-up fringe along the roads and wild land beyond it.
  const faceOf = new Int32Array(W * H).fill(-1);
  const pieces: Array<{ tiles: number[]; outskirts: boolean; far: boolean }> = [];
  let compCount = 0;
  for (let start = 0; start < W * H; start++) {
    if (map.tiles[start] !== Tile.Void || faceOf[start] !== -1) continue;
    const tiles = floodVoid(start, faceOf, compCount++, () => true);
    const touches = tiles.some((i) => {
      const x = i % W;
      const y = (i - x) / W;
      return x === 0 || y === 0 || x === W - 1 || y === H - 1;
    });
    if (!touches) {
      pieces.push({ tiles, outskirts: false, far: false });
      continue;
    }
    const isFar = (i: number) => dist[i]! > OUTSKIRT_FRINGE;
    const sub = new Int32Array(W * H).fill(-1);
    let subId = 0;
    for (const i of tiles) {
      if (sub[i] !== -1) continue;
      const far = isFar(i);
      pieces.push({ tiles: floodVoid(i, sub, subId++, (j) => faceOf[j] === faceOf[i] && isFar(j) === far && (far || nearestEdge[j] === nearestEdge[i])), outskirts: true, far });
    }
  }
  for (const piece of pieces) {
    const tiles = piece.tiles;
    for (const i of tiles) blockId[i] = blocks.length;
    let minX = W;
    let minY = H;
    let maxX = 0;
    let maxY = 0;
    const counts = new Map<number, number>();
    for (const i of tiles) {
      const x = i % W;
      const y = (i - x) / W;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      counts.set(regionMap[i]!, (counts.get(regionMap[i]!) ?? 0) + 1);
    }
    const region = [...counts.entries()].sort((p, q) => q[1] - p[1])[0]![0];
    blocks.push({
      id: `block-${blocks.length}`,
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
      kind: piece.far ? 'wild' : 'lots',
      region: def.regions[region]!.id,
      area: tiles.length,
    });
    blockTiles.push(tiles);
  }

  // 5. Fill blocks ----------------------------------------------------------------------------
  const buildings: Building[] = [];
  const props: Prop[] = [];
  let propSeq = 0;
  const addProp = (p: Omit<Prop, 'id'>) => props.push({ ...p, id: `prop-${propSeq++}` });
  const regionDef = (id: string) => def.regions.find((r) => r.id === id)!;
  // One organic park per region: the block of moderate size nearest the region anchor.
  const parkBlocks = new Set<number>();
  for (const r of def.regions) {
    const ax = r.anchor.x * W;
    const ay = r.anchor.y * H;
    const options = blocks
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.region === r.id && b.kind === 'lots' && b.area > 180 && b.area < 1400)
      .sort((p, q) => Math.hypot(p.b.x + p.b.w / 2 - ax - r.spacing, p.b.y + p.b.h / 2 - ay) - Math.hypot(q.b.x + q.b.w / 2 - ax - r.spacing, q.b.y + q.b.h / 2 - ay));
    if (options[0]) parkBlocks.add(options[0].i);
  }

  blocks.forEach((b, bi) => {
    const tiles = blockTiles[bi]!;
    const r = regionDef(b.region);
    const docks = r.style === 'harbor' && tiles.some((i) => nearTile(sea, W, H, i, 3));
    if (b.kind === 'wild') {
      fillWild(map, rng, tiles, W, addProp);
    } else if (b.area < 24) {
      for (const i of tiles) map.tiles[i] = rng.chance(0.5) ? Tile.Grass : Tile.Plaza;
      b.kind = 'pocket';
    } else if (docks) {
      fillDocks(map, rng, tiles, W, H, sea, addProp);
      b.kind = 'docks';
    } else if (parkBlocks.has(bi) || (b.area < 900 && rng.chance(r.parkChance))) {
      fillPark(map, rng, tiles, W, addProp);
      b.kind = 'park';
    }
  });

  // Buildings line the streets, rotated to match them (the art stays upright: rotations stay within ±45°,
  // and the door side is picked in the building's own frame).
  const covers = new Map<Building, number[]>();
  const isLots = (i: number) => {
    const id = blockId[i]!;
    return id >= 0 && blocks[id]!.kind === 'lots';
  };
  const reduceAngle = (theta: number) => {
    const r = theta - (Math.PI / 2) * Math.round(theta / (Math.PI / 2));
    return Math.abs(r) < 0.06 ? 0 : r;
  };
  const facingToward = (angle: number, dx: number, dy: number): Facing => {
    const du = dx * Math.cos(angle) + dy * Math.sin(angle);
    const dv = -dx * Math.sin(angle) + dy * Math.cos(angle);
    if (Math.abs(dv) >= Math.abs(du)) return dv > 0 ? 'south' : 'north';
    return du > 0 ? 'east' : 'west';
  };
  const LOCAL_OUT: Record<Facing, [number, number]> = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] };
  const tryPlace = (cx: number, cy: number, angle: number, w: number, h: number, facing: Facing, margin: number, onlyBlock: number | null): Building | null => {
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    const ex = Math.abs(c) * (w / 2 + margin) + Math.abs(sn) * (h / 2 + margin) + 1;
    const ey = Math.abs(sn) * (w / 2 + margin) + Math.abs(c) * (h / 2 + margin) + 1;
    const cover: number[] = [];
    let block = onlyBlock;
    for (let y = Math.floor(cy - ey); y <= Math.ceil(cy + ey); y++) {
      for (let x = Math.floor(cx - ex); x <= Math.ceil(cx + ex); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const u = Math.abs(dx * c + dy * sn);
        const v = Math.abs(-dx * sn + dy * c);
        const inside = u <= w / 2 && v <= h / 2;
        const near = u <= w / 2 + margin && v <= h / 2 + margin;
        if (!near) continue;
        if (x < 0 || y < 0 || x >= W || y >= H) {
          if (inside) return null;
          continue;
        }
        const i = y * W + x;
        if (inside) {
          if (map.tiles[i] !== Tile.Void || !isLots(i)) return null;
          if (block === null) block = blockId[i]!;
          else if (blockId[i] !== block) return null;
          cover.push(i);
        } else if (map.tiles[i] === Tile.Building) return null;
      }
    }
    if (block === null || cover.length < w * h * 0.7) return null;
    // Door: the covered tile nearest the middle of the facing side; the entrance is one step outside.
    const [lx, ly] = LOCAL_OUT[facing];
    const ox = lx * c - ly * sn;
    const oy = lx * sn + ly * c;
    const half = facing === 'north' || facing === 'south' ? h / 2 : w / 2;
    const fx = cx + ox * (half - 0.5);
    const fy = cy + oy * (half - 0.5);
    let door = cover[0]!;
    let best = Infinity;
    for (const i of cover) {
      const d = Math.hypot((i % W) + 0.5 - fx, Math.floor(i / W) + 0.5 - fy);
      if (d < best) {
        best = d;
        door = i;
      }
    }
    const dtx = door % W;
    const dty = Math.floor(door / W);
    // Step outward along the dominant axis so door and entrance share an edge.
    const [sx, sy] = Math.abs(ox) >= Math.abs(oy) ? [Math.sign(ox), 0] : [0, Math.sign(oy)];
    const etx = dtx + sx;
    const ety = dty + sy;
    const et = map.get(etx, ety);
    if (cover.includes(ety * W + etx) || (et !== Tile.Sidewalk && !(et === Tile.Void && blockId[ety * W + etx] === block))) return null;
    for (const i of cover) map.tiles[i] = Tile.Building;
    const blk = blocks[block]!;
    const b: Building = {
      id: `bld-${blk.id}-${buildings.length}`,
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
      angle,
      name: '',
      kind: 'residential',
      description: '',
      neon: null,
      service: null,
      style: rng.int(0, 5),
      door: { tx: dtx, ty: dty, facing },
      entrance: { tx: etx, ty: ety },
      region: blk.region,
      landmark: false,
    };
    covers.set(b, cover);
    buildings.push(b);
    return b;
  };

  // Street fronts: walk both sides of every street and line it with buildings.
  for (const e of graph.edges) {
    for (const side of [-1, 1] as const) {
      let s = rng.range(0, 2);
      while (s < e.length - 2) {
        const p0 = pointAtDistance(e.points, s)!;
        const r = def.regions[regionAtXY(p0.x, p0.y)]!;
        const baseLen = rng.int(r.buildingW[0], r.buildingW[1]);
        const baseDepth = rng.int(r.buildingH[0], r.buildingH[1]);
        let placed: Building | null = null;
        let len = baseLen;
        // Shrink until it fits (curves, corners and shallow blocks need smaller buildings).
        for (let attempt = 0; attempt < 4 && !placed; attempt++) {
          len = Math.max(3, Math.round(baseLen * (1 - attempt * 0.2)));
          const depth = Math.max(3, Math.round(baseDepth * (1 - attempt * 0.2)));
          const m = pointAtDistance(e.points, Math.min(e.length, s + len / 2));
          if (!m) break;
          const nx = -m.ty * side; // toward the block
          const ny = m.tx * side;
          const angle = reduceAngle(Math.atan2(m.ty, m.tx));
          const alongU = Math.abs(m.tx * Math.cos(angle) + m.ty * Math.sin(angle)) > 0.7;
          const [w, h] = alongU ? [len, depth] : [depth, len];
          const off = SIDEWALK_OUTER + 0.55 + depth / 2;
          placed = tryPlace(m.x + nx * off, m.y + ny * off, angle, w, h, facingToward(angle, -nx, -ny), 1, null);
        }
        s += placed ? len + rng.range(1.1, 2.5) : 1;
      }
    }
  }

  // Back lots: deep blocks get a second ring of buildings facing their courtyard, aligned with the block.
  blocks.forEach((b, bi) => {
    if (b.kind !== 'lots') return;
    const tiles = blockTiles[bi]!;
    const r = regionDef(b.region);
    const free = tiles.filter((i) => map.tiles[i] === Tile.Void);
    if (free.length > 120) {
      const mid = free[Math.floor(free.length / 2)]!;
      const edge = graph.edges[nearestEdge[mid]!] ?? graph.edges[0]!;
      const ea = edge.points[0]!;
      const eb = edge.points[edge.points.length - 1]!;
      const angle = reduceAngle(Math.atan2(eb.y - ea.y, eb.x - ea.x));
      const order = free.slice();
      for (let k = order.length - 1; k > 0; k--) {
        const j = rng.int(0, k);
        [order[k], order[j]] = [order[j]!, order[k]!];
      }
      let budget = Math.floor(free.length / 70);
      for (const i of order) {
        if (budget <= 0) break;
        if (map.tiles[i] !== Tile.Void) continue;
        const w = rng.int(r.buildingW[0], r.buildingW[1]);
        const h = rng.int(r.buildingH[0], r.buildingH[1]);
        const facing = rng.pick(['north', 'south', 'east', 'west'] as const);
        if (tryPlace((i % W) + 0.5, Math.floor(i / W) + 0.5, angle, w, h, facing, 2, bi)) budget--;
      }
    }
    fillYards(map, rng, tiles, W, addProp);
  });

  // Street lamps along the outer sidewalk edge, every ~7 tiles of road.
  for (const e of graph.edges) {
    for (let d = 3; d < e.length - 3; d += 7) {
      const p = pointAtDistance(e.points, d);
      if (!p) continue;
      for (const side of [-1, 1]) {
        const lx = Math.floor(p.x - p.ty * 3.6 * side);
        const ly = Math.floor(p.y + p.tx * 3.6 * side);
        if (map.get(lx, ly) === Tile.Sidewalk) {
          const facing: Facing = Math.abs(p.tx) > Math.abs(p.ty) ? (side * p.tx > 0 ? 'south' : 'north') : side * p.ty > 0 ? 'west' : 'east';
          addProp({ kind: 'street-lamp', x: lx, y: ly, w: 1, h: 1, solid: false, variant: 0, facing });
        }
      }
    }
  }

  map.rebuildCollision();
  for (const p of props) {
    if (!p.solid) continue;
    for (let ty = p.y; ty < p.y + p.h; ty++) for (let tx = p.x; tx < p.x + p.w; tx++) map.block(tx, ty);
  }

  // Pedestrian connectivity: anything walkable that can't be reached from the sidewalks becomes a fenced lot.
  const reach = new Uint8Array(W * H);
  const seedTile = map.tiles.findIndex((t, i) => t === Tile.Sidewalk && !map.blocked[i]);
  floodPed(map, seedTile, reach);
  for (let i = 0; i < W * H; i++) {
    const t = map.tiles[i] as number;
    if (!reach[i] && (t === Tile.CrosswalkH || t === Tile.CrosswalkV)) map.tiles[i] = Tile.Road;
    else if (!reach[i] && !map.blocked[i] && t !== Tile.Road && t !== Tile.Water) {
      map.tiles[i] = Tile.Lot;
      map.blocked[i] = 1;
    }
  }
  // Buildings whose door opens onto a cut-off pocket are fenced off as yards too.
  for (let k = buildings.length - 1; k >= 0; k--) {
    const b = buildings[k]!;
    if (reach[b.entrance.ty * W + b.entrance.tx] === 1) continue;
    for (const i of covers.get(b) ?? []) map.tiles[i] = Tile.Lot;
    buildings.splice(k, 1);
  }

  assignIdentities(buildings, def, rng);
  for (const b of buildings) if (!b.name) b.name = rng.pick(regionDef(b.region).residentialNames);

  // Player spawn: a reachable sidewalk tile near the spawn region's anchor.
  const sr = regionDef(def.spawnRegion);
  const anchor = { x: sr.anchor.x * W, y: sr.anchor.y * H };
  let spawn = anchor;
  let best = Infinity;
  for (let i = 0; i < W * H; i++) {
    if (map.tiles[i] !== Tile.Sidewalk || !reach[i]) continue;
    const x = i % W;
    const y = (i - x) / W;
    const d = Math.hypot(x - anchor.x, y - anchor.y);
    if (d < best) {
      best = d;
      spawn = { x: x + 0.5, y: y + 0.5 };
    }
  }

  const pedestrianSpawns: { tx: number; ty: number }[] = [];
  for (let i = 0; i < W * H; i++) {
    if (map.tiles[i] === Tile.Sidewalk && reach[i]) pedestrianSpawns.push({ tx: i % W, ty: Math.floor(i / W) });
  }

  return {
    id: def.id,
    name: def.name,
    style: 'slums',
    exits: [],
    map,
    blocks,
    buildings,
    props,
    streets: [],
    graph,
    regionMap,
    blockMap: blockId,
    regions: def.regions.map((r) => ({ id: r.id, name: r.name, style: r.style })),
    playerSpawn: spawn,
    pedestrianSpawns,
  };
}

// ---------------------------------------------------------------------------------------------
// Block fillers

type AddProp = (p: Omit<Prop, 'id'>) => void;
const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** What's left of a lots block after the buildings: courtyards with benches, trees and parked cars, or alleys. */
function fillYards(map: TileMap, rng: Rng, tiles: number[], W: number, addProp: AddProp): void {
  // Leftover interior: courtyards with benches and trees, or service alleys.
  const left = tiles.filter((i) => map.tiles[i] === Tile.Void);
  const courtyard = left.length > 40;
  for (const i of left) {
    const x = i % W;
    const y = (i - x) / W;
    if (courtyard) {
      const tree = (x * 7 + y * 13) % 11 === 0 && rng.chance(0.6);
      map.set(x, y, tree ? Tile.Tree : rng.chance(0.75) ? Tile.Plaza : Tile.Grass);
    } else map.set(x, y, Tile.Alley);
  }
  if (courtyard) {
    for (let k = 0; k < Math.min(4, left.length / 30); k++) {
      const i = rng.pick(left);
      if (map.tiles[i] === Tile.Plaza) addProp({ kind: rng.chance(0.5) ? 'bench' : 'dumpster', x: i % W, y: Math.floor(i / W), w: 1, h: 1, solid: false, variant: 1, facing: 'south' });
    }
    // A few parked cars in larger yards.
    for (let k = 0; k < Math.floor(left.length / 80); k++) {
      const i = rng.pick(left);
      const x = i % W;
      const y = (i - x) / W;
      if (map.get(x, y) === Tile.Plaza && map.get(x + 1, y) === Tile.Plaza && left.includes(y * W + x + 1)) {
        addProp({ kind: 'parked-car', x, y, w: 2, h: 1, solid: false, variant: rng.int(0, 5), facing: 'east' });
      }
    }
  }
}

function fillPark(map: TileMap, rng: Rng, tiles: number[], W: number, addProp: AddProp): void {
  let cx = 0;
  let cy = 0;
  for (const i of tiles) {
    cx += i % W;
    cy += Math.floor(i / W);
  }
  cx /= tiles.length;
  cy /= tiles.length;
  const radius = Math.sqrt(tiles.length / Math.PI);
  const pondR = radius * rng.range(0.22, 0.35);
  const pondX = cx + rng.range(-0.25, 0.25) * radius;
  const pondY = cy + rng.range(-0.25, 0.25) * radius;
  for (const i of tiles) {
    const x = i % W;
    const y = (i - x) / W;
    const d = Math.hypot(x + 0.5 - pondX, y + 0.5 - pondY) / pondR + Math.sin(x * 0.9 + y * 0.7) * 0.12;
    map.set(x, y, d < 1 ? Tile.Water : Tile.Grass);
  }
  // Winding gravel paths from each side to a ring around the pond.
  const ringR = pondR + 1.8;
  for (const i of tiles) {
    const x = i % W;
    const y = (i - x) / W;
    const d = Math.hypot(x + 0.5 - pondX, y + 0.5 - pondY);
    if (Math.abs(d - ringR) < 0.8 && map.get(x, y) === Tile.Grass) map.set(x, y, Tile.Plaza);
  }
  for (const [dx, dy] of DIRS4) {
    let x = pondX + dx * ringR;
    let y = pondY + dy * ringR;
    for (let s = 0; s < radius * 2.5; s++) {
      const wob = Math.sin(s * 0.5 + dx * 3 + dy * 5) * 0.6;
      x += dx + (dy !== 0 ? wob : 0) * 0.5;
      y += dy + (dx !== 0 ? wob : 0) * 0.5;
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      const t = map.get(tx, ty);
      if (t === Tile.Sidewalk || t === Tile.Road || t === Tile.Void) break;
      if (t === Tile.Grass) map.set(tx, ty, Tile.Plaza);
      if (map.get(tx + (dy !== 0 ? 1 : 0), ty + (dx !== 0 ? 1 : 0)) === Tile.Grass) map.set(tx + (dy !== 0 ? 1 : 0), ty + (dx !== 0 ? 1 : 0), Tile.Plaza);
    }
  }
  // Trees on a sparse lattice (never adjacent, so they can't enclose anything), benches by the paths.
  for (const i of tiles) {
    const x = i % W;
    const y = (i - x) / W;
    if (map.get(x, y) !== Tile.Grass || (x + 2 * y) % 3 !== 0 || x % 2 !== 0) continue;
    if ([...DIRS4].some(([dx, dy]) => map.get(x + dx, y + dy) === Tile.Water || map.get(x + dx, y + dy) === Tile.Tree)) continue;
    if (rng.chance(0.55)) map.set(x, y, Tile.Tree);
  }
  let benches = 0;
  for (const i of tiles) {
    if (benches > 6) break;
    const x = i % W;
    const y = (i - x) / W;
    if (map.get(x, y) === Tile.Grass && map.get(x, y - 1) === Tile.Plaza && rng.chance(0.08)) {
      addProp({ kind: 'bench', x, y, w: 1, h: 1, solid: false, variant: 0, facing: 'north' });
      benches++;
    }
  }
}

function fillWild(map: TileMap, rng: Rng, tiles: number[], W: number, addProp: AddProp): void {
  void addProp;
  for (const i of tiles) {
    const x = i % W;
    const y = (i - x) / W;
    const tree = (x % 2 === 0 && (x + y) % 3 === 0 && rng.chance(0.5)) || rng.chance(0.03);
    map.set(x, y, tree ? Tile.Tree : Tile.Grass);
  }
}

function fillDocks(map: TileMap, rng: Rng, tiles: number[], W: number, H: number, sea: Uint8Array, addProp: AddProp): void {
  for (const i of tiles) map.tiles[i] = Tile.Plaza;
  // Container stacks in rows, leaving lanes between them.
  const set = new Set(tiles);
  for (const i of tiles) {
    const x = i % W;
    const y = (i - x) / W;
    if (y % 4 !== 1 || x % 5 !== 0) continue;
    if ([0, 1, 2].every((k) => set.has(y * W + x + k)) && !nearTile(sea, W, H, i, 2) && rng.chance(0.7)) {
      addProp({ kind: 'container', x, y, w: 3, h: 1, solid: true, variant: rng.int(0, 5), facing: 'east' });
    }
  }
  // Piers: plaza strips reaching out over the water from quay tiles.
  let piers = 0;
  for (const i of tiles) {
    if (piers >= 3) break;
    const x = i % W;
    const y = (i - x) / W;
    if (x % 9 !== 0) continue;
    const dir = sea[(y + 1) * W + x] ? [0, 1] : sea[y * W + x + 1] ? [1, 0] : null;
    if (!dir) continue;
    for (let s = 1; s <= 9; s++) {
      for (let w = 0; w < 2; w++) {
        const px = x + dir[0]! * s + (dir[0] === 0 ? w : 0);
        const py = y + dir[1]! * s + (dir[1] === 0 ? w : 0);
        if (px >= 0 && py >= 0 && px < W && py < H && map.get(px, py) === Tile.Water) map.set(px, py, Tile.Plaza);
      }
    }
    piers++;
  }
}

// ---------------------------------------------------------------------------------------------
// Identities, names, helpers

function assignIdentities(buildings: Building[], def: CityDefinition, rng: Rng): void {
  for (const r of def.regions) {
    const own = buildings.filter((b) => b.region === r.id);
    // The landmark (first template) goes to the biggest building near the region anchor.
    own.sort((p, q) => q.w * q.h - p.w * p.h || p.id.localeCompare(q.id));
    const order = own.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    if (own[0]) {
      order.splice(order.indexOf(own[0]), 1);
      order.unshift(own[0]);
    }
    r.namedBuildings.forEach((t, k) => {
      const b = order[k];
      if (!b) return;
      b.name = t.name;
      b.kind = t.kind;
      b.description = t.description;
      b.neon = t.neon ?? null;
      b.service = t.service ?? null;
      b.landmark = k === 0;
    });
    for (const b of own) {
      if (b.name) continue;
      b.kind = 'residential';
      b.description = rng.pick(RESIDENTIAL_FLAVOUR);
    }
  }
}

/** Street names follow the straightest continuation through each junction. */
function nameStreets(graph: RoadGraph, def: CityDefinition, regionAt: (x: number, y: number) => number, rng: Rng): void {
  const counters = new Map<string, number>();
  const dirAt = (e: RoadEdge, fromNode: number) => {
    const pts = e.points;
    const [p, q] = e.a === fromNode ? [pts[0]!, pts[Math.min(3, pts.length - 1)]!] : [pts[pts.length - 1]!, pts[Math.max(0, pts.length - 4)]!];
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { x: (q.x - p.x) / len, y: (q.y - p.y) / len };
  };
  for (const start of graph.edges) {
    if (start.name) continue;
    const mid = start.points[Math.floor(start.points.length / 2)]!;
    const region = def.regions[regionAt(mid.x, mid.y)]!;
    const k = counters.get(region.id) ?? 0;
    counters.set(region.id, k + 1);
    const name = region.streetNames[k % region.streetNames.length] + (k >= region.streetNames.length ? ` ${['East', 'West', 'Upper', 'Lower'][Math.floor(k / region.streetNames.length - 1) % 4]}` : '');
    start.name = name;
    // Extend both ways while the continuation is fairly straight.
    for (const endNode of [start.a, start.b]) {
      let edge = start;
      let node = endNode;
      for (let guard = 0; guard < 12; guard++) {
        const into = dirAt(edge, node);
        const n = graph.nodes[node]!;
        let best: RoadEdge | null = null;
        let bestDot = 0.75;
        for (const eid of n.edges) {
          const cand = graph.edges[eid]!;
          if (cand === edge || cand.name) continue;
          const out = dirAt(cand, node);
          const dot = -(into.x * out.x + into.y * out.y);
          if (dot > bestDot) {
            bestDot = dot;
            best = cand;
          }
        }
        if (!best) break;
        best.name = name;
        node = best.a === node ? best.b : best.a;
        edge = best;
      }
    }
  }
  void rng;
}

function floodPed(map: TileMap, start: number, out: Uint8Array): void {
  if (start < 0) return;
  const W = map.width;
  const stack = [start];
  out[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.isPedestrianWalkable(nx, ny)) continue;
      const ni = ny * W + nx;
      if (out[ni]) continue;
      out[ni] = 1;
      stack.push(ni);
    }
  }
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Point and unit tangent at arc length `d` along a polyline. */
export function pointAtDistance(points: { x: number; y: number }[], d: number): { x: number; y: number; tx: number; ty: number } | null {
  let acc = 0;
  for (let k = 1; k < points.length; k++) {
    const p = points[k - 1]!;
    const q = points[k]!;
    const seg = Math.hypot(q.x - p.x, q.y - p.y);
    if (seg <= 0) continue;
    if (acc + seg >= d) {
      const t = Math.max(0, (d - acc) / seg);
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, tx: (q.x - p.x) / seg, ty: (q.y - p.y) / seg };
    }
    acc += seg;
  }
  return null;
}

function nearSea(isSea: (x: number, y: number) => boolean, x: number, y: number, r: number): boolean {
  for (let a = 0; a < 8; a++) if (isSea(x + Math.cos(a) * r, y + Math.sin(a) * r)) return true;
  return isSea(x, y);
}

function segmentCrossesSea(isSea: (x: number, y: number) => boolean, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
  for (let k = 0; k <= n; k++) {
    const t = k / Math.max(1, n);
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (isSea(x, y) || isSea(x + 4, y) || isSea(x, y + 4) || isSea(x - 4, y) || isSea(x, y - 4)) return true;
  }
  return false;
}

function nearTile(mask: Uint8Array, W: number, H: number, i: number, r: number): boolean {
  const x = i % W;
  const y = (i - x) / W;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && mask[ny * W + nx]) return true;
    }
  }
  return false;
}

/** Smooth value noise in [0, 1]. */
function makeNoise(seed: number): (x: number, y: number) => number {
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

const RESIDENTIAL_FLAVOUR = [
  'Buzzers with half the names scratched off. Somewhere upstairs a radio plays an old ballad.',
  'The door is propped open with a brick. The stairwell smells of rain and frying onions.',
  'A child has chalked a lopsided Wildling on the step. It has far too many teeth.',
  'Laundry lines zig-zag between windows. Something small and furry is asleep in a basket.',
  'A notice from the landlord: RENT DUE FRIDAY. Under it, in marker: SAYS WHO.',
  'Locked. Through the grille you can hear an argument about whose turn it is to feed the cat-thing.',
];
