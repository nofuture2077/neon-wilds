import { Rng, deriveSeed } from '../core/rng';
import type { Building, BuildingTemplate, CityBlock, DistrictLayout, Facing, Prop } from './district';
import { TileMap } from './tilemap';
import { Tile, isRoadKind, type TileKind } from './tiles';

/**
 * World generation v4 — one seamless city on an orthogonal street plan (WORLD_GEN.md).
 *
 * Layers:
 *  1. Regions: authored anchors per district, organic borders (noise-warped
 *     Voronoi), a ragged coastline in the south-east.
 *  2. Street plan: recursive subdivision inside a ring road. Each split only
 *     crosses the area it divides, so streets end in T-junctions and jog
 *     between neighbourhoods; block size, regularity, superblocks and dead-end
 *     side streets come from the district. The first big splits are avenues.
 *  3. Rasterisation: tile-exact roads and sidewalks, crosswalks at junctions,
 *     dashed centre lines, tree-lined avenues.
 *  4. Blocks: the faces the streets leave. Each becomes frontage buildings
 *     (terraced or loose, some set back), back-lot buildings around a courtyard,
 *     a pedestrian alley, a park, a plaza, docks or wasteland.
 *  5. Identity: authored landmarks and named buildings per region,
 *     street names that follow straight continuations.
 * Invariants (tested): connected road network, connected pedestrian
 * network, every entrance reachable, every named place placed exactly once.
 */
export interface RegionDefinition {
  id: string;
  name: string;
  style: 'slums' | 'downtown' | 'harbor' | 'industrial' | 'oldtown';
  /** Anchor in map fractions. */
  anchor: { x: number; y: number };
  /** Block size range, street centre to street centre (tiles). */
  blockSize: [number, number];
  /** 0 = blocks split anywhere, 1 = always down the middle (grid-like). */
  regularity: number;
  /** Chance a mid-sized area stays whole: a plaza, park or brownfield. */
  superblocks: number;
  /** Chance a block gets a dead-end side street. */
  deadEnds: number;
  /** Chance a block is cut by a pedestrian alley. */
  alleys: number;
  /** Chance a frontage building steps back behind a forecourt. */
  setbacks: number;
  /** Chance a street side is built wall to wall. */
  terraces: number;
  /** Chance a block is left as overgrown wasteland. */
  wildChance: number;
  /** Chance the street between two blocks is dropped, merging them. */
  merges: number;
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
  /** Avenues have wider, tree-lined sidewalks. */
  avenue: boolean;
}

export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadEdge[];
}

/** Road tiles each side of the centre tile (roads are 5 tiles wide). */
const ROAD_TILES = 2;
/** Road plus sidewalk tiles each side of the centre tile (avenues get one more). */
const SIDEWALK_TILES = 4;
/** Half width of the asphalt from the centre line, in tiles. */
export const ROAD_HALF = ROAD_TILES + 0.5;
export const SIDEWALK_OUTER = SIDEWALK_TILES + 0.5;
/** Crosswalks sit this many tiles from the junction tile (two tiles wide). */
export const CROSSWALK_AT = 3;
/** The ring road runs this many tiles in from the map edge. */
const RING = 6;

interface Seg {
  horiz: boolean;
  /** Tile row (horizontal) or column (vertical) of the centre line. */
  c: number;
  /** First and last tile along the segment. */
  a: number;
  b: number;
  avenue: boolean;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

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

  // 2. Street plan ---------------------------------------------------------------------------------
  // Recursive subdivision: every split runs only across the area it divides, so neighbouring areas
  // split at different places — T-junctions, jogs and uneven blocks instead of a regular grid. Each
  // area takes its grammar (block size, regularity, superblocks, dead ends) from its district.
  const X0 = RING;
  const Y0 = RING;
  const X1 = W - 1 - RING;
  const Y1 = H - 1 - RING;
  const segs: Seg[] = [
    { horiz: true, c: Y0, a: X0, b: X1, avenue: true },
    { horiz: true, c: Y1, a: X0, b: X1, avenue: true },
    { horiz: false, c: X0, a: Y0, b: Y1, avenue: true },
    { horiz: false, c: X1, a: Y0, b: Y1, avenue: true },
  ];
  const superRects: Rect[] = [];
  const seaShare = (r: Rect) => {
    let n = 0;
    for (let k = 0; k < 25; k++) if (isSea(r.x0 + ((k % 5) + 0.5) * ((r.x1 - r.x0) / 5), r.y0 + (Math.floor(k / 5) + 0.5) * ((r.y1 - r.y0) / 5))) n++;
    return n / 25;
  };
  const split = (r: Rect, depth: number): void => {
    if (seaShare(r) > 0.7) return;
    const reg = def.regions[regionAtXY((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)]!;
    const [mn, mx] = reg.blockSize;
    const dx = r.x1 - r.x0;
    const dy = r.y1 - r.y0;
    const canV = dx >= mn * 2;
    const canH = dy >= mn * 2;
    const limit = mx * rng.range(0.8, 1.25);
    if ((!canV && !canH) || (dx <= limit && dy <= limit)) {
      addStub(r, reg);
      return;
    }
    if (depth >= 2 && dx < mx * 1.6 && dy < mx * 1.6 && rng.chance(reg.superblocks)) {
      superRects.push(r);
      return;
    }
    const vertical = canV && (!canH || rng.chance(dx >= dy ? 0.8 : 0.2));
    const span = vertical ? dx : dy;
    const t = 0.5 + (rng.next() - 0.5) * (1 - reg.regularity);
    const p = (vertical ? r.x0 : r.y0) + Math.round(mn + (span - mn * 2) * t);
    const avenue = depth <= 1 && span > 60;
    if (vertical) {
      segs.push({ horiz: false, c: p, a: r.y0, b: r.y1, avenue });
      split({ x0: r.x0, y0: r.y0, x1: p, y1: r.y1 }, depth + 1);
      split({ x0: p, y0: r.y0, x1: r.x1, y1: r.y1 }, depth + 1);
    } else {
      segs.push({ horiz: true, c: p, a: r.x0, b: r.x1, avenue });
      split({ x0: r.x0, y0: r.y0, x1: r.x1, y1: p }, depth + 1);
      split({ x0: r.x0, y0: p, x1: r.x1, y1: r.y1 }, depth + 1);
    }
  };
  // Dead-end side streets poke into some blocks, leaving U-shaped plots around them.
  function addStub(r: Rect, reg: RegionDefinition): void {
    if (!rng.chance(reg.deadEnds)) return;
    const dx = r.x1 - r.x0;
    const dy = r.y1 - r.y0;
    const vertical = dx >= dy ? dy >= 22 && dx >= 20 : !(dx >= 22 && dy >= 20);
    if (vertical && (dy < 22 || dx < 20)) return;
    if (!vertical && (dx < 22 || dy < 20)) return;
    const across = vertical ? dx : dy;
    const deep = vertical ? dy : dx;
    const at = Math.round(across * rng.range(0.38, 0.62));
    const len = Math.min(deep - 11, Math.round(deep * rng.range(0.45, 0.62)));
    const fromStart = rng.chance(0.5);
    if (vertical) segs.push({ horiz: false, c: r.x0 + at, a: fromStart ? r.y0 : r.y1 - len, b: fromStart ? r.y0 + len : r.y1, avenue: false });
    else segs.push({ horiz: true, c: r.y0 + at, a: fromStart ? r.x0 : r.x1 - len, b: fromStart ? r.x0 + len : r.x1, avenue: false });
  }
  split({ x0: X0, y0: Y0, x1: X1, y1: Y1 }, 0);

  // Cut segments at every crossing and T into graph edges; drop the ones that would run into the sea.
  const cuts = segs.map((sg) => [sg.a, sg.b]);
  for (let i = 0; i < segs.length; i++) {
    for (let j = 0; j < segs.length; j++) {
      const h = segs[i]!;
      const v = segs[j]!;
      if (!h.horiz || v.horiz) continue;
      if (v.c >= h.a && v.c <= h.b && h.c >= v.a && h.c <= v.b) {
        cuts[i]!.push(v.c);
        cuts[j]!.push(h.c);
      }
    }
  }
  const nodeIndex = new Map<number, number>();
  const rawNodes: RoadNode[] = [];
  const nodeAt = (x: number, y: number) => {
    const key = y * W + x;
    let id = nodeIndex.get(key);
    if (id === undefined) {
      id = rawNodes.length;
      nodeIndex.set(key, id);
      rawNodes.push({ id, x: x + 0.5, y: y + 0.5, edges: [] });
    }
    return id;
  };
  type RawEdge = { a: number; b: number; horiz: boolean; c: number; from: number; to: number; avenue: boolean; dead?: boolean };
  let rawEdges: RawEdge[] = [];
  const wetAt = (sg: Seg, t: number) => {
    for (let o = -SIDEWALK_TILES; o <= SIDEWALK_TILES; o++) if (sg.horiz ? isSea(t, sg.c + o) : isSea(sg.c + o, t)) return true;
    return false;
  };
  segs.forEach((sg, i) => {
    const cs = [...new Set(cuts[i]!)].sort((p, q) => p - q);
    for (let k = 1; k < cs.length; k++) {
      let from = cs[k - 1]!;
      let to = cs[k]!;
      // Streets that run into the sea stop short of it as dead ends down to the water.
      let firstWet = -1;
      let lastWet = -1;
      for (let t = from; t <= to; t++) {
        if (!wetAt(sg, t)) continue;
        if (firstWet < 0) firstWet = t;
        lastWet = t;
      }
      if (firstWet >= 0) {
        const head = firstWet - 3 - from;
        const tail = to - (lastWet + 3);
        if (head >= tail && head >= 6) to = firstWet - 3;
        else if (tail > head && tail >= 6) from = lastWet + 3;
        else continue;
      }
      const a = sg.horiz ? nodeAt(from, sg.c) : nodeAt(sg.c, from);
      const b = sg.horiz ? nodeAt(to, sg.c) : nodeAt(sg.c, to);
      rawEdges.push({ a, b, horiz: sg.horiz, c: sg.c, from, to, avenue: sg.avenue });
    }
  });
  // Merge some neighbouring blocks by dropping the street between them (L-shaped and long blocks),
  // as long as the network stays connected.
  const degree = (n: number) => rawEdges.reduce((k, e) => k + (!e.dead && (e.a === n || e.b === n) ? 1 : 0), 0);
  const connectedWithout = (skip: RawEdge) => {
    const adj = new Map<number, number[]>();
    for (const e of rawEdges) {
      if (e.dead || e === skip) continue;
      (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push(e.b);
      (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push(e.a);
    }
    const seen = new Set([skip.a]);
    const stack = [skip.a];
    while (stack.length) for (const m of adj.get(stack.pop()!) ?? []) if (!seen.has(m)) (seen.add(m), stack.push(m));
    return seen.has(skip.b);
  };
  for (const e of rawEdges) {
    if (e.avenue) continue;
    const reg = def.regions[regionAtXY(e.horiz ? (e.from + e.to) / 2 : e.c, e.horiz ? e.c : (e.from + e.to) / 2)]!;
    if (!rng.chance(reg.merges) || degree(e.a) < 3 || degree(e.b) < 3) continue;
    if (connectedWithout(e)) e.dead = true;
  }
  rawEdges = rawEdges.filter((e) => !e.dead);
  // Fuse straight runs through nodes that are no longer junctions.
  for (let changed = true; changed; ) {
    changed = false;
    for (let n = 0; n < rawNodes.length && !changed; n++) {
      const inc = rawEdges.filter((e) => e.a === n || e.b === n);
      if (inc.length !== 2) continue;
      const [p, q] = inc as [RawEdge, RawEdge];
      if (p.horiz !== q.horiz || p.c !== q.c) continue;
      const from = Math.min(p.from, q.from);
      const to = Math.max(p.to, q.to);
      const fused: RawEdge = { a: p.from === from ? p.a : q.a, b: p.to === to ? p.b : q.b, horiz: p.horiz, c: p.c, from, to, avenue: p.avenue || q.avenue };
      rawEdges = rawEdges.filter((e) => e !== p && e !== q);
      rawEdges.push(fused);
      changed = true;
    }
  }
  rawEdges.sort((p, q) => p.from - q.from || p.c - q.c || Number(p.horiz) - Number(q.horiz));
  // Keep the largest connected network.
  const parent = rawNodes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (const e of rawEdges) parent[find(e.a)] = find(e.b);
  const compSize = new Map<number, number>();
  for (const e of rawEdges) compSize.set(find(e.a), (compSize.get(find(e.a)) ?? 0) + 1);
  const mainRoot = [...compSize.entries()].sort((p, q) => q[1] - p[1])[0]?.[0];
  const kept = rawEdges.filter((e) => find(e.a) === mainRoot);
  const usedNodes = [...new Set(kept.flatMap((e) => [e.a, e.b]))].sort((p, q) => p - q);
  const remap = new Map(usedNodes.map((n, i) => [n, i]));
  const graph: RoadGraph = { nodes: usedNodes.map((n, i) => ({ id: i, x: rawNodes[n]!.x, y: rawNodes[n]!.y, edges: [] })), edges: [] };
  const edgeGeo: Array<{ horiz: boolean; c: number; from: number; to: number }> = [];
  for (const e of kept) {
    const points: { x: number; y: number }[] = [];
    for (let t = e.from; t <= e.to; t++) points.push(e.horiz ? { x: t + 0.5, y: e.c + 0.5 } : { x: e.c + 0.5, y: t + 0.5 });
    const edge: RoadEdge = { id: graph.edges.length, a: remap.get(e.a)!, b: remap.get(e.b)!, points, length: e.to - e.from, name: '', avenue: e.avenue };
    graph.edges.push(edge);
    edgeGeo.push({ horiz: e.horiz, c: e.c, from: e.from, to: e.to });
    graph.nodes[edge.a]!.edges.push(edge.id);
    graph.nodes[edge.b]!.edges.push(edge.id);
  }
  nameStreets(graph, def, regionAtXY, rng);

  // 3. Rasterise roads and sidewalks -------------------------------------------------------
  // Square, tile-exact bands: 5 tiles of asphalt, 2 tiles of sidewalk each side (3 on avenues).
  const level = new Uint8Array(W * H);
  graph.edges.forEach((e, id) => {
    const g = edgeGeo[id]!;
    const half = e.avenue ? SIDEWALK_TILES + 1 : SIDEWALK_TILES;
    for (let t = g.from - half; t <= g.to + half; t++) {
      for (let o = -half; o <= half; o++) {
        const x = g.horiz ? t : g.c + o;
        const y = g.horiz ? g.c + o : t;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d = Math.max(Math.abs(o), g.from - t, t - g.to);
        const lv = d <= ROAD_TILES ? 2 : 1;
        const i = y * W + x;
        if (lv > level[i]!) level[i] = lv;
      }
    }
  });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (sea[i]) map.set(x, y, Tile.Water);
      else if (level[i] === 2) map.set(x, y, Tile.Road);
      else if (level[i] === 1) map.set(x, y, Tile.Sidewalk);
      else map.set(x, y, Tile.Void); // to be filled by blocks
    }
  }

  // Crosswalks a few tiles out from each junction, two tiles wide, curb to curb.
  graph.edges.forEach((e, id) => {
    const g = edgeGeo[id]!;
    for (const end of [0, 1] as const) {
      const node = graph.nodes[end === 0 ? e.a : e.b]!;
      if (node.edges.length < 2 || e.length < CROSSWALK_AT * 2 + 4) continue;
      for (const k of [CROSSWALK_AT, CROSSWALK_AT + 1]) {
        const t = end === 0 ? g.from + k : g.to - k;
        const ends = [-(ROAD_TILES + 1), ROAD_TILES + 1].map((o) => (g.horiz ? map.get(t, g.c + o) : map.get(g.c + o, t)));
        if (ends.some((tk) => tk !== Tile.Sidewalk)) continue;
        for (let o = -ROAD_TILES; o <= ROAD_TILES; o++) {
          if (g.horiz) map.set(t, g.c + o, Tile.CrosswalkV);
          else map.set(g.c + o, t, Tile.CrosswalkH);
        }
      }
    }
  });
  // Dashed centre lines between the junctions.
  graph.edges.forEach((e, id) => {
    const g = edgeGeo[id]!;
    const from = g.from + (graph.nodes[e.a]!.edges.length > 1 ? ROAD_TILES + 2 : 1);
    const to = g.to - (graph.nodes[e.b]!.edges.length > 1 ? ROAD_TILES + 2 : 1);
    for (let t = from; t <= to; t++) {
      const [x, y] = g.horiz ? [t, g.c] : [g.c, t];
      if (map.get(x, y) === Tile.Road) map.set(x, y, g.horiz ? Tile.RoadLineH : Tile.RoadLineV);
    }
  });
  // Avenues: street trees in planters along the curb.
  graph.edges.forEach((e, id) => {
    if (!e.avenue) return;
    const g = edgeGeo[id]!;
    for (let t = g.from + 8; t <= g.to - 8; t += 5) {
      for (const o of [-(ROAD_TILES + 1), ROAD_TILES + 1]) {
        const [x, y] = g.horiz ? [t, g.c + o] : [g.c + o, t];
        if (map.get(x, y) === Tile.Sidewalk && map.get(g.horiz ? x : x + Math.sign(o), g.horiz ? y + Math.sign(o) : y) === Tile.Sidewalk) map.set(x, y, Tile.Tree);
      }
    }
  });

  // 4. Blocks ------------------------------------------------------------------------------------
  // The strip outside the ring road is a wooded green belt.
  const belt: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((x < X0 || y < Y0 || x > X1 || y > Y1) && map.get(x, y) === Tile.Void) belt.push(y * W + x);
    }
  }
  const blockId = new Int32Array(W * H).fill(-1);
  const blocks: CityBlock[] = [];
  const blockTiles: number[][] = [];
  const pieces: Array<{ tiles: number[]; wild: boolean }> = [{ tiles: belt, wild: true }];
  for (const i of belt) blockId[i] = -2;
  for (let start = 0; start < W * H; start++) {
    if (map.tiles[start] !== Tile.Void || blockId[start] !== -1) continue;
    const tiles: number[] = [];
    const stack = [start];
    blockId[start] = -2;
    let touches = false;
    while (stack.length) {
      const i = stack.pop()!;
      tiles.push(i);
      const x = i % W;
      const y = (i - x) / W;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touches = true;
      for (const [ddx, ddy] of DIRS4) {
        const nx = x + ddx;
        const ny = y + ddy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (map.tiles[ni] === Tile.Void && blockId[ni] === -1) {
          blockId[ni] = -2;
          stack.push(ni);
        }
      }
    }
    pieces.push({ tiles, wild: touches });
  }
  for (const piece of pieces) {
    const tiles = piece.tiles;
    if (tiles.length === 0) continue;
    let minX = W;
    let minY = H;
    let maxX = 0;
    let maxY = 0;
    const counts = new Map<number, number>();
    for (const i of tiles) {
      blockId[i] = blocks.length;
      const x = i % W;
      const y = (i - x) / W;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      counts.set(regionMap[i]!, (counts.get(regionMap[i]!) ?? 0) + 1);
    }
    const region = [...counts.entries()].sort((p, q) => q[1] - p[1] || p[0] - q[0])[0]![0];
    // A block belongs to one district as a whole.
    if (!piece.wild) for (const i of tiles) regionMap[i] = region;
    blocks.push({ id: `block-${blocks.length}`, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, kind: piece.wild ? 'wild' : 'lots', region: def.regions[region]!.id, area: tiles.length });
    blockTiles.push(tiles);
  }

  // 5. Fill blocks ----------------------------------------------------------------------------
  const buildings: Building[] = [];
  const props: Prop[] = [];
  let propSeq = 0;
  const addProp = (p: Omit<Prop, 'id'>) => props.push({ ...p, id: `prop-${propSeq++}` });
  const regionDef = (id: string) => def.regions.find((r) => r.id === id)!;
  const centreOf = (b: CityBlock) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const inSuper = (b: CityBlock) => {
    const c = centreOf(b);
    return superRects.some((r) => c.x > r.x0 && c.x < r.x1 && c.y > r.y0 && c.y < r.y1);
  };
  blocks.forEach((b, bi) => {
    const tiles = blockTiles[bi]!;
    const r = regionDef(b.region);
    const docks = r.style === 'harbor' && tiles.some((i) => nearTile(sea, W, H, i, 3));
    if (b.kind === 'wild') fillWild(map, rng, tiles, W, addProp);
    else if (b.area < 24) {
      for (const i of tiles) map.tiles[i] = rng.chance(0.5) ? Tile.Grass : Tile.Plaza;
      b.kind = 'pocket';
    } else if (docks) {
      fillDocks(map, rng, tiles, W, H, sea, addProp);
      b.kind = 'docks';
    } else if (inSuper(b)) {
      // Superblocks: a plaza Downtown, a brownfield or a park elsewhere.
      if (r.style === 'downtown' || r.style === 'oldtown') {
        fillPlaza(map, rng, tiles, W, addProp);
        b.kind = 'square';
      } else if (r.style === 'industrial' && rng.chance(0.5)) {
        fillWild(map, rng, tiles, W, addProp);
        b.kind = 'wild';
      } else {
        fillPark(map, rng, tiles, W, addProp);
        b.kind = 'park';
      }
    } else if (rng.chance(r.wildChance)) {
      fillWild(map, rng, tiles, W, addProp);
      b.kind = 'wild';
    } else if (b.area < 900 && rng.chance(r.parkChance)) {
      fillPark(map, rng, tiles, W, addProp);
      b.kind = 'park';
    }
  });
  // Every district gets at least one park: the moderate block nearest its anchor.
  for (const r of def.regions) {
    if (blocks.some((b) => b.region === r.id && b.kind === 'park')) continue;
    const ax = r.anchor.x * W;
    const ay = r.anchor.y * H;
    const pick = blocks
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.region === r.id && b.kind === 'lots' && b.area > 150 && b.area < 1400)
      .sort((p, q) => Math.hypot(centreOf(p.b).x - ax, centreOf(p.b).y - ay) - Math.hypot(centreOf(q.b).x - ax, centreOf(q.b).y - ay))[1];
    if (pick) {
      fillPark(map, rng, blockTiles[pick.i]!, W, addProp);
      pick.b.kind = 'park';
    }
  }

  // Pedestrian alleys cut through some blocks, from sidewalk to sidewalk.
  blocks.forEach((b, bi) => {
    if (b.kind !== 'lots') return;
    const r = regionDef(b.region);
    const long = Math.max(b.w, b.h);
    if (long < 16 || Math.min(b.w, b.h) < 6 || !rng.chance(r.alleys)) return;
    const alongX = b.w >= b.h; // the alley crosses the long side
    const at = Math.round(long * rng.range(0.35, 0.65));
    const width = r.style === 'slums' ? 1 : 2;
    for (let k = 0; k < width; k++) {
      for (let s = 0; s < (alongX ? b.h : b.w); s++) {
        const x = alongX ? b.x + at + k : b.x + s;
        const y = alongX ? b.y + s : b.y + at + k;
        const i = y * W + x;
        if (map.tiles[i] === Tile.Void && blockId[i] === bi) map.tiles[i] = Tile.Alley;
      }
    }
  });

  // Buildings: tile-exact rectangles. Frontage first, then back lots in deep blocks.
  const covers = new Map<Building, number[]>();
  const isLots = (i: number) => {
    const id = blockId[i]!;
    return id >= 0 && blocks[id]!.kind === 'lots';
  };
  const OUT: Record<Facing, [number, number]> = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] };
  const tryPlace = (x: number, y: number, w: number, h: number, facing: Facing, margin: number, onlyBlock: number | null): Building | null => {
    let block = onlyBlock;
    const cover: number[] = [];
    for (let ty = y - margin; ty < y + h + margin; ty++) {
      for (let tx = x - margin; tx < x + w + margin; tx++) {
        const inside = tx >= x && ty >= y && tx < x + w && ty < y + h;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) {
          if (inside) return null;
          continue;
        }
        const i = ty * W + tx;
        if (inside) {
          if (map.tiles[i] !== Tile.Void || !isLots(i)) return null;
          if (block === null) block = blockId[i]!;
          else if (blockId[i] !== block) return null;
          cover.push(i);
        } else if (map.tiles[i] === Tile.Building) return null;
      }
    }
    if (block === null) return null;
    const [ox, oy] = OUT[facing];
    const dtx = ox > 0 ? x + w - 1 : ox < 0 ? x : x + Math.floor((w - 1) / 2);
    const dty = oy > 0 ? y + h - 1 : oy < 0 ? y : y + Math.floor((h - 1) / 2);
    const etx = dtx + ox;
    const ety = dty + oy;
    const et = map.get(etx, ety);
    if (et !== Tile.Sidewalk && et !== Tile.Alley && !(et === Tile.Void && blockId[ety * W + etx] === block)) return null;
    for (const i of cover) map.tiles[i] = Tile.Building;
    const blk = blocks[block]!;
    const b: Building = {
      id: `bld-${blk.id}-${buildings.length}`,
      x,
      y,
      w,
      h,
      angle: 0,
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

  // Street fronts: walk both sides of every street. Rows may be terraced (wall to wall) or loose,
  // and some buildings step back behind a forecourt.
  graph.edges.forEach((e, id) => {
    const g = edgeGeo[id]!;
    const half = e.avenue ? SIDEWALK_TILES + 1 : SIDEWALK_TILES;
    for (const side of [-1, 1] as const) {
      const r = def.regions[regionAtXY(e.points[Math.floor(e.points.length / 2)]!.x, e.points[Math.floor(e.points.length / 2)]!.y)]!;
      const terrace = rng.chance(r.terraces);
      let t = g.from - half + rng.int(0, 2);
      while (t < g.to + half) {
        const baseLen = rng.int(r.buildingW[0], r.buildingW[1]);
        const baseDepth = rng.int(r.buildingH[0], r.buildingH[1]);
        const setback = rng.chance(r.setbacks) ? rng.int(1, 2) : 0;
        let placed: Building | null = null;
        let len = baseLen;
        for (let attempt = 0; attempt < 4 && !placed; attempt++) {
          len = Math.max(3, Math.round(baseLen * (1 - attempt * 0.22)));
          const depth = Math.max(3, Math.round(baseDepth * (1 - attempt * 0.22)));
          const near = half + 1 + setback;
          const p0 = side > 0 ? g.c + near : g.c - near - depth + 1;
          const facing: Facing = g.horiz ? (side > 0 ? 'north' : 'south') : side > 0 ? 'west' : 'east';
          placed = g.horiz ? tryPlace(t, p0, len, depth, facing, terrace ? 0 : 1, null) : tryPlace(p0, t, depth, len, facing, terrace ? 0 : 1, null);
        }
        t += placed ? len + (terrace ? 0 : rng.int(1, 2)) : 1;
      }
    }
  });

  // Back lots: deep blocks get more buildings around their courtyard.
  blocks.forEach((b, bi) => {
    if (b.kind !== 'lots') return;
    const tiles = blockTiles[bi]!;
    const r = regionDef(b.region);
    const free = tiles.filter((i) => map.tiles[i] === Tile.Void);
    if (free.length > 120) {
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
        if (tryPlace((i % W) - Math.floor(w / 2), Math.floor(i / W) - Math.floor(h / 2), w, h, facing, 2, bi)) budget--;
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
    else if (!reach[i] && !map.blocked[i] && !isRoadKind(t as TileKind) && t !== Tile.Water) {
      map.tiles[i] = Tile.Lot;
      map.blocked[i] = 1;
    }
  }
  // Props stranded in fenced-off yards go with them.
  for (let k = props.length - 1; k >= 0; k--) {
    const p = props[k]!;
    if (p.solid) continue;
    let stranded = false;
    for (let ty = p.y; ty < p.y + p.h; ty++) for (let tx = p.x; tx < p.x + p.w; tx++) if (map.get(tx, ty) === Tile.Lot) stranded = true;
    if (stranded) props.splice(k, 1);
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

/** Downtown superblocks: a paved plaza with a fountain, planted trees and benches. */
function fillPlaza(map: TileMap, rng: Rng, tiles: number[], W: number, addProp: AddProp): void {
  let cx = 0;
  let cy = 0;
  for (const i of tiles) {
    cx += i % W;
    cy += Math.floor(i / W);
  }
  cx = Math.round(cx / tiles.length);
  cy = Math.round(cy / tiles.length);
  const set = new Set(tiles);
  const r = tiles.length > 400 ? 2 : 1;
  for (const i of tiles) {
    const x = i % W;
    const y = (i - x) / W;
    const fx = Math.abs(x - cx);
    const fy = Math.abs(y - cy);
    if (fx <= r && fy <= r && fx + fy < r * 2) map.set(x, y, Tile.Water);
    else map.set(x, y, Tile.Plaza);
  }
  // Planter trees on a loose lattice, clear of the fountain and the block edge.
  for (const i of tiles) {
    const x = i % W;
    const y = (i - x) / W;
    if ((x - cx) % 4 !== 0 || (y - cy) % 4 !== 0 || Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= r + 1) continue;
    if (![...DIRS4].every(([dx, dy]) => set.has((y + dy) * W + x + dx))) continue;
    if (rng.chance(0.7)) map.set(x, y, Tile.Tree);
  }
  for (const [dx, dy] of DIRS4) {
    const x = cx + dx * (r + 2);
    const y = cy + dy * (r + 2);
    if (map.get(x, y) === Tile.Plaza && set.has(y * W + x)) addProp({ kind: 'bench', x, y, w: 1, h: 1, solid: false, variant: 0, facing: dy !== 0 ? 'north' : 'east' });
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
