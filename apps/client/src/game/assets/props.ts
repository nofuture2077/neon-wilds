import { createCanvas, ellipse, px, rect, shade, type PixelCanvas } from './canvas';
import { CAR_COLORS } from './palette';

/** Car, 14x28 (sedan 14x30), nose pointing north. */
export function buildCar(variant: number, long = false): PixelCanvas {
  const pc = createCanvas(14, long ? 30 : 28);
  const c = pc.ctx;
  if (long) c.translate(0, 1);
  const body = CAR_COLORS[variant % CAR_COLORS.length]!;
  rect(c, 1, 1, 12, 26, 0x0c0c10);
  rect(c, 2, 1, 10, 26, body);
  rect(c, 1, 3, 1, 22, shade(body, 0.6));
  rect(c, 12, 3, 1, 22, shade(body, 0.6));
  rect(c, 3, 7, 8, 4, 0x1c2733); // windshield
  rect(c, 4, 7, 3, 1, 0x6f8aa3);
  rect(c, 3, 11, 8, 8, shade(body, 1.15)); // roof
  rect(c, 3, 19, 8, 3, 0x1c2733); // rear window
  px(c, 3, 1, 0xfff4c2);
  px(c, 10, 1, 0xfff4c2);
  rect(c, 3, 26, 2, 1, 0xd0303a);
  rect(c, 9, 26, 2, 1, 0xd0303a);
  rect(c, 0, 5, 1, 4, 0x0c0c10);
  rect(c, 13, 5, 1, 4, 0x0c0c10);
  rect(c, 0, 19, 1, 4, 0x0c0c10);
  rect(c, 13, 19, 1, 4, 0x0c0c10);
  return pc;
}

export function buildLamp(): PixelCanvas {
  const pc = createCanvas(8, 8);
  ellipse(pc.ctx, 4, 4, 3, 3, 0x1b1b22);
  ellipse(pc.ctx, 4, 4, 2, 2, 0x8a8a96);
  px(pc.ctx, 3, 3, 0xfff2b0);
  return pc;
}

export function buildBench(): PixelCanvas {
  const pc = createCanvas(6, 14);
  rect(pc.ctx, 0, 0, 6, 14, 0x2b1d14);
  rect(pc.ctx, 1, 0, 2, 14, 0x7a5236);
  rect(pc.ctx, 4, 0, 1, 14, 0x5c3d28);
  return pc;
}

export function buildDumpster(): PixelCanvas {
  const pc = createCanvas(14, 12);
  rect(pc.ctx, 0, 0, 14, 12, 0x0e1a12);
  rect(pc.ctx, 1, 1, 12, 10, 0x2e5d3f);
  rect(pc.ctx, 1, 1, 12, 2, 0x3f7a54);
  rect(pc.ctx, 1, 6, 12, 1, 0x1f3f2b);
  px(pc.ctx, 3, 9, 0x8d6e3a);
  px(pc.ctx, 10, 4, 0x9b9b9b);
  return pc;
}

export function buildTreeCanopy(): PixelCanvas {
  const pc = createCanvas(26, 26);
  const c = pc.ctx;
  ellipse(c, 15, 15, 10, 10, 0x000000, 0.3);
  ellipse(c, 13, 13, 10.5, 10.5, 0x16301e);
  ellipse(c, 13, 13, 9.5, 9.5, 0x24502f);
  ellipse(c, 10, 10, 5, 5, 0x2f6b3d);
  ellipse(c, 16, 9, 4, 4, 0x2f6b3d);
  ellipse(c, 9, 16, 4, 3.5, 0x2a5f37);
  ellipse(c, 9, 8, 2, 2, 0x4c8f5a);
  ellipse(c, 15, 7, 1.5, 1.5, 0x4c8f5a);
  return pc;
}

export function buildShadow(): PixelCanvas {
  const pc = createCanvas(12, 8);
  ellipse(pc.ctx, 6, 4, 5.5, 3.5, 0x000000, 0.35);
  return pc;
}

/** Soft radial light used for lamps and neon halos (tinted at runtime). */
export function buildGlow(size = 64): PixelCanvas {
  const pc = createCanvas(size, size);
  const g = pc.ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  pc.ctx.fillStyle = g;
  pc.ctx.fillRect(0, 0, size, size);
  return pc;
}

/** Small bouncing chevron that marks the current interaction target. */
export function buildFocusMarker(): PixelCanvas {
  const pc = createCanvas(7, 5);
  const c = pc.ctx;
  rect(c, 0, 0, 7, 1, 0x0b0b12);
  rect(c, 0, 1, 7, 1, 0xfff275);
  rect(c, 1, 2, 5, 1, 0xfff275);
  rect(c, 2, 3, 3, 1, 0xfff275);
  rect(c, 3, 4, 1, 1, 0xfff275);
  return pc;
}

/** Courier van, 16x34, nose north. */
export function buildVan(variant: number): PixelCanvas {
  const pc = createCanvas(16, 34);
  const c = pc.ctx;
  const body = [0xd0d0d8, 0x3a3346, 0xe8b830, 0x4a7a9a, 0xc0563a, 0x6a8a4a][variant % 6]!;
  rect(c, 1, 1, 14, 32, 0x0c0c10);
  rect(c, 2, 1, 12, 32, body);
  rect(c, 3, 3, 10, 4, 0x1c2733);
  rect(c, 4, 3, 3, 1, 0x6f8aa3);
  rect(c, 3, 8, 10, 23, shade(body, 1.1));
  rect(c, 3, 8, 10, 1, shade(body, 0.7));
  rect(c, 5, 14, 6, 10, shade(body, 0.92));
  px(c, 3, 1, 0xfff4c2);
  px(c, 12, 1, 0xfff4c2);
  rect(c, 3, 32, 2, 1, 0xd0303a);
  rect(c, 11, 32, 2, 1, 0xd0303a);
  return pc;
}

/** Warden cruiser, 14x30, black and white with a light bar. */
export function buildCruiser(): PixelCanvas {
  const pc = createCanvas(14, 30);
  const c = pc.ctx;
  rect(c, 1, 1, 12, 28, 0x0c0c10);
  rect(c, 2, 1, 10, 28, 0x1a1c24);
  rect(c, 2, 9, 10, 11, 0xe8ecf4);
  rect(c, 3, 7, 8, 3, 0x1c2733);
  rect(c, 3, 20, 8, 3, 0x1c2733);
  rect(c, 3, 13, 4, 2, 0xff3b3b);
  rect(c, 7, 13, 4, 2, 0x3b6bff);
  px(c, 3, 1, 0xfff4c2);
  px(c, 10, 1, 0xfff4c2);
  return pc;
}

/** Signal head seen from above: a dark pole cap. */
export function buildSignal(): PixelCanvas {
  const pc = createCanvas(5, 5);
  ellipse(pc.ctx, 2.5, 2.5, 2.4, 2.4, 0x111118);
  ellipse(pc.ctx, 2.5, 2.5, 1.4, 1.4, 0xffffff);
  return pc;
}

/** Soft smoke puff (tinted at runtime). */
export function buildPuff(): PixelCanvas {
  const pc = createCanvas(8, 8);
  ellipse(pc.ctx, 4, 4, 3.8, 3.8, 0xffffff, 0.8);
  return pc;
}

/** Shipping container seen from above (48x16), ribbed roof. */
export function buildContainer(variant: number): PixelCanvas {
  const pc = createCanvas(48, 16);
  const c = pc.ctx;
  const body = [0xb8333a, 0x2f6fb5, 0x3e8e5e, 0xd9b44a, 0x6b4a8a, 0xc0563a][variant % 6]!;
  rect(c, 0, 0, 48, 16, 0x0c0c10);
  rect(c, 1, 1, 46, 14, body);
  for (let x = 3; x < 46; x += 3) rect(c, x, 1, 1, 14, shade(body, 0.75));
  rect(c, 1, 1, 46, 1, shade(body, 1.3));
  rect(c, 1, 14, 46, 1, shade(body, 0.55));
  px(c, 44, 7, 0xd0d0d8);
  px(c, 44, 8, 0xd0d0d8);
  return pc;
}
