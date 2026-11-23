import type { TilePos } from '../core/vec';

export interface PathGrid {
  readonly width: number;
  readonly height: number;
  passable(tx: number, ty: number): boolean;
}

export interface PathOptions {
  /** Abort after expanding this many nodes (keeps worst-case cost bounded). */
  maxExpanded?: number;
  /** Allow diagonal moves (never cutting corners). */
  diagonal?: boolean;
  /** Heuristic weight (>1 = weighted A*: far fewer expansions, paths at most this factor longer). */
  weight?: number;
}

const SQRT2 = Math.SQRT2;
const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

/**
 * Grid A* with reusable buffers. One instance per grid size; buffers are
 * invalidated with a generation stamp instead of being cleared per search.
 */
export class Pathfinder {
  private readonly g: Float64Array;
  private readonly parent: Int32Array;
  private readonly stamp: Uint32Array;
  private readonly closed: Uint32Array;
  private generation = 0;
  private heap: number[] = [];
  private heapF: number[] = [];

  constructor(private readonly grid: PathGrid) {
    const n = grid.width * grid.height;
    this.g = new Float64Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }

  /** Returns tiles from (excluding) start to (including) goal, or null if unreachable. */
  find(start: TilePos, goal: TilePos, options: PathOptions = {}): TilePos[] | null {
    const { width, height } = this.grid;
    const maxExpanded = options.maxExpanded ?? 6000;
    const diagonal = options.diagonal ?? true;
    const w = options.weight ?? 1;
    if (!this.grid.passable(goal.tx, goal.ty) || !this.grid.passable(start.tx, start.ty)) return null;
    if (start.tx === goal.tx && start.ty === goal.ty) return [];

    this.generation++;
    if (this.generation === 0xffffffff) {
      this.stamp.fill(0);
      this.closed.fill(0);
      this.generation = 1;
    }
    const gen = this.generation;
    this.heap = [];
    this.heapF = [];

    const startIdx = start.ty * width + start.tx;
    const goalIdx = goal.ty * width + goal.tx;
    this.g[startIdx] = 0;
    this.parent[startIdx] = -1;
    this.stamp[startIdx] = gen;
    this.push(startIdx, w * heuristic(start.tx, start.ty, goal.tx, goal.ty));

    let expanded = 0;
    const dirCount = diagonal ? 8 : 4;
    while (this.heap.length > 0) {
      const current = this.pop();
      if (current === goalIdx) return this.reconstruct(goalIdx, width);
      if (this.closed[current] === gen) continue;
      this.closed[current] = gen;
      if (++expanded > maxExpanded) return null;

      const cx = current % width;
      const cy = (current - cx) / width;
      for (let d = 0; d < dirCount; d++) {
        const dir = DIRS[d] as readonly [number, number, number];
        const nx = cx + dir[0];
        const ny = cy + dir[1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (!this.grid.passable(nx, ny)) continue;
        if (dir[0] !== 0 && dir[1] !== 0) {
          if (!this.grid.passable(cx + dir[0], cy) || !this.grid.passable(cx, cy + dir[1])) continue;
        }
        const ni = ny * width + nx;
        if (this.closed[ni] === gen) continue;
        const tentative = (this.g[current] as number) + dir[2];
        if (this.stamp[ni] === gen && tentative >= (this.g[ni] as number)) continue;
        this.stamp[ni] = gen;
        this.g[ni] = tentative;
        this.parent[ni] = current;
        this.push(ni, tentative + w * heuristic(nx, ny, goal.tx, goal.ty));
      }
    }
    return null;
  }

  private reconstruct(goalIdx: number, width: number): TilePos[] {
    const out: TilePos[] = [];
    let idx = goalIdx;
    while (this.parent[idx] !== -1) {
      out.push({ tx: idx % width, ty: Math.floor(idx / width) });
      idx = this.parent[idx] as number;
    }
    return out.reverse();
  }

  // Binary min-heap keyed on f; ties broken by insertion order for determinism.
  private push(node: number, f: number): void {
    const heap = this.heap;
    const fs = this.heapF;
    heap.push(node);
    fs.push(f);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((fs[p] as number) <= f) break;
      heap[i] = heap[p] as number;
      fs[i] = fs[p] as number;
      i = p;
    }
    heap[i] = node;
    fs[i] = f;
  }

  private pop(): number {
    const heap = this.heap;
    const fs = this.heapF;
    const top = heap[0] as number;
    const lastNode = heap.pop() as number;
    const lastF = fs.pop() as number;
    if (heap.length > 0) {
      let i = 0;
      const n = heap.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        let mf = lastF;
        if (l < n && (fs[l] as number) < mf) {
          m = l;
          mf = fs[l] as number;
        }
        if (r < n && (fs[r] as number) < mf) m = r;
        if (m === i) break;
        heap[i] = heap[m] as number;
        fs[i] = fs[m] as number;
        i = m;
      }
      heap[i] = lastNode;
      fs[i] = lastF;
    }
    return top;
  }
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}
