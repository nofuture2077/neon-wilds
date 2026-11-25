import Phaser from 'phaser';
import { TEXTURES } from '../assets/manifest';
import { Depth } from './depth';
import type { StaticCuller } from './culler';
import { getSettings } from '../../settings';

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

export type LightCategory = 'neon' | 'lamp' | 'window' | 'other';

interface Light {
  category: LightCategory;
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
  private culler: StaticCuller | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.overlay = scene.add
      .rectangle(0, 0, 10, 10, 0x12061f, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(Depth.darkness);
    this.resize();
  }

  /** Cull lights with the city: only lights near the camera are updated and drawn. */
  useCuller(culler: StaticCuller): void {
    this.culler = culler;
    for (const l of this.lights) culler.add(l.image);
  }

  resize(): void {
    // The overlay ignores camera scroll but not zoom; oversize it to cover any zoom level.
    const { width, height } = this.scene.scale;
    this.overlay.setPosition(-width, -height).setSize(width * 3, height * 3);
  }

  /** Adds a glow; the returned image can be hidden to switch the light off. */
  add(x: number, y: number, color: number, scale: number, strength: number, dayStrength = 0, flicker = 0, category: LightCategory = 'other'): Phaser.GameObjects.Image {
    const image = this.scene.add
      .image(x, y, TEXTURES.glow)
      .setTint(color)
      .setScale(scale)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Depth.glow);
    this.lights.push({ category, image, strength, dayStrength, flicker, phase: (x * 13.7 + y * 7.3) % 100 });
    this.culler?.add(image);
    return image;
  }

  /** `gloom` darkens for weather; during a blackout the grid (neon, lamps, most windows) goes dark. */
  update(darkness: number, timeMs: number, gloom = 0, blackout = false, wetness = 0): void {
    // On wet streets, lights stretch into vertical reflections.
    const stretch = 1 + wetness * 0.55;
    this.overlay.setAlpha(Math.min(0.75, darkness * 0.42 + gloom + (blackout ? 0.18 : 0)));
    const t = timeMs / 1000;
    for (const l of this.lights) {
      if (this.culler?.isCulled(l.image)) continue;
      if (blackout && (l.category === 'neon' || l.category === 'lamp' || (l.category === 'window' && l.phase % 3 > 0.6))) {
        l.image.setAlpha(0);
        continue;
      }
      let a = l.dayStrength + (l.strength - l.dayStrength) * darkness;
      if (l.flicker > 0 && !getSettings().reduceFlashing) {
        // Occasional stutter, like a failing neon transformer.
        const s = Math.sin(t * 2.1 + l.phase) * Math.sin(t * 5.3 + l.phase * 2);
        if (s > 1 - l.flicker) a *= 0.25;
      }
      l.image.setAlpha(a);
      if (l.category !== 'window') {
        // The reflection runs down the wet street below the light.
        l.image.scaleY = l.image.scaleX * stretch;
        l.image.setOrigin(0.5, 0.5 - wetness * 0.12);
      }
    }
  }
}
