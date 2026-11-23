import Phaser from 'phaser';
import type { Weather } from '@neon-wilds/sim';
import { Depth } from './depth';

const MAX_DROPS = 220;

/**
 * Screen-space rain streaks and storm lightning. Scroll-factor-0 objects are
 * still zoomed around the screen centre, so drops live in a normalised
 * [0,1] screen space and are mapped through the current zoom each frame.
 */
export class WeatherViews {
  private readonly drops: Phaser.GameObjects.Rectangle[] = [];
  private readonly pos: { u: number; v: number }[] = [];
  private nextFlash = 0;

  constructor(private readonly scene: Phaser.Scene) {
    for (let i = 0; i < MAX_DROPS; i++) {
      this.drops.push(scene.add.rectangle(0, 0, 1, 9, 0xa8c8ff, 0.35).setScrollFactor(0).setDepth(Depth.glow + 2).setAngle(12).setVisible(false));
      this.pos.push({ u: (i * 0.6180339) % 1, v: (i * 0.4142135) % 1 });
    }
  }

  update(weather: Weather, deltaMs: number, now: number): void {
    const cam = this.scene.cameras.main;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const z = cam.zoom;
    const count = weather === 'storm' ? MAX_DROPS : weather === 'rain' ? 150 : weather === 'drizzle' ? 50 : 0;
    const speed = weather === 'storm' ? 1.6 : 1.1;
    for (let i = 0; i < MAX_DROPS; i++) {
      const d = this.drops[i]!;
      if (i >= count) {
        d.setVisible(false);
        continue;
      }
      const p = this.pos[i]!;
      p.v += (deltaMs * 0.0011 * speed) * (0.8 + (i % 5) * 0.08);
      p.u += deltaMs * 0.00022 * speed;
      if (p.v > 1) p.v -= 1;
      if (p.u > 1) p.u -= 1;
      // Map screen fraction → pre-zoom coordinates around the centre.
      d.setVisible(true)
        .setScale(1 / z)
        .setPosition(w / 2 + (p.u - 0.5) * (w / z), h / 2 + (p.v - 0.5) * (h / z));
    }
    if (weather === 'storm' && now > this.nextFlash) {
      this.nextFlash = now + 5000 + Math.random() * 9000;
      cam.flash(120, 200, 210, 255);
    }
  }
}
