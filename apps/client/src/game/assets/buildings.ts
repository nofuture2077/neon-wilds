import { TILE_SIZE, type Building } from '@neon-wilds/sim';
import { createCanvas, ellipse, hashNoise, px, rect, shade, type PixelCanvas } from './canvas';
import { NEON, ROOF_STYLES } from './palette';

const T = TILE_SIZE;
const FLOOR_H = 11;
const GROUND_H = 14;

/** A light source baked into the building art; the renderer adds a matching glow sprite. */
export interface BuildingLight {
  /** Local pixel position inside the building texture. */
  x: number;
  y: number;
  color: number;
  scale: number;
  /** 0..1 — how visible the halo is in daylight. */
  day: number;
  flicker: boolean;
}

export interface BuildingArt {
  canvas: PixelCanvas;
  lights: BuildingLight[];
}

/**
 * Oblique ¾ top-down building: the footprint is split into a roof (seen from
 * above) and a south-facing facade (seen from the front), which gives height
 * without letting art spill outside the collision footprint.
 *
 * Everything is seeded from the building id, so the city looks identical
 * every session. Pure presentation: the simulation only knows the footprint.
 */
export function buildBuilding(b: Building): BuildingArt {
  const w = b.w * T;
  const h = b.h * T;
  const pc = createCanvas(w, h);
  const c = pc.ctx;
  const style = ROOF_STYLES[b.style % ROOF_STYLES.length]!;
  const seed = hashSeed(b.id);
  const rnd = (i: number) => hashNoise(i, i * 7 + 3, seed);
  const lights: BuildingLight[] = [];

  const storeys = 2 + Math.floor(rnd(1) * 3);
  const wallH = Math.max(GROUND_H + FLOOR_H, Math.min(h - 26, GROUND_H + storeys * FLOOR_H));
  const roofH = h - wallH;
  const accent = b.neon ?? NEON[Math.floor(rnd(2) * NEON.length)]!;
  const doorFront = b.door.facing === 'south';

  drawRoof(c, w, roofH, style, seed, rnd);
  // Neon trim along the roof lip on some buildings.
  if (rnd(12) < 0.4) {
    const trim = NEON[Math.floor(rnd(13) * NEON.length)]!;
    rect(c, 1, roofH - 2, w - 2, 1, trim);
    rect(c, 1, roofH - 1, w - 2, 1, shade(trim, 0.5));
    for (let lx = 8; lx < w; lx += 24) lights.push({ x: lx, y: roofH - 2, color: trim, scale: 0.35, day: 0.15, flicker: false });
  }
  drawFacade(c, b, w, roofH, wallH, style, accent, doorFront, rnd, lights);

  // Signage.
  if (b.neon !== null) {
    const signW = Math.min(w - 10, 8 + b.name.length * 3);
    if (doorFront) {
      const sx = Math.round((w - signW) / 2);
      const sy = roofH + Math.max(2, wallH - GROUND_H - 12);
      drawSign(c, sx, sy, signW, 9, b.neon, seed);
      lights.push({ x: sx + signW / 2, y: sy + 4, color: b.neon, scale: Math.max(0.6, signW / 40), day: 0.25, flicker: rnd(3) < 0.25 });
    } else {
      // Rooftop sign facing the street to the north.
      const sx = Math.round((w - signW) / 2);
      drawSign(c, sx, 3, signW, 9, b.neon, seed);
      lights.push({ x: sx + signW / 2, y: 7, color: b.neon, scale: Math.max(0.6, signW / 40), day: 0.25, flicker: rnd(3) < 0.25 });
    }
  }
  // Vertical blade sign on many buildings, like the dense signage of the reference art.
  if (rnd(4) < (b.neon !== null ? 0.8 : 0.45) && wallH >= 30) {
    const bx = rnd(5) < 0.5 ? 2 : w - 9;
    const bh = Math.min(wallH - 6, 28);
    const color = NEON[Math.floor(rnd(6) * NEON.length)]!;
    drawSign(c, bx, roofH + 2, 7, bh, color, seed + 11, true);
    lights.push({ x: bx + 3.5, y: roofH + 2 + bh / 2, color, scale: 0.55, day: 0.2, flicker: rnd(7) < 0.2 });
  }
  // Rooftop billboard on larger buildings.
  if (b.w >= 4 && rnd(8) < 0.45 && roofH >= 30) {
    const bw = Math.min(w - 16, 30);
    const bx = 6 + Math.floor(rnd(9) * Math.max(1, w - 12 - bw));
    const by = doorFront ? 5 : roofH - 18;
    const color = NEON[Math.floor(rnd(10) * NEON.length)]!;
    drawBillboard(c, bx, by, bw, 13, color, seed);
    lights.push({ x: bx + bw / 2, y: by + 6, color, scale: 0.8, day: 0.3, flicker: false });
  }

  return { canvas: pc, lights };
}

type Style = (typeof ROOF_STYLES)[number];

function drawRoof(c: CanvasRenderingContext2D, w: number, roofH: number, style: Style, seed: number, rnd: (i: number) => number) {
  rect(c, 0, 0, w, roofH, style.base);
  for (let y = 0; y < roofH; y++) {
    for (let x = 0; x < w; x++) {
      const n = hashNoise(x, y, seed);
      if (n < 0.06) px(c, x, y, style.dark);
      else if (n > 0.97) px(c, x, y, style.edge, 0.5);
    }
  }
  // parapet: light lip on the south edge sells the height of the building
  rect(c, 0, 0, w, 2, style.edge);
  rect(c, 0, 0, 2, roofH, shade(style.edge, 0.85));
  rect(c, w - 2, 0, 2, roofH, shade(style.edge, 0.7));
  rect(c, 0, roofH - 2, w, 2, shade(style.edge, 1.25));
  rect(c, 2, 2, w - 4, 1, style.dark);

  // rooftop clutter
  const occupied: Array<[number, number, number, number]> = [];
  const free = (x: number, y: number, fw: number, fh: number) =>
    occupied.every(([ox, oy, ow, oh]) => x + fw + 1 < ox || ox + ow + 1 < x || y + fh + 1 < oy || oy + oh + 1 < y);
  const target = Math.max(1, Math.floor((w * roofH) / 380));
  for (let i = 0; i < target * 4 && occupied.length < target; i++) {
    const kind = Math.floor(rnd(i + 20) * 4);
    const size: [number, number] = kind === 0 ? [8, 6] : kind === 1 ? [4, 4] : kind === 2 ? [10, 7] : [11, 11];
    if (size[0] + 8 > w || size[1] + 8 > roofH) continue;
    const x = 4 + Math.floor(rnd(i + 100) * (w - 8 - size[0]));
    const y = 4 + Math.floor(rnd(i + 200) * (roofH - 8 - size[1]));
    if (!free(x, y, size[0], size[1])) continue;
    occupied.push([x, y, size[0], size[1]]);
    switch (kind) {
      case 0: // AC unit
        rect(c, x + 1, y + 2, 8, 6, 0x000000, 0.4);
        rect(c, x, y, 8, 6, 0x5d5870);
        rect(c, x, y, 8, 1, 0x7e7894);
        ellipse(c, x + 3.5, y + 3.2, 2, 2, 0x221e2c);
        px(c, x + 6, y + 2, 0x4fffb0);
        break;
      case 1: // vent
        rect(c, x + 1, y + 1, 4, 4, 0x000000, 0.4);
        rect(c, x, y, 4, 4, 0x47425a);
        rect(c, x + 1, y + 1, 2, 2, 0x120f18);
        break;
      case 2: // skylight leaking interior light
        rect(c, x, y, 10, 7, 0x16131d);
        rect(c, x + 1, y + 1, 8, 5, 0x3b2d55);
        rect(c, x + 1, y + 1, 3, 1, 0xb37dff);
        rect(c, x + 5, y + 1, 1, 5, 0x16131d);
        break;
      case 3: // water tank
        ellipse(c, x + 6.5, y + 7, 5.5, 5.5, 0x000000, 0.4);
        ellipse(c, x + 5.5, y + 5.5, 5.5, 5.5, 0x3e3346);
        ellipse(c, x + 5.5, y + 5.5, 4, 4, 0x514359);
        rect(c, x + 3, y + 5, 6, 1, 0x2c2433);
        break;
    }
  }
}

function drawFacade(
  c: CanvasRenderingContext2D,
  b: Building,
  w: number,
  top: number,
  wallH: number,
  style: Style,
  accent: number,
  doorFront: boolean,
  rnd: (i: number) => number,
  lights: BuildingLight[],
) {
  rect(c, 0, top, w, wallH, style.wall);
  // vertical shading at the edges for depth
  rect(c, 0, top, 2, wallH, style.wallDark);
  rect(c, w - 2, top, 2, wallH, shade(style.wallDark, 0.8));
  rect(c, 0, top, w, 1, 0x000000, 0.5);
  rect(c, 2, top + 1, 1, wallH - 2, shade(style.wall, 1.35));

  // upper floors with windows
  const groundTop = top + wallH - GROUND_H;
  const windowColors = [0x7ff6ff, 0xff8fd0, 0xffc46b, 0xfff1d6, 0xc7a8ff];
  let wi = 0;
  for (let fy = groundTop - FLOOR_H; fy >= top + 1; fy -= FLOOR_H) {
    rect(c, 2, fy + FLOOR_H - 1, w - 4, 1, style.wallDark);
    for (let wx = 4; wx + 4 <= w - 4; wx += 7) {
      wi++;
      const lit = rnd(300 + wi) < 0.55;
      if (lit) {
        const col = windowColors[Math.floor(rnd(400 + wi) * windowColors.length)]!;
        rect(c, wx, fy + 2, 4, 6, shade(col, 0.75));
        rect(c, wx, fy + 2, 4, 2, col);
        if (rnd(500 + wi) < 0.25) lights.push({ x: wx + 2, y: fy + 5, color: col, scale: 0.25, day: 0, flicker: false });
      } else {
        rect(c, wx, fy + 2, 4, 6, 0x110e17);
        px(c, wx, fy + 2, 0x3a3450);
      }
      rect(c, wx - 1, fy + 8, 6, 1, shade(style.wall, 1.4)); // sill
    }
  }

  // fire escape zig-zag on residential facades
  if (b.kind === 'residential' && w >= 48 && groundTop - top > FLOOR_H) {
    const fx = Math.floor(w * 0.55);
    for (let fy = top + 3, i = 0; fy + 8 < groundTop; fy += FLOOR_H, i++) {
      rect(c, fx - 6, fy + 8, 14, 1, 0x6b6580);
      for (let s = 0; s < 8; s++) px(c, i % 2 === 0 ? fx - 5 + s : fx + 6 - s, fy + 8 - s, 0x58526a);
    }
  }

  // ground floor
  rect(c, 2, groundTop, w - 4, GROUND_H, shade(style.wall, 0.8));
  rect(c, 0, top + wallH - 1, w, 1, 0x000000, 0.6);
  const doorX = (b.door.tx - b.x) * T + 5;
  if (doorFront) {
    const storefront = b.kind !== 'residential' && b.kind !== 'warehouse';
    if (storefront) {
      // glass shopfront glowing with the shop's colour, awning above
      const glass = shade(accent, 0.45);
      for (let gx = 4; gx + 6 <= w - 4; gx += 8) {
        if (gx + 6 > doorX - 1 && gx < doorX + 7) continue;
        rect(c, gx, groundTop + 4, 6, 8, glass);
        rect(c, gx, groundTop + 4, 6, 1, shade(accent, 0.9));
        px(c, gx + 1, groundTop + 6, 0xffffff, 0.5);
      }
      for (let ax = 2; ax < w - 2; ax++) {
        rect(c, ax, groundTop, 1, 3, Math.floor(ax / 3) % 2 === 0 ? shade(accent, 0.8) : shade(accent, 0.4));
      }
      lights.push({ x: w / 2, y: top + wallH + 2, color: accent, scale: Math.min(1.4, w / 50), day: 0.1, flicker: false });
    }
    // door
    rect(c, doorX, groundTop + 3, 6, GROUND_H - 3, 0x0d0b12);
    rect(c, doorX + 1, groundTop + 4, 4, GROUND_H - 5, storefront ? shade(accent, 0.6) : 0x3a2c22);
    rect(c, doorX - 1, groundTop + 2, 8, 1, shade(accent, 0.9));
  } else {
    // back side faces the service alley: back door, pipes, a security light
    const backX = 4 + Math.floor(rnd(30) * Math.max(1, w - 14));
    rect(c, backX, groundTop + 4, 6, GROUND_H - 4, 0x16121c);
    rect(c, backX + 1, groundTop + 5, 4, GROUND_H - 6, 0x2c2633);
    px(c, backX + 2, groundTop + 2, 0xfff1d6);
    lights.push({ x: backX + 3, y: groundTop + 2, color: 0xffd7a0, scale: 0.35, day: 0, flicker: rnd(31) < 0.3 });
    const pipeX = w - 6 - Math.floor(rnd(32) * 8);
    rect(c, pipeX, top + 2, 2, wallH - 3, 0x4a445a);
    rect(c, pipeX, top + 2, 1, wallH - 3, 0x5d5770);
  }
}

/** Neon sign: dark board, glowing border and pseudo-script glyphs. */
function drawSign(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number, seed: number, vertical = false) {
  rect(c, x, y, w, h, 0x0b0810);
  rect(c, x, y, w, 1, color);
  rect(c, x, y + h - 1, w, 1, color);
  rect(c, x, y, 1, h, color);
  rect(c, x + w - 1, y, 1, h, color);
  const glyph = (gx: number, gy: number, k: number) => {
    for (let i = 0; i < 6; i++) {
      if (hashNoise(k, i, seed) < 0.55) px(c, gx + (i % 2), gy + Math.floor(i / 2), shade(color, 1.25));
    }
    px(c, gx + 2, gy + 1, shade(color, 1.25));
  };
  if (vertical) {
    for (let gy = y + 2, k = 0; gy + 3 <= y + h - 2; gy += 4, k++) glyph(x + 2, gy, k);
  } else {
    for (let gx = x + 2, k = 0; gx + 3 <= x + w - 2; gx += 4, k++) glyph(gx, y + 3, k);
  }
}

/** Rooftop billboard: frame, struts and a glowing abstract ad. */
function drawBillboard(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number, seed: number) {
  rect(c, x + 2, y + h, 2, 3, 0x3a3448);
  rect(c, x + w - 4, y + h, 2, 3, 0x3a3448);
  rect(c, x + 1, y + 2, w, h, 0x000000, 0.5);
  rect(c, x, y, w, h, 0x1b1624);
  rect(c, x + 1, y + 1, w - 2, h - 2, shade(color, 0.35));
  for (let i = 0; i < w - 4; i++) {
    const v = hashNoise(i, 1, seed);
    const bar = Math.floor(v * (h - 4));
    rect(c, x + 2 + i, y + h - 2 - bar, 1, bar, shade(color, 0.6 + v * 0.6));
  }
  ellipse(c, x + w * 0.3, y + h / 2, 3, 3, shade(color, 1.3));
  rect(c, x, y, w, 1, color);
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return h;
}
