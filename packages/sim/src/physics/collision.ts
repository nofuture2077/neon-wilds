import type { TileMap } from '../world/tilemap';

const SKIN = 1e-4;

export interface MoveResult {
  x: number;
  y: number;
  blockedX: boolean;
  blockedY: boolean;
}

/** True if an axis-aligned box centred on (x, y) with half-extent `half` touches a solid tile. */
export function overlapsSolid(map: TileMap, x: number, y: number, half: number): boolean {
  const minX = Math.floor(x - half);
  const maxX = Math.floor(x + half - SKIN);
  const minY = Math.floor(y - half);
  const maxY = Math.floor(y + half - SKIN);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (map.isSolid(tx, ty)) return true;
    }
  }
  return false;
}

/**
 * Axis-separated swept move against the tile collision layer.
 * Each axis is resolved independently, which gives natural wall sliding.
 * Callers must keep per-step displacement below one tile (true at 60 Hz
 * for every speed in the game) — larger moves are subdivided here anyway.
 */
export function moveAndCollide(map: TileMap, x: number, y: number, half: number, dx: number, dy: number): MoveResult {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.45));
  let blockedX = false;
  let blockedY = false;
  const sx = dx / steps;
  const sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0) {
      const ox = x;
      const nx = x + sx;
      if (overlapsSolid(map, nx, y, half)) {
        blockedX = true;
        x = sx > 0 ? Math.floor(nx + half) - half - SKIN : Math.floor(nx - half) + 1 + half + SKIN;
        if (overlapsSolid(map, x, y, half)) x = ox; // fallback: stay put
      } else {
        x = nx;
      }
    }
    if (sy !== 0) {
      const oy = y;
      const ny = y + sy;
      if (overlapsSolid(map, x, ny, half)) {
        blockedY = true;
        y = sy > 0 ? Math.floor(ny + half) - half - SKIN : Math.floor(ny - half) + 1 + half + SKIN;
        if (overlapsSolid(map, x, y, half)) y = oy;
      } else {
        y = ny;
      }
    }
  }
  return { x, y, blockedX, blockedY };
}
