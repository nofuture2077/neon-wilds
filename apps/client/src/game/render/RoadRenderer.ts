import Phaser from 'phaser';
import { CROSSWALK_AT, ROAD_HALF, SIDEWALK_OUTER, STOP_DISTANCE, TILE_SIZE, Tile, pointAtDistance, regionOf, type DistrictLayout, type RoadEdge } from '@neon-wilds/sim';
import { createCanvas, css, hashNoise } from '../assets/canvas';
import { addCanvasTexture } from '../assets/manifest';
import { PALETTE as P } from '../assets/palette';
import { Depth } from './depth';

const T = TILE_SIZE;
const CHUNK = 1024;

/**
 * Smooth vector streets for the organic city. The simulation rasterises roads
 * to tiles for collision; here the same road graph is stroked with Canvas 2D
 * (asphalt, neon-lit curbs, sidewalks, centre lines, zebra crossings and stop
 * lines) and baked into a few large textures, so curves read as curves.
 */
export function renderRoads(scene: Phaser.Scene, layout: DistrictLayout): void {
  const W = layout.map.width * T;
  const H = layout.map.height * T;
  const patterns = buildPatterns();
  let n = 0;
  for (let y0 = 0; y0 < H; y0 += CHUNK) {
    for (let x0 = 0; x0 < W; x0 += CHUNK) {
      const pc = createCanvas(Math.min(CHUNK, W - x0), Math.min(CHUNK, H - y0));
      const c = pc.ctx;
      c.imageSmoothingEnabled = true;
      c.translate(-x0, -y0);
      drawStreets(c, layout, patterns, x0, y0);
      const key = `roads-${n++}`;
      addCanvasTexture(scene, key, pc);
      scene.add.image(x0, y0, key).setOrigin(0, 0).setDepth(Depth.ground + 1);
    }
  }
}

interface Patterns {
  asphalt: HTMLCanvasElement;
  concrete: HTMLCanvasElement;
}

function buildPatterns(): Patterns {
  const asphalt = createCanvas(64, 64);
  asphalt.ctx.fillStyle = css(P.asphalt);
  asphalt.ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const v = hashNoise(x, y, 3);
      if (v < 0.07) asphalt.ctx.fillStyle = css(P.asphaltDark);
      else if (v > 0.93) asphalt.ctx.fillStyle = css(P.asphaltLight);
      else continue;
      asphalt.ctx.fillRect(x, y, 1, 1);
    }
  }
  const concrete = createCanvas(32, 32);
  const k = concrete.ctx;
  k.fillStyle = css(P.concrete);
  k.fillRect(0, 0, 32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const v = hashNoise(x, y, 7);
      if (v < 0.05) k.fillStyle = css(P.concreteDark);
      else if (v > 0.95) k.fillStyle = css(P.concreteLight);
      else continue;
      k.fillRect(x, y, 1, 1);
    }
  }
  k.fillStyle = css(P.concreteDark);
  for (let i = 0; i < 32; i += 16) {
    k.fillRect(i, 0, 1, 32);
    k.fillRect(0, i, 32, 1);
  }
  return { asphalt: asphalt.canvas, concrete: concrete.canvas };
}

function tracePath(c: CanvasRenderingContext2D, e: RoadEdge, from = 0, to = Infinity): void {
  c.beginPath();
  let d = 0;
  let started = false;
  for (let k = 0; k < e.points.length; k++) {
    const p = e.points[k]!;
    if (k > 0) d += Math.hypot(p.x - e.points[k - 1]!.x, p.y - e.points[k - 1]!.y);
    if (d < from || d > to) continue;
    if (!started) c.moveTo(p.x * T, p.y * T);
    else c.lineTo(p.x * T, p.y * T);
    started = true;
  }
}

function drawStreets(c: CanvasRenderingContext2D, layout: DistrictLayout, pat: Patterns, x0: number, y0: number): void {
  const { graph, map } = layout;
  // Only edges near this chunk.
  const margin = (SIDEWALK_OUTER + 2) * T;
  const edges = graph.edges.filter((e) =>
    e.points.some((p) => p.x * T > x0 - margin && p.x * T < x0 + CHUNK + margin && p.y * T > y0 - margin && p.y * T < y0 + CHUNK + margin),
  );
  const nodes = graph.nodes.filter((n) => n.x * T > x0 - margin * 2 && n.x * T < x0 + CHUNK + margin * 2 && n.y * T > y0 - margin * 2 && n.y * T < y0 + CHUNK + margin * 2);
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const strokeAll = (width: number, style: string | CanvasPattern) => {
    c.strokeStyle = style;
    c.fillStyle = style;
    c.lineWidth = width * T;
    for (const e of edges) {
      tracePath(c, e);
      c.stroke();
    }
    for (const n of nodes) {
      c.beginPath();
      c.arc(n.x * T, n.y * T, (width / 2) * T, 0, Math.PI * 2);
      c.fill();
    }
  };

  const concrete = c.createPattern(pat.concrete, 'repeat')!;
  const asphalt = c.createPattern(pat.asphalt, 'repeat')!;
  // Sidewalk with a dark outer rim, then the curb (with its neon strip), then asphalt.
  strokeAll((SIDEWALK_OUTER + 0.45) * 2, css(P.curbShadow, 0.9));
  strokeAll((SIDEWALK_OUTER + 0.35) * 2, concrete);
  strokeAll((ROAD_HALF + 0.32) * 2, css(P.curb));
  strokeAll((ROAD_HALF + 0.16) * 2, css(P.curbNeon, 0.6));
  strokeAll((ROAD_HALF + 0.06) * 2, css(P.curbShadow));
  strokeAll(ROAD_HALF * 2, asphalt);

  // Centre lines: dashed, stopping short of junctions; Downtown boulevards get a solid double line.
  for (const e of edges) {
    const a = graph.nodes[e.a]!;
    const b = graph.nodes[e.b]!;
    const from = a.edges.length > 1 ? STOP_DISTANCE : 0;
    const to = e.length - (b.edges.length > 1 ? STOP_DISTANCE : 0);
    if (to - from < 2) continue;
    const mid = e.points[Math.floor(e.points.length / 2)]!;
    const downtown = regionOf(layout, mid.x, mid.y).style === 'downtown';
    if (downtown) {
      c.setLineDash([]);
      c.lineWidth = 1;
      c.strokeStyle = css(P.laneYellow, 0.85);
      for (const off of [-0.12, 0.12]) {
        c.save();
        tracePathOffset(c, e, from, to, off);
        c.stroke();
        c.restore();
      }
    } else {
      c.setLineDash([0.55 * T, 0.6 * T]);
      c.lineWidth = 1.6;
      c.lineCap = 'butt';
      c.strokeStyle = css(P.laneYellow, 0.8);
      tracePath(c, e, from, to);
      c.stroke();
      c.lineCap = 'round';
    }
  }
  c.setLineDash([]);

  // Zebra crossings where the simulation put them, and stop lines at signalised approaches.
  for (const e of edges) {
    for (const end of [0, 1] as const) {
      const node = graph.nodes[end === 0 ? e.a : e.b]!;
      if (node.edges.length < 2) continue;
      const at = end === 0 ? CROSSWALK_AT : e.length - CROSSWALK_AT;
      const p = pointAtDistance(e.points, at);
      if (!p) continue;
      const t = map.get(Math.floor(p.x), Math.floor(p.y));
      if (t === Tile.CrosswalkH || t === Tile.CrosswalkV) {
        c.save();
        c.translate(p.x * T, p.y * T);
        c.rotate(Math.atan2(p.ty, p.tx));
        c.fillStyle = css(P.zebra, 0.85);
        for (let k = -ROAD_HALF + 0.35; k <= ROAD_HALF - 0.3; k += 0.62) c.fillRect(-0.55 * T, k * T, 1.1 * T, 0.32 * T);
        c.restore();
      }
      if (node.edges.length >= 3) {
        const s = end === 0 ? STOP_DISTANCE - 0.3 : e.length - STOP_DISTANCE + 0.3;
        const q = pointAtDistance(e.points, s);
        if (!q) continue;
        // Travel toward the node; the incoming lane is on its right: (-dy, dx).
        const dx = end === 0 ? -q.tx : q.tx;
        const dy = end === 0 ? -q.ty : q.ty;
        c.strokeStyle = css(0xe9e4f5, 0.75);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(q.x * T, q.y * T);
        c.lineTo((q.x - dy * (ROAD_HALF - 0.2)) * T, (q.y + dx * (ROAD_HALF - 0.2)) * T);
        c.stroke();
      }
    }
  }
}

function tracePathOffset(c: CanvasRenderingContext2D, e: RoadEdge, from: number, to: number, off: number): void {
  c.beginPath();
  let started = false;
  for (let d = from; d <= to; d += 0.5) {
    const p = pointAtDistance(e.points, d);
    if (!p) continue;
    const x = (p.x - p.ty * off) * T;
    const y = (p.y + p.tx * off) * T;
    if (!started) c.moveTo(x, y);
    else c.lineTo(x, y);
    started = true;
  }
}
