import { TICK_RATE } from '../constants';
import type { DistrictLayout, Street } from './district';
import type { TileMap } from './tilemap';
import { Tile, type TileKind } from './tiles';

export type Dir = 'N' | 'E' | 'S' | 'W';

export const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};
export const DIR_ANGLE: Record<Dir, number> = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
export const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };
/** Turning right (clockwise on screen, where y points down). */
export const RIGHT_OF: Record<Dir, Dir> = { N: 'E', E: 'S', S: 'W', W: 'N' };
export const LEFT_OF: Record<Dir, Dir> = { N: 'W', W: 'S', S: 'E', E: 'N' };

export interface Band {
  index: number;
  axis: 'vertical' | 'horizontal';
  from: number;
  to: number;
}

export interface Intersection {
  id: number;
  v: Band;
  h: Band;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  exits: Record<Dir, boolean>;
  /** Signalised intersections (3+ exits) cycle north-south / east-west green phases. */
  signal: boolean;
  phaseOffset: number;
}

const PHASE_TICKS = TICK_RATE * 7;
const AMBER_TICKS = TICK_RATE * 1.2;

export function isDrivable(kind: TileKind): boolean {
  return kind === Tile.Road || kind === Tile.RoadLineH || kind === Tile.RoadLineV || kind === Tile.CrosswalkH || kind === Tile.CrosswalkV;
}

/**
 * Lane model on the street bands (right-hand traffic). For a band starting at
 * `from` with width 5: southbound/westbound traffic uses offset 1.5, northbound/eastbound 3.5.
 * (Facing south your right hand is west — the low-x side; facing east it is south — the high-y side.)
 */
export function laneCoord(band: { from: number }, dir: Dir): number {
  switch (dir) {
    case 'S':
      return band.from + 1.5;
    case 'N':
      return band.from + 3.5;
    case 'E':
      return band.from + 3.5;
    case 'W':
      return band.from + 1.5;
  }
}

export class RoadNetwork {
  readonly vbands: Band[];
  readonly hbands: Band[];
  readonly intersections: Intersection[];

  constructor(layout: DistrictLayout) {
    const toBand = (s: Street, index: number): Band => ({ index, axis: s.axis, from: s.from, to: s.to });
    this.vbands = layout.streets.filter((s) => s.axis === 'vertical').map(toBand);
    this.hbands = layout.streets.filter((s) => s.axis === 'horizontal').map(toBand);
    const map = layout.map;
    this.intersections = [];
    let id = 0;
    for (const v of this.vbands) {
      for (const h of this.hbands) {
        const exits: Record<Dir, boolean> = {
          N: drivableAt(map, v.from + 1, h.from - 1),
          S: drivableAt(map, v.from + 1, h.to + 1),
          W: drivableAt(map, v.from - 1, h.from + 1),
          E: drivableAt(map, v.to + 1, h.from + 1),
        };
        const count = Object.values(exits).filter(Boolean).length;
        this.intersections.push({
          id: id++,
          v,
          h,
          x0: v.from,
          y0: h.from,
          x1: v.to,
          y1: h.to,
          exits,
          signal: count >= 3,
          phaseOffset: (v.index * 131 + h.index * 71) % PHASE_TICKS,
        });
      }
    }
  }

  /** The vertical band whose lanes contain x, or null. */
  vbandAt(x: number): Band | null {
    return this.vbands.find((b) => x >= b.from && x < b.to + 1) ?? null;
  }

  hbandAt(y: number): Band | null {
    return this.hbands.find((b) => y >= b.from && y < b.to + 1) ?? null;
  }

  intersectionAt(x: number, y: number): Intersection | null {
    return this.intersections.find((i) => x >= i.x0 && x < i.x1 + 1 && y >= i.y0 && y < i.y1 + 1) ?? null;
  }

  /**
   * The next intersection ahead for a vehicle travelling `dir` along its lane,
   * plus the distance to its entry edge. Null if the road ends (map edge).
   */
  nextIntersection(x: number, y: number, dir: Dir): { node: Intersection; distance: number } | null {
    let best: { node: Intersection; distance: number } | null = null;
    for (const n of this.intersections) {
      let d: number;
      switch (dir) {
        case 'S':
          if (x < n.x0 || x >= n.x1 + 1) continue;
          d = n.y0 - y;
          break;
        case 'N':
          if (x < n.x0 || x >= n.x1 + 1) continue;
          d = y - (n.y1 + 1);
          break;
        case 'E':
          if (y < n.y0 || y >= n.y1 + 1) continue;
          d = n.x0 - x;
          break;
        case 'W':
          if (y < n.y0 || y >= n.y1 + 1) continue;
          d = x - (n.x1 + 1);
          break;
      }
      if (d < -0.05) continue;
      if (!best || d < best.distance) best = { node: n, distance: d };
    }
    return best;
  }

  /** Is travelling `dir` into this intersection allowed right now (green), at `tick`? */
  isGreen(node: Intersection, dir: Dir, tick: number): boolean {
    if (!node.signal) return true;
    const t = (tick + node.phaseOffset) % (PHASE_TICKS * 2);
    const nsGreen = t < PHASE_TICKS;
    const inPhase = t % PHASE_TICKS;
    if (inPhase > PHASE_TICKS - AMBER_TICKS) return false; // amber: don't enter
    return dir === 'N' || dir === 'S' ? nsGreen : !nsGreen;
  }

  /** 'green' | 'amber' | 'red' for a given approach direction (for rendering signal heads). */
  signalState(node: Intersection, dir: Dir, tick: number): 'green' | 'amber' | 'red' {
    if (!node.signal) return 'green';
    const t = (tick + node.phaseOffset) % (PHASE_TICKS * 2);
    const nsGreen = t < PHASE_TICKS;
    const mine = dir === 'N' || dir === 'S' ? nsGreen : !nsGreen;
    if (!mine) return 'red';
    return t % PHASE_TICKS > PHASE_TICKS - AMBER_TICKS ? 'amber' : 'green';
  }

  /** Waypoints through an intersection from approach `inDir` to exit `outDir` (quadratic curve). */
  turnPath(node: Intersection, inDir: Dir, outDir: Dir): { x: number; y: number }[] {
    const entry = this.edgePoint(node, inDir, true);
    const exit = this.edgePoint(node, outDir, false);
    // Control point: where the incoming lane line meets the outgoing lane line.
    const inVertical = inDir === 'N' || inDir === 'S';
    const outVertical = outDir === 'N' || outDir === 'S';
    let cx: number;
    let cy: number;
    if (inVertical && !outVertical) {
      cx = entry.x;
      cy = exit.y;
    } else if (!inVertical && outVertical) {
      cx = exit.x;
      cy = entry.y;
    } else {
      cx = (entry.x + exit.x) / 2;
      cy = (entry.y + exit.y) / 2;
    }
    const pts: { x: number; y: number }[] = [];
    const steps = inDir === outDir ? 2 : 6;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      pts.push({ x: a * entry.x + b * cx + c * exit.x, y: a * entry.y + b * cy + c * exit.y });
    }
    return pts;
  }

  /** Lane point on the intersection boundary: entering while travelling `dir`, or leaving towards `dir`. */
  private edgePoint(node: Intersection, dir: Dir, entering: boolean): { x: number; y: number } {
    if (entering) {
      switch (dir) {
        case 'S':
          return { x: laneCoord(node.v, 'S'), y: node.y0 };
        case 'N':
          return { x: laneCoord(node.v, 'N'), y: node.y1 + 1 };
        case 'E':
          return { x: node.x0, y: laneCoord(node.h, 'E') };
        case 'W':
          return { x: node.x1 + 1, y: laneCoord(node.h, 'W') };
      }
    }
    switch (dir) {
      case 'S':
        return { x: laneCoord(node.v, 'S'), y: node.y1 + 1 };
      case 'N':
        return { x: laneCoord(node.v, 'N'), y: node.y0 };
      case 'E':
        return { x: node.x1 + 1, y: laneCoord(node.h, 'E') };
      case 'W':
        return { x: node.x0, y: laneCoord(node.h, 'W') };
    }
  }
}

function drivableAt(map: TileMap, x: number, y: number): boolean {
  return map.inBounds(x, y) && isDrivable(map.get(x, y));
}
