import { createCanvas, css, type PixelCanvas } from './canvas';

/**
 * Procedural Wildling sprites. Each species is drawn on a 16-unit grid in
 * side view facing right; the painter scales it to any size (16 px for the
 * overworld, 48 px for battles) so both versions share one design.
 */
interface Painter {
  /** Filled ellipse with a dark outline. */
  eo(cx: number, cy: number, rx: number, ry: number, color: number): void;
  /** Filled ellipse without outline. */
  e(cx: number, cy: number, rx: number, ry: number, color: number): void;
  r(x: number, y: number, w: number, h: number, color: number): void;
  p(x: number, y: number, color: number): void;
}

const OUTLINE = 0x0c0a12;
const EYE = 0x0c0a12;
const SHINE = 0xffffff;

function painter(ctx: CanvasRenderingContext2D, ox: number, k: number): Painter {
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color: number) => {
    ctx.fillStyle = css(color);
    const x0 = Math.floor((cx - rx) * k);
    const x1 = Math.ceil((cx + rx) * k);
    const y0 = Math.floor((cy - ry) * k);
    const y1 = Math.ceil((cy + ry) * k);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const dx = (x + 0.5) / k - cx;
        const dy = (y + 0.5) / k - cy;
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) ctx.fillRect(ox + x, y, 1, 1);
      }
    }
  };
  return {
    e: ellipse,
    eo(cx, cy, rx, ry, color) {
      const o = Math.max(0.6, 1.2 / k);
      ellipse(cx, cy, rx + o, ry + o, OUTLINE);
      ellipse(cx, cy, rx, ry, color);
    },
    r(x, y, w, h, color) {
      ctx.fillStyle = css(color);
      ctx.fillRect(ox + Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    },
    p(x, y, color) {
      ctx.fillStyle = css(color);
      const s = Math.max(1, Math.round(k));
      ctx.fillRect(ox + Math.round(x * k), Math.round(y * k), s, s);
    },
  };
}

type Draw = (g: Painter, frame: number) => void;

const eye = (g: Painter, x: number, y: number, iris = EYE) => {
  g.e(x, y, 0.9, 1, iris);
  g.p(x - 0.2, y - 0.6, SHINE);
};

const legs = (g: Painter, xs: number[], y: number, color: number, frame: number, h = 1.8) => {
  xs.forEach((x, i) => g.r(x + (frame === 1 && i % 2 === 0 ? 0.4 : 0), y, 1.1, h, color));
};

const DRAW: Record<string, Draw> = {
  fizzlet(g, f) {
    const b = f ? 0.4 : 0;
    g.r(2, 10 + b, 4, 0.8, 0xd9a82e);
    g.r(1, 8.5 + b, 1, 1.5, 0x00e5ff);
    g.r(2, 7.5 + b, 1, 1.2, 0x7ff6ff);
    legs(g, [6, 10], 13.2, 0xb8862a, f);
    g.eo(8, 11 + b, 4.5, 3.1, 0xf2c94c);
    g.e(8.6, 12 + b, 3, 1.7, 0xfff1b8);
    g.eo(12, 8.6 + b, 3, 2.7, 0xf2c94c);
    g.eo(10.8, 5.8 + b, 1.2, 1.6, 0xe0a82e);
    g.e(10.8, 6 + b, 0.6, 0.9, 0xff9ec7);
    eye(g, 13, 8.2 + b);
    g.p(14.8, 9 + b, 0xff6fa8);
    g.p(15.2, 8 + b, 0x00e5ff);
    g.p(15.4, 10 + b, 0x00e5ff);
  },
  neonyx(g, f) {
    const b = f ? 0.4 : 0;
    g.r(0.5, 10.5 + b, 4.5, 0.7, 0x00e5ff);
    g.r(0.3, 9.5 + b, 0.8, 1.2, 0x7ff6ff);
    legs(g, [5.5, 10], 13, 0x1a1230, f);
    g.eo(8, 11 + b, 5.5, 2.6, 0x2b1f45);
    g.r(4.5, 10 + b, 7, 0.6, 0x00e5ff);
    g.r(5.5, 11.6 + b, 5, 0.5, 0xff3fa4);
    g.eo(13, 9 + b, 2.6, 2.2, 0x3a2a5c);
    g.r(12, 5.5 + b, 1, 2.5, 0x2b1f45);
    g.p(12.2, 5.5 + b, 0x00e5ff);
    g.e(13.8, 8.6 + b, 0.9, 0.7, 0x00e5ff);
    g.p(13.9, 8.4 + b, SHINE);
  },
  cindertail(g, f) {
    const b = f ? 0.3 : 0;
    g.r(3, 4.5, 1.2, 6.5, 0x6a3b2e);
    g.eo(3.4, 3.6 - b, 1.7, 2.1, 0xff6b35);
    g.e(3.4, 3.8 - b, 0.9, 1.2, 0xffd23f);
    legs(g, [5, 7, 9.5, 11], 12.8, 0x4a2a20, f, 2.2);
    g.eo(7.8, 11 + b, 4.6, 2.7, 0x6a3b2e);
    g.e(8, 12 + b, 3, 1.4, 0x8d5a48);
    g.eo(12.2, 8 + b, 2.8, 2.5, 0x7a4636);
    g.r(10.8, 4.8 + b, 1.2, 1.8, 0x7a4636);
    g.r(13, 4.8 + b, 1.2, 1.8, 0x7a4636);
    g.p(11, 5.4 + b, 0xff6b35);
    eye(g, 13.2, 7.8 + b, 0xffb347);
    g.p(14.8, 8.8 + b, 0x2a1a14);
  },
  puddlefin(g, f) {
    const b = f ? 0.5 : 0;
    g.eo(3, 10 + b, 1.8, 2.8, 0x2a6fc0);
    g.eo(8, 7.2 + b, 2, 1.2, 0x2a6fc0);
    g.eo(8, 10 + b, 5, 3, 0x3a8fe0);
    g.e(8.8, 11.4 + b, 3.6, 1.4, 0xa8d8ff);
    g.r(5, 9 + b, 4, 0.5, 0x7fc0ff);
    g.eo(8, 13.4, 1.6, 0.8, 0x2a6fc0);
    g.e(11.6, 9 + b, 1.3, 1.3, SHINE);
    eye(g, 12, 9 + b);
    g.p(14.4, 10.4 + b, 0x1f4e79);
    g.p(14, f ? 4 : 5.5, 0xa8d8ff);
    g.p(15, f ? 2.5 : 3.5, 0xa8d8ff);
  },
  cracksprout(g, f) {
    const sway = f ? 0.5 : 0;
    g.r(3.5, 14, 9, 1.6, 0x6a6a78);
    g.r(4, 13.6, 2, 0.6, 0x8a8a96);
    g.r(7.8, 7.5, 0.9, 4, 0x3f8f3f);
    g.eo(5.8 + sway, 7.5, 2.6, 1.2, 0x6fd36f);
    g.eo(10.4 + sway, 6.8, 2.6, 1.2, 0x58b858);
    g.eo(8.2 + sway, 4.8, 1.2, 1.8, 0x8de38d);
    g.eo(8.2, 12.2, 3.6, 2.4, 0x6b7f4a);
    g.e(8.6, 12.8, 2.4, 1.2, 0x8a9a64);
    eye(g, 7.5, 12);
    eye(g, 10, 12);
  },
  binbandit(g, f) {
    const b = f ? 0.4 : 0;
    g.eo(3, 9 + b, 2, 3.3, 0x5a5770);
    g.r(1.3, 7.6 + b, 3.4, 0.8, 0x24222f);
    g.r(1.3, 9.8 + b, 3.4, 0.8, 0x24222f);
    legs(g, [5.5, 9.5], 13, 0x2e2c3a, f);
    g.eo(7.8, 11 + b, 4.5, 3, 0x6b6880);
    g.e(8.4, 12.2 + b, 2.8, 1.4, 0x9a97ad);
    g.eo(12, 8.6 + b, 3, 2.6, 0x8a879e);
    g.eo(10.8, 5.9 + b, 1.1, 1.1, 0x6b6880);
    g.r(10, 7.6 + b, 5, 1.5, 0x1a1826);
    g.p(12.8, 8 + b, SHINE);
    g.p(14, 8 + b, SHINE);
    g.p(15, 9.6 + b, 0x1a1826);
  },
  scrapup(g, f) {
    const b = f ? 0.4 : 0;
    for (let i = 0; i < 3; i++) g.r(2.5 + i * 0.8, 8 + (i % 2) * 1.2 - b, 0.8, 0.8, 0x8a8f9b);
    legs(g, [5.5, 9.5], 13, 0x55585f, f);
    g.eo(8, 11 + b, 4, 2.8, 0x9aa0ad);
    g.p(6, 10 + b, 0x55585f);
    g.p(9.5, 11.5 + b, 0x55585f);
    g.eo(12, 8.6 + b, 2.8, 2.5, 0xb3b9c6);
    g.eo(10.6, 7.6 + b, 1, 1.9, 0x6c7380);
    g.e(13.2, 8.2 + b, 0.8, 0.8, 0xff3b3b);
    g.p(13, 7.9 + b, 0xffb0b0);
    g.r(13.2, 10 + b, 2, 0.7, 0x55585f);
  },
  gearhound(g, f) {
    const b = f ? 0.4 : 0;
    g.r(1.5, 8.5 - b, 2.5, 1, 0x6c7380);
    legs(g, [4.5, 6.5, 9.5, 11.5], 12.6, 0x3a3d44, f, 2.6);
    g.eo(7.5, 10.4 + b, 5.2, 3.2, 0x6c7380);
    g.e(7.5, 11.6 + b, 4, 1.4, 0x858da0);
    g.eo(7, 7.8 + b, 2, 2, 0xc9a227);
    g.e(7, 7.8 + b, 0.8, 0.8, 0x3a3d44);
    g.eo(12.6, 7.8 + b, 3, 2.6, 0x858da0);
    g.r(12, 9.4 + b, 3.8, 1.1, 0x3a3d44);
    g.p(14, 9.4 + b, SHINE);
    g.e(13.6, 7.2 + b, 0.8, 0.7, 0xff3b3b);
    g.r(11, 4.8 + b, 1, 1.8, 0x6c7380);
  },
  pebblet(g, f) {
    const b = f ? 0.25 : 0;
    legs(g, [5.5, 10], 13.4, 0x6b5f52, f, 1.4);
    g.eo(13.2, 12 + b, 1.8, 1.5, 0xb5a48f);
    g.p(14, 11.4 + b, EYE);
    g.eo(8, 11 + b, 5, 3.5, 0x8d7f70);
    for (const x of [5, 7, 9, 11]) g.r(x, 8.2 + b, 0.6, 5, 0x6b5f52);
    g.e(7, 9 + b, 2, 0.8, 0xa89a8a);
  },
  ventwing(g, f) {
    const flap = f ? -1.5 : 0;
    g.r(2.5, 9.5, 2.2, 1, 0x3f4a2a);
    g.r(7.6, 12.4, 0.5, 2.2, 0xd98a2a);
    g.r(9, 12.4, 0.5, 2.2, 0xd98a2a);
    g.eo(8, 10, 3.8, 2.8, 0x6f7f4a);
    g.eo(10.5, 8, 2, 2, 0x8a5cc0);
    g.e(10.8, 8.4, 1.2, 1.1, 0x4fb89a);
    g.eo(12, 6.8, 2, 1.8, 0x7a8a55);
    g.r(13.6, 6.8, 1.8, 0.8, 0xd9b44a);
    eye(g, 12.4, 6.4, 0xff6b35);
    g.eo(6.8, 9.2 + flap, 2.8, 1.5, 0x55613a);
  },
  wattbug(g, f) {
    const b = f ? 0.4 : 0;
    g.eo(5.5, 9 + b, 2.2, 1.2, 0xa8f0ff);
    g.eo(9.5, 8.5 - b, 2.4, 1.3, 0xa8f0ff);
    legs(g, [6, 8, 10], 12.5, 0x2a2a3a, f, 1.6);
    g.eo(8, 11, 3.6, 2.4, 0x2b3a6a);
    g.r(5, 10.2, 6, 0.6, 0xffd23f);
    g.r(5.5, 11.6, 5, 0.5, 0xffd23f);
    g.eo(11.8, 10, 1.8, 1.6, 0x1f2a50);
    g.e(12.4, 9.6, 0.7, 0.7, 0xffd23f);
    g.r(12, 6.5, 0.5, 2.2, 0x2b3a6a);
    g.p(12.2, 6, 0x7ff6ff);
  },
  hydrantoad(g, f) {
    const b = f ? 0.3 : 0;
    g.eo(8, 11.5 + b, 5.6, 3.4, 0xc0392b);
    g.e(8.5, 12.6 + b, 4, 1.8, 0xe8b830);
    g.r(5, 8.5 + b, 6, 1, 0xd0d0d8);
    g.eo(4.5, 13.5, 1.6, 1, 0xa02a20);
    g.eo(11.5, 13.5, 1.6, 1, 0xa02a20);
    g.eo(11, 8.4 + b, 1.6, 1.6, 0xc0392b);
    g.eo(6.8, 8.6 + b, 1.4, 1.4, 0xc0392b);
    eye(g, 11.2, 8.2 + b, 0xffd23f);
    g.r(12.5, 10.6 + b, 2.5, 0.6, 0x5a1a14);
    if (f) {
      g.p(14.5, 9, 0x7fc0ff);
      g.p(15, 8, 0x7fc0ff);
    }
  },
  heistcoon(g, f) {
    const b = f ? 0.4 : 0;
    g.eo(2.8, 9 + b, 2, 3.4, 0x4a4760);
    g.r(1, 7.6 + b, 3.6, 0.8, 0x9aa0ad);
    g.r(1, 9.8 + b, 3.6, 0.8, 0x9aa0ad);
    legs(g, [5.5, 9.5], 13, 0x22202c, f);
    g.eo(7.8, 11 + b, 4.7, 3.1, 0x5a5770);
    g.r(5.5, 10 + b, 5, 1, 0x9aa0ad);
    g.p(6, 10.2 + b, 0xffd23f);
    g.eo(12, 8.4 + b, 3, 2.6, 0x7a7790);
    g.eo(10.8, 5.7 + b, 1.1, 1.1, 0x5a5770);
    g.r(10, 7.4 + b, 5, 1.5, 0x111018);
    g.p(12.8, 7.8 + b, 0x00e5ff);
    g.p(14, 7.8 + b, 0x00e5ff);
    g.r(14.2, 10 + b, 1.4, 0.5, 0x9aa0ad);
  },
  glitchling(g, f) {
    const hover = f ? -0.6 : 0;
    const glitch = f ? 1 : -1;
    g.e(8, 15, 3, 0.6, 0x000000);
    g.r(5.5, 12 + hover, 0.8, 2, 0x2a1d48);
    g.r(9.5, 12.4 + hover, 0.8, 1.8, 0x2a1d48);
    g.r(7.6, 3.6 + hover, 0.6, 2.2, 0x3a2a5c);
    g.p(7.6, 3 + hover, 0xff3fa4);
    g.eo(8, 9 + hover, 3.8, 3.8, 0x1c1430);
    g.r(4.2 + glitch * 0.6, 7 + hover, 2, 0.6, 0xff3fa4);
    g.r(9.8 - glitch * 0.6, 11 + hover, 2.2, 0.6, 0x00e5ff);
    g.r(5, 10.5 + hover, 1, 0.6, 0x00e5ff);
    g.e(9.4, 8.6 + hover, 1.8, 1.8, 0x00e5ff);
    g.e(9.8, 8.6 + hover, 0.8, 0.9, EYE);
    g.p(9, 7.8 + hover, SHINE);
  },
};

export const CREATURE_FRAMES = 2;

/** Sprite sheet: two frames side by side, `size` px each. */
export function buildCreatureSheet(speciesId: string, size: number): PixelCanvas {
  const pc = createCanvas(size * CREATURE_FRAMES, size);
  const draw = DRAW[speciesId] ?? DRAW.glitchling!;
  const k = size / 16;
  for (let f = 0; f < CREATURE_FRAMES; f++) draw(painter(pc.ctx, f * size, k), f);
  return pc;
}

export const creatureKey = (speciesId: string, size: 'small' | 'large') => `wl-${speciesId}-${size}`;
export const CREATURE_SIZES = { small: 16, large: 48 } as const;

/** Snare capsule used in battle throw animations. */
export function buildSnare(): PixelCanvas {
  const pc = createCanvas(10, 10);
  const g = painter(pc.ctx, 0, 10 / 16);
  g.eo(8, 8, 6, 6, 0x9aa0ad);
  g.r(2, 7, 12, 2, 0x3a3d44);
  g.e(8, 8, 2, 2, 0xff3fa4);
  return pc;
}
