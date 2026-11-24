import type Phaser from 'phaser';
import { getSettings } from '../settings';

/** Camera shake that honours the "screen shake" setting. */
export function shake(cam: Phaser.Cameras.Scene2D.Camera, duration: number, intensity: number): void {
  if (getSettings().screenShake) cam.shake(duration, intensity);
}

/** Full-screen flash that honours "reduce flashing" (a gentle fade instead). */
export function flash(cam: Phaser.Cameras.Scene2D.Camera, duration: number, r: number, g: number, b: number): void {
  if (getSettings().reduceFlashing) cam.fadeIn(Math.min(duration, 200), Math.round(r * 0.2), Math.round(g * 0.2), Math.round(b * 0.2));
  else cam.flash(duration, r, g, b);
}
