import type { Appearance } from '@neon-wilds/sim';
import { createCanvas, ellipse, rect, shade, type PixelCanvas } from './canvas';
import { PALETTE } from './palette';

export const CHARACTER_FRAME = 16;
export const CHARACTER_FRAMES = 4;

/**
 * Top-down (GTA-style) character, drawn facing north; the renderer rotates it.
 * Frames: 0 neutral, 1 left stride, 2 neutral, 3 right stride.
 */
export function drawCharacterFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  look: Appearance,
  frame: number,
): void {
  const stride = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const shoe = 0x1a1a1a;

  // Feet poke out ahead of / behind the body while walking.
  if (stride !== 0) {
    rect(ctx, ox + 5, oy + 8 - stride * 5, 2, 3, look.bottom);
    rect(ctx, ox + 5, oy + (stride > 0 ? 3 : 12), 2, 1, shoe);
    rect(ctx, ox + 9, oy + 8 + stride * 5 - 2, 2, 3, look.bottom);
    rect(ctx, ox + 9, oy + (stride > 0 ? 12 : 3), 2, 1, shoe);
  }

  // Outline + shoulders.
  ellipse(ctx, ox + 8, oy + 8.5, 5.8, 3.6, PALETTE.outline);
  ellipse(ctx, ox + 8, oy + 8.5, 5, 2.9, look.top);
  rect(ctx, ox + 4, oy + 10, 8, 1, shade(look.top, 0.7));

  // Arms swing opposite to the legs.
  const armL = -stride * 2;
  const armR = stride * 2;
  rect(ctx, ox + 2, oy + 7 + armL, 2, 3, shade(look.top, 0.85));
  rect(ctx, ox + 2, oy + 6 + armL, 2, 1, look.skin);
  rect(ctx, ox + 12, oy + 7 + armR, 2, 3, shade(look.top, 0.85));
  rect(ctx, ox + 12, oy + 6 + armR, 2, 1, look.skin);

  // Head: skin face toward the front, hair behind.
  ellipse(ctx, ox + 8, oy + 7.5, 3.2, 3.2, PALETTE.outline);
  ellipse(ctx, ox + 8, oy + 7.5, 2.6, 2.6, look.skin);
  ellipse(ctx, ox + 8, oy + 8.4, 2.6, 2.2, look.hair);
  rect(ctx, ox + 7, oy + 9, 2, 1, shade(look.hair, 1.3));
}

export function buildCharacterSheet(look: Appearance): PixelCanvas {
  const pc = createCanvas(CHARACTER_FRAME * CHARACTER_FRAMES, CHARACTER_FRAME);
  for (let f = 0; f < CHARACTER_FRAMES; f++) drawCharacterFrame(pc.ctx, f * CHARACTER_FRAME, 0, look, f);
  return pc;
}

export function appearanceKey(look: Appearance): string {
  return `char-${look.skin.toString(16)}-${look.hair.toString(16)}-${look.top.toString(16)}-${look.bottom.toString(16)}`;
}
