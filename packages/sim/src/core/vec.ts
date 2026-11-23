export interface Vec2 {
  x: number;
  y: number;
}

export interface TilePos {
  tx: number;
  ty: number;
}

export function length(x: number, y: number): number {
  return Math.hypot(x, y);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Normalise a direction; returns (0,0) for a zero vector. */
export function normalize(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);
  if (len < 1e-9) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/** Clamp the magnitude of an analog stick vector to 1 without boosting small inputs. */
export function clampMagnitude(x: number, y: number, max = 1): Vec2 {
  const len = Math.hypot(x, y);
  if (len <= max) return { x, y };
  return { x: (x / len) * max, y: (y / len) * max };
}

/** Shortest signed difference between two angles (radians). */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Rotate `current` toward `target` by at most `maxStep` radians. */
export function turnToward(current: number, target: number, maxStep: number): number {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}
