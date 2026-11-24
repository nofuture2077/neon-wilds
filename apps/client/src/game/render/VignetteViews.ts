import Phaser from 'phaser';
import { TILE_SIZE, type DistrictLayout, vignetteActive, vignetteDef } from '@neon-wilds/sim';
import { vignetteKey } from '../assets/vignetteProps';
import { Depth } from './depth';
import type { Lighting } from './lighting';

const T = TILE_SIZE;
const LIGHTS: Record<string, { color: number; scale: number; flicker: number }> = {
  'fire-barrel': { color: 0xff8a3a, scale: 0.9, flicker: 0.3 },
  candles: { color: 0xffc46b, scale: 0.6, flicker: 0.2 },
  stall: { color: 0xffd890, scale: 0.7, flicker: 0 },
  cart: { color: 0xffb347, scale: 0.55, flicker: 0 },
  speaker: { color: 0x4fffb0, scale: 0.35, flicker: 0 },
};

/** Street scenes: their props and lights appear only during the scene's hours. */
export class VignetteViews {
  private readonly scenes: Array<{ def: string; objects: Phaser.GameObjects.Image[] }> = [];
  private lastHour = -1;

  constructor(scene: Phaser.Scene, layout: DistrictLayout, lighting: Lighting) {
    for (const v of layout.vignettes) {
      const def = vignetteDef(v.def);
      if (!def) continue;
      const objects: Phaser.GameObjects.Image[] = [];
      for (const p of def.props) {
        const x = (v.tx + p.dx + 0.5) * T;
        const y = (v.ty + p.dy + 0.5) * T;
        objects.push(scene.add.image(x, y, vignetteKey(p.kind)).setDepth(Depth.groundProps + 1));
        const light = LIGHTS[p.kind];
        if (light) objects.push(lighting.add(x, y, light.color, light.scale, 0.6, 0.05, light.flicker, 'other'));
      }
      this.scenes.push({ def: v.def, objects });
    }
  }

  update(hour: number): void {
    if (hour === this.lastHour) return;
    this.lastHour = hour;
    for (const s of this.scenes) {
      const def = vignetteDef(s.def);
      const on = !!def && vignetteActive(def, hour);
      for (const o of s.objects) o.setVisible(on);
    }
  }
}
