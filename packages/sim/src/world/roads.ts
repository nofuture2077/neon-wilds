import { TICK_RATE } from '../constants';
import type { Rng } from '../core/rng';
import type { RoadEdge, RoadGraph, RoadNode } from './cityGen';
import type { DistrictLayout } from './district';
import { Tile, type TileKind } from './tiles';

/** Right-hand traffic: lanes run this far to the right of the centre line. */
export const LANE_OFFSET = 1.3;
/** Cars stop this far (along the edge) from a junction centre. */
export const STOP_DISTANCE = 5.4;

const PHASE_TICKS = TICK_RATE * 7;
const AMBER_TICKS = TICK_RATE * 1.2;

export function isDrivable(kind: TileKind): boolean {
  return kind === Tile.Road || kind === Tile.RoadLineH || kind === Tile.RoadLineV || kind === Tile.CrosswalkH || kind === Tile.CrosswalkV;
}

export interface LanePose {
  x: number;
  y: number;
  /** Heading of travel (radians). */
  heading: number;
}

/**
 * Lane model on the organic road graph. Each edge is a polyline; traffic in
 * the a→b direction ("forward") drives LANE_OFFSET to the right of it, traffic
 * in the b→a direction on the other side. Junctions with three or more roads
 * are signalised: approaches are split into two groups by angle and the
 * groups alternate green.
 */
export class RoadNetwork {
  readonly nodes: RoadNode[];
  readonly edges: RoadEdge[];
  private readonly cumulative: Float64Array[];
  private readonly phaseOffset: number[];
  /** Per node: approach group (0/1) per incident edge id. */
  private readonly groups: Map<number, number>[];

  constructor(layout: DistrictLayout | { graph: RoadGraph }) {
    const graph = layout.graph;
    this.nodes = graph.nodes;
    this.edges = graph.edges;
    this.cumulative = graph.edges.map((e) => {
      const c = new Float64Array(e.points.length);
      for (let k = 1; k < e.points.length; k++) c[k] = c[k - 1]! + Math.hypot(e.points[k]!.x - e.points[k - 1]!.x, e.points[k]!.y - e.points[k - 1]!.y);
      return c;
    });
    this.phaseOffset = graph.nodes.map((n) => Math.floor((n.x * 131 + n.y * 71) % PHASE_TICKS));
    this.groups = graph.nodes.map((n) => {
      const m = new Map<number, number>();
      const base = n.edges.length ? this.approachAngle(n.id, n.edges[0]!) : 0;
      for (const eid of n.edges) {
        const a = this.approachAngle(n.id, eid);
        m.set(eid, Math.cos(2 * (a - base)) >= 0 ? 0 : 1);
      }
      return m;
    });
  }

  edgeLength(edgeId: number): number {
    const c = this.cumulative[edgeId]!;
    return c[c.length - 1]!;
  }

  /** Centre-line point and unit tangent (a→b) at arc length s. */
  centre(edgeId: number, s: number): { x: number; y: number; tx: number; ty: number } {
    const e = this.edges[edgeId]!;
    const c = this.cumulative[edgeId]!;
    const len = c[c.length - 1]!;
    const d = Math.max(0, Math.min(len, s));
    let lo = 0;
    let hi = c.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (c[mid]! <= d) lo = mid;
      else hi = mid;
    }
    const p = e.points[lo]!;
    const q = e.points[hi]!;
    const seg = c[hi]! - c[lo]! || 1;
    const t = (d - c[lo]!) / seg;
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, tx: (q.x - p.x) / seg, ty: (q.y - p.y) / seg };
  }

  /** Pose in the lane at arc length s (s is measured from node a regardless of direction). */
  lane(edgeId: number, s: number, forward: boolean): LanePose {
    const c = this.centre(edgeId, s);
    const dx = forward ? c.tx : -c.tx;
    const dy = forward ? c.ty : -c.ty;
    // Right of travel in screen space (y down) is (-dy, dx).
    return { x: c.x - dy * LANE_OFFSET, y: c.y + dx * LANE_OFFSET, heading: Math.atan2(dy, dx) };
  }

  /** Node the vehicle is heading toward. */
  aheadNode(edgeId: number, forward: boolean): RoadNode {
    const e = this.edges[edgeId]!;
    return this.nodes[forward ? e.b : e.a]!;
  }

  isSignal(node: RoadNode): boolean {
    return node.edges.length >= 3;
  }

  /** Direction from the node out along the edge (radians). */
  approachAngle(nodeId: number, edgeId: number): number {
    const e = this.edges[edgeId]!;
    const pts = e.points;
    const [p, q] = e.a === nodeId ? [pts[0]!, pts[Math.min(3, pts.length - 1)]!] : [pts[pts.length - 1]!, pts[Math.max(0, pts.length - 4)]!];
    return Math.atan2(q.y - p.y, q.x - p.x);
  }

  signalState(nodeId: number, fromEdge: number, tick: number): 'green' | 'amber' | 'red' {
    const node = this.nodes[nodeId]!;
    if (!this.isSignal(node)) return 'green';
    const t = (tick + this.phaseOffset[nodeId]!) % (PHASE_TICKS * 2);
    const active = t < PHASE_TICKS ? 0 : 1;
    if ((this.groups[nodeId]!.get(fromEdge) ?? 0) !== active) return 'red';
    return t % PHASE_TICKS > PHASE_TICKS - AMBER_TICKS ? 'amber' : 'green';
  }

  isGreen(nodeId: number, fromEdge: number, tick: number): boolean {
    return this.signalState(nodeId, fromEdge, tick) === 'green';
  }

  /** Choose the next edge at a junction; never a U-turn unless it's a dead end. */
  chooseNext(nodeId: number, fromEdge: number, rng: Rng, toward?: { x: number; y: number }): { edge: number; forward: boolean } {
    const node = this.nodes[nodeId]!;
    const options = node.edges.filter((e) => e !== fromEdge);
    if (options.length === 0) return { edge: fromEdge, forward: this.edges[fromEdge]!.a === nodeId };
    const inAngle = this.approachAngle(nodeId, fromEdge) + Math.PI;
    let pick = options[0]!;
    if (toward) {
      let best = -Infinity;
      for (const e of options) {
        const far = this.nodes[this.edges[e]!.a === nodeId ? this.edges[e]!.b : this.edges[e]!.a]!;
        const score = -Math.hypot(far.x - toward.x, far.y - toward.y);
        if (score > best) {
          best = score;
          pick = e;
        }
      }
    } else {
      const weights = options.map((e) => 1 + 2 * Math.max(0, Math.cos(this.approachAngle(nodeId, e) - inAngle)));
      const total = weights.reduce((a, w) => a + w, 0);
      let r = rng.next() * total;
      for (let i = 0; i < options.length; i++) {
        r -= weights[i]!;
        if (r <= 0) {
          pick = options[i]!;
          break;
        }
      }
    }
    return { edge: pick, forward: this.edges[pick]!.a === nodeId };
  }

  /** Nearest point on any road centre line. */
  nearest(x: number, y: number): { edge: number; s: number; dist: number } | null {
    let best: { edge: number; s: number; dist: number } | null = null;
    for (const e of this.edges) {
      const c = this.cumulative[e.id]!;
      for (let k = 1; k < e.points.length; k++) {
        const p = e.points[k - 1]!;
        const q = e.points[k]!;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / l2));
        const d = Math.hypot(x - (p.x + dx * t), y - (p.y + dy * t));
        if (!best || d < best.dist) best = { edge: e.id, s: c[k - 1]! + Math.sqrt(l2) * t, dist: d };
      }
    }
    return best;
  }

  /** A random lane position for spawning traffic. */
  randomLane(rng: Rng): { edge: number; forward: boolean; s: number } | null {
    if (this.edges.length === 0) return null;
    const e = rng.pick(this.edges);
    const len = this.edgeLength(e.id);
    if (len < STOP_DISTANCE * 2 + 2) return null;
    return { edge: e.id, forward: rng.chance(0.5), s: rng.range(STOP_DISTANCE + 1, len - STOP_DISTANCE - 1) };
  }

  /** A random lane position at a distance between minD and maxD from (x, y), or null. */
  laneNear(rng: Rng, x: number, y: number, minD: number, maxD: number): { edge: number; forward: boolean; s: number } | null {
    const options: Array<{ edge: number; s: number }> = [];
    for (const e of this.edges) {
      const len = this.edgeLength(e.id);
      for (let s = STOP_DISTANCE + 1; s < len - STOP_DISTANCE - 1; s += 3) {
        const c = this.centre(e.id, s);
        const d = Math.hypot(c.x - x, c.y - y);
        if (d >= minD && d <= maxD) options.push({ edge: e.id, s });
      }
    }
    if (options.length === 0) return null;
    const o = rng.pick(options);
    return { edge: o.edge, s: o.s, forward: rng.chance(0.5) };
  }
}
