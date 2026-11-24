import type { VignetteProp } from '@neon-wilds/sim';
import { createCanvas, ellipse, px, rect, shade, type PixelCanvas } from './canvas';

/** Every vignette prop kind, for the texture manifest. */
export const VIGNETTE_PROPS: VignetteProp[] = ['stall', 'crates', 'fire-barrel', 'speaker', 'easel', 'candles', 'graffiti', 'tent', 'cart', 'nest', 'table', 'cage', 'flowers', 'toolbox'];

export const vignetteKey = (kind: VignetteProp) => `vig-${kind}`;

/** Small top-down props for street scenes, one tile (16×16) each. */
export function buildVignetteProp(kind: VignetteProp): PixelCanvas {
  const pc = createCanvas(16, 16);
  const c = pc.ctx;
  switch (kind) {
    case 'stall':
      rect(c, 1, 5, 14, 10, 0x3a2a20);
      rect(c, 2, 6, 12, 8, 0x5a4030);
      for (let x = 0; x < 16; x += 2) rect(c, x, 0, 2, 5, x % 4 === 0 ? 0xff5d5d : 0xf2e8d8);
      rect(c, 0, 4, 16, 1, 0x2a1a14);
      px(c, 4, 8, 0xffb347);
      px(c, 7, 9, 0x4fffb0);
      px(c, 11, 8, 0xff8fd0);
      break;
    case 'crates':
      rect(c, 1, 3, 8, 8, 0x5a3a22);
      rect(c, 2, 4, 6, 6, 0x8a5a32);
      rect(c, 2, 6, 6, 1, 0x5a3a22);
      rect(c, 7, 7, 8, 8, 0x4a3020);
      rect(c, 8, 8, 6, 6, 0x7a4e2c);
      rect(c, 10, 8, 1, 6, 0x4a3020);
      break;
    case 'fire-barrel':
      ellipse(c, 8, 9, 6, 6, 0x2a2a30);
      ellipse(c, 8, 9, 5, 5, 0x4a3a30);
      ellipse(c, 8, 9, 3.5, 3.5, 0xff6b35);
      ellipse(c, 8, 9, 2, 2, 0xffd23f);
      px(c, 7, 6, 0xfff1b8);
      break;
    case 'speaker':
      rect(c, 3, 2, 10, 13, 0x111116);
      rect(c, 4, 3, 8, 11, 0x24242c);
      ellipse(c, 8, 10, 3, 3, 0x0a0a0e);
      ellipse(c, 8, 10, 1.2, 1.2, 0x5a5a66);
      ellipse(c, 8, 5, 1.5, 1.5, 0x0a0a0e);
      px(c, 11, 3, 0x4fffb0);
      break;
    case 'easel':
      rect(c, 3, 1, 10, 9, 0x6b4f3a);
      rect(c, 4, 2, 8, 7, 0xf2e8d8);
      rect(c, 5, 4, 3, 2, 0x4f8f3f);
      rect(c, 8, 3, 2, 4, 0x7a5cff);
      rect(c, 4, 10, 1, 5, 0x6b4f3a);
      rect(c, 11, 10, 1, 5, 0x6b4f3a);
      break;
    case 'candles':
      for (const [x, y, h] of [[4, 8, 5], [8, 6, 7], [11, 9, 4], [6, 11, 3]] as const) {
        rect(c, x, y, 2, h, 0xf2e8d8);
        px(c, x, y - 1, 0xffd23f);
        px(c, x + 1, y - 2, 0xff6b35);
      }
      break;
    case 'graffiti':
      rect(c, 1, 4, 14, 8, 0x000000);
      c.globalAlpha = 0.85;
      rect(c, 2, 5, 4, 6, 0xff3fa4);
      rect(c, 6, 6, 3, 4, 0x00e5ff);
      rect(c, 9, 5, 5, 2, 0xffd23f);
      rect(c, 10, 8, 3, 3, 0x4fffb0);
      c.globalAlpha = 1;
      px(c, 4, 7, 0xffffff);
      break;
    case 'tent':
      for (let y = 0; y < 14; y++) rect(c, 7 - Math.floor(y / 2), y + 1, 2 + Math.floor(y / 2) * 2, 1, y % 3 === 0 ? 0x3a5a6a : 0x4a6a7a);
      rect(c, 7, 7, 2, 8, 0x1a2228);
      break;
    case 'cart':
      rect(c, 1, 3, 14, 9, 0x2a2a34);
      rect(c, 2, 4, 12, 7, 0x8a8a96);
      rect(c, 2, 4, 12, 2, 0xb8b8c4);
      ellipse(c, 4, 13, 2, 2, 0x111116);
      ellipse(c, 12, 13, 2, 2, 0x111116);
      px(c, 7, 7, 0xffb347);
      px(c, 9, 8, 0xff5d5d);
      break;
    case 'nest':
      ellipse(c, 8, 9, 6.5, 5, 0x4a3420);
      ellipse(c, 8, 9, 4.5, 3.5, 0x6b4f2a);
      ellipse(c, 8, 9, 3, 2, 0x2a1e12);
      for (const [x, y] of [[3, 6], [12, 7], [5, 13], [11, 12]] as const) px(c, x, y, 0xb8902c);
      px(c, 7, 8, 0x9bc0ff);
      px(c, 9, 9, 0xd9b44a);
      break;
    case 'table':
      rect(c, 1, 4, 14, 8, 0x3a2a20);
      rect(c, 2, 5, 12, 6, 0x8a6a4a);
      rect(c, 2, 5, 12, 1, 0xa88a6a);
      ellipse(c, 5, 8, 1.5, 1.5, 0xf2e8d8);
      ellipse(c, 10, 8, 1.5, 1.5, 0xf2e8d8);
      break;
    case 'cage':
      rect(c, 2, 3, 12, 11, 0x111116);
      rect(c, 3, 4, 10, 9, 0x1e1e26);
      for (let x = 3; x < 14; x += 2) rect(c, x, 3, 1, 11, 0x8a8a96);
      rect(c, 2, 3, 12, 1, 0xb8b8c4);
      break;
    case 'flowers':
      rect(c, 2, 9, 12, 6, 0x5a3a22);
      rect(c, 3, 9, 10, 2, 0x3d6b34);
      for (const [x, y, col] of [[4, 6, 0xff5d5d], [7, 5, 0xffd23f], [10, 6, 0xff8fd0], [6, 8, 0xb37dff], [11, 8, 0xfff1d6]] as const) {
        px(c, x, y + 1, 0x2f5a2a);
        ellipse(c, x + 0.5, y + 0.5, 1.3, 1.3, col);
      }
      break;
    case 'toolbox':
      rect(c, 2, 6, 12, 7, 0x8a1e1e);
      rect(c, 2, 6, 12, 2, shade(0xc0303a, 1));
      rect(c, 6, 4, 4, 2, 0x3a3a44);
      rect(c, 3, 10, 2, 1, 0xd8d8e0);
      px(c, 12, 2, 0xb8b8c4);
      rect(c, 12, 3, 1, 3, 0x8a8a96);
      break;
  }
  return pc;
}
