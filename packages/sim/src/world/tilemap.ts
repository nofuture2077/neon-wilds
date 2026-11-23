import { Tile, type TileKind, tileInfo } from './tiles';

/**
 * Dense ground grid plus a derived collision layer.
 *
 * `blocked` combines solid ground tiles with solid props (parked cars,
 * benches...). Both layers are flat typed arrays indexed `y * width + x`.
 */
export class TileMap {
  readonly tiles: Uint8Array;
  readonly blocked: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.tiles = new Uint8Array(width * height);
    this.blocked = new Uint8Array(width * height);
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  get(tx: number, ty: number): TileKind {
    if (!this.inBounds(tx, ty)) return Tile.Void;
    return this.tiles[ty * this.width + tx] as TileKind;
  }

  set(tx: number, ty: number, kind: TileKind): void {
    if (!this.inBounds(tx, ty)) return;
    this.tiles[ty * this.width + tx] = kind;
  }

  fillRect(x: number, y: number, w: number, h: number, kind: TileKind): void {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) this.set(tx, ty, kind);
    }
  }

  /** Mark extra blockers (props). Call `rebuildCollision` first to reset. */
  block(tx: number, ty: number): void {
    if (this.inBounds(tx, ty)) this.blocked[ty * this.width + tx] = 1;
  }

  rebuildCollision(): void {
    for (let i = 0; i < this.tiles.length; i++) {
      this.blocked[i] = tileInfo(this.tiles[i] as TileKind).solid ? 1 : 0;
    }
  }

  /** Out-of-bounds counts as solid so nothing can leave the district. */
  isSolid(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return true;
    return this.blocked[ty * this.width + tx] === 1;
  }

  isPedestrianWalkable(tx: number, ty: number): boolean {
    if (this.isSolid(tx, ty)) return false;
    return tileInfo(this.get(tx, ty)).pedestrian;
  }
}
