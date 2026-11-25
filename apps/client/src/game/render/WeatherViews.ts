import Phaser from 'phaser';
import type { Weather } from '@neon-wilds/sim';
import { TEXTURES } from '../assets/manifest';
import { flash } from '../cameraFx';
import { Depth } from './depth';

const MAX_DROPS = 220;
const MAX_RIPPLES = 36;
const FOG_BANKS = 7;

/**
 * Screen-space rain streaks and storm lightning. Scroll-factor-0 objects are
 * still zoomed around the screen centre, so drops live in a normalised
 * [0,1] screen space and are mapped through the current zoom each frame.
 */
export class WeatherViews {
  private readonly drops: Phaser.GameObjects.Rectangle[] = [];
  private readonly pos: { u: number; v: number }[] = [];
  private nextFlash = 0;
  private readonly ripples: Array<{ shape: Phaser.GameObjects.Ellipse; age: number; life: number }> = [];
  private readonly fog: Phaser.GameObjects.Image[] = [];
  private fogAlpha = 0;
  /** 0..1: how wet the streets are. Rises in rain, dries slowly afterwards (drives neon reflections). */
  wetness = 0;

  constructor(private readonly scene: Phaser.Scene) {
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const shape = scene.add.ellipse(0, 0, 10, 5).setStrokeStyle(1, 0xbfd8ff, 0.35).setFillStyle().setDepth(Depth.ground + 2).setVisible(false);
      this.ripples.push({ shape, age: 1, life: 1 });
    }
    for (let i = 0; i < FOG_BANKS; i++) {
      this.fog.push(scene.add.image(0, 0, TEXTURES.glow).setTint(0x8a94b8).setScrollFactor(0).setDepth(Depth.glow + 1).setAlpha(0).setScale(9, 5));
    }
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
      flash(cam, 120, 200, 210, 255);
    }

    // Wet streets: rain soaks them quickly, they dry over a couple of minutes.
    const raining = weather === 'rain' || weather === 'storm' ? 1 : weather === 'drizzle' ? 0.5 : 0;
    this.wetness += raining > this.wetness ? (raining - this.wetness) * Math.min(1, deltaMs / 4000) : -Math.min(this.wetness, deltaMs / 120000);

    // Ripples where drops hit the ground, inside the camera view.
    const view = cam.worldView;
    const spawnRate = raining * (weather === 'storm' ? 0.06 : 0.035) * deltaMs;
    let toSpawn = spawnRate + (Math.random() < spawnRate % 1 ? 1 : 0);
    for (const r of this.ripples) {
      if (r.age < r.life) {
        r.age += deltaMs;
        const t = r.age / r.life;
        r.shape.setScale(0.4 + t * 1.6).setAlpha(1 - t);
        if (t >= 1) r.shape.setVisible(false);
      } else if (toSpawn >= 1) {
        toSpawn--;
        r.age = 0;
        r.life = 420 + Math.random() * 260;
        r.shape.setPosition(view.x + Math.random() * view.width, view.y + Math.random() * view.height).setVisible(true);
      }
    }

    // Fog banks drift across the screen in drizzle and storms.
    const fogTarget = weather === 'drizzle' ? 0.08 : weather === 'storm' ? 0.06 : 0;
    this.fogAlpha += (fogTarget - this.fogAlpha) * Math.min(1, deltaMs / 3000);
    this.fog.forEach((f, i) => {
      const u = (((now / 90000) * (0.6 + i * 0.12) + i * 0.37) % 1.4) - 0.2;
      f.setVisible(this.fogAlpha > 0.003)
        .setAlpha(this.fogAlpha * (0.7 + (i % 3) * 0.15))
        .setPosition(w / 2 + (u - 0.5) * (w / z), h / 2 + ((((i * 0.29) % 1) - 0.5) * h) / z);
    });
  }
}
