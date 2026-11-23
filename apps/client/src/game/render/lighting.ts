import Phaser from 'phaser';
import { TEXTURES } from '../assets/manifest';
import { Depth } from './depth';

/**
 * Darkness (0 = full day, 1 = deepest night) for a time of day in minutes.
 * Night is never pitch black: the city is always lit by something.
 */
export function darknessAt(minutes: number): number {
  const h = minutes / 60;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  // Vesper never gets fully bright: smog and towers keep a violet haze even at noon.
  const DAY = 0.18;
  if (h >= 8 && h < 17) return DAY;
  if (h >= 17 && h < 21.5) return DAY + (1 - DAY) * smooth((h - 17) / 4.5);
  if (h >= 21.5 || h < 4.5) return 1;
  return 1 - (1 - DAY) * smooth((h - 4.5) / 3.5); // 4:30 – 8:00 dawn
}

interface Light {
  image: Phaser.GameObjects.Image;
  /** Alpha at full darkness. */
  strength: number;
  /** Visible even in daylight (neon signs). */
  dayStrength: number;
  flicker: number;
  phase: number;
}

/**
 * Cheap, renderer-agnostic lighting: a translucent night overlay with
 * additive glow sprites on top. Works with both WebGL and Canvas renderers.
 */
export class Lighting {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly lights: Light[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.overlay = scene.add
      .rectangle(0, 0, 10, 10, 0x12061f, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(Depth.darkness);
    this.resize();
  }

  resize(): void {
    // The overlay ignores camera scroll but not zoom; oversize it to cover any zoom level.
    const { width, height } = this.scene.scale;
    this.overlay.setPosition(-width, -height).setSize(width * 3, height * 3);
  }

  add(x: number, y: number, color: number, scale: number, strength: number, dayStrength = 0, flicker = 0): void {
    const image = this.scene.add
      .image(x, y, TEXTURES.glow)
      .setTint(color)
      .setScale(scale)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Depth.glow);
    this.lights.push({ image, strength, dayStrength, flicker, phase: (x * 13.7 + y * 7.3) % 100 });
  }

  update(darkness: number, timeMs: number): void {
    this.overlay.setAlpha(darkness * 0.42);
    const t = timeMs / 1000;
    for (const l of this.lights) {
      let a = l.dayStrength + (l.strength - l.dayStrength) * darkness;
      if (l.flicker > 0) {
        // Occasional stutter, like a failing neon transformer.
        const s = Math.sin(t * 2.1 + l.phase) * Math.sin(t * 5.3 + l.phase * 2);
        if (s > 1 - l.flicker) a *= 0.25;
      }
      l.image.setAlpha(a);
    }
  }
}
