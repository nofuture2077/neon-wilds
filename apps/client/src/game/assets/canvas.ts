/** Small helpers for drawing procedural pixel art onto offscreen canvases. */

export interface PixelCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function createCanvas(width: number, height: number): PixelCanvas {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not supported');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

/** Multiply each channel by `factor` (0..2), clamped. */
export function shade(color: number, factor: number): number {
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((color >> shift) & 0xff) * factor)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  ctx.fillStyle = css(color, alpha);
  ctx.fillRect(x, y, w, h);
}

export function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: number, alpha = 1): void {
  rect(ctx, x, y, 1, 1, color, alpha);
}

/** Pixel-perfect filled ellipse (no anti-aliasing). */
export function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: number,
  alpha = 1,
): void {
  ctx.fillStyle = css(color, alpha);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Deterministic hash-based noise so procedural art is stable between sessions. */
export function hashNoise(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
