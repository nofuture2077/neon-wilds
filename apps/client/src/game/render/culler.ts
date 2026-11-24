import type Phaser from 'phaser';

type Cullable = Phaser.GameObjects.GameObject & { x: number; y: number; cameraFilter: number };

const CELL = 256;
/** Extra margin around the view, in pixels: covers the largest static sprites (buildings, halos). */
const MARGIN = 320;

/**
 * Spatial culling for the static city (buildings, trees, props, lights). Objects are bucketed
 * into a grid; only cells near the camera render. Culled objects are excluded from the camera
 * with `cameraFilter`, so their own visibility (e.g. a street scene's hours) stays untouched.
 */
export class StaticCuller {
  private readonly cells = new Map<number, Cullable[]>();
  private readonly cols: number;
  private shown = new Set<number>();
  private lastKey = '';

  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera, worldWidth: number) {
    this.cols = Math.ceil(worldWidth / CELL) + 1;
  }

  add(obj: Phaser.GameObjects.GameObject): void {
    const o = obj as Cullable;
    const key = Math.floor(o.y / CELL) * this.cols + Math.floor(o.x / CELL);
    (this.cells.get(key) ?? this.cells.set(key, []).get(key)!).push(o);
    if (!this.shown.has(key)) o.cameraFilter |= this.camera.id;
  }

  isCulled(obj: Phaser.GameObjects.GameObject): boolean {
    return ((obj as Cullable).cameraFilter & this.camera.id) !== 0;
  }

  update(): void {
    const v = this.camera.worldView;
    const x0 = Math.max(0, Math.floor((v.x - MARGIN) / CELL));
    const y0 = Math.max(0, Math.floor((v.y - MARGIN) / CELL));
    const x1 = Math.floor((v.right + MARGIN) / CELL);
    const y1 = Math.floor((v.bottom + MARGIN) / CELL);
    const key = `${x0},${y0},${x1},${y1}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const next = new Set<number>();
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= Math.min(x1, this.cols - 1); cx++) next.add(cy * this.cols + cx);
    const id = this.camera.id;
    for (const k of this.shown) if (!next.has(k)) for (const o of this.cells.get(k) ?? []) o.cameraFilter |= id;
    for (const k of next) if (!this.shown.has(k)) for (const o of this.cells.get(k) ?? []) o.cameraFilter &= ~id;
    this.shown = next;
  }

  /** Number of objects currently rendered (for the debug overlay and tests). */
  get visibleCount(): number {
    let n = 0;
    for (const k of this.shown) n += this.cells.get(k)?.length ?? 0;
    return n;
  }
}
