import Phaser from 'phaser';
import { TILE_SIZE, blockOf, type DistrictLayout } from '@neon-wilds/sim';
import { addCanvasTexture } from '../assets/manifest';
import { createCanvas, ellipse, rect } from '../assets/canvas';
import { Depth } from './depth';

const T = TILE_SIZE;
const POSTER = 'decal-halcyon-poster';
const HALO = 'decal-saints-halo';

interface Decal {
  blockId: string;
  poster: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
}

/**
 * State dressing (WORLD_GEN.md L7): faction control becomes visible on the
 * facades — Halcyon's smiling posters, or the Saints' sprayed silver halos.
 */
export class TerritoryViews {
  private readonly decals: Decal[] = [];

  constructor(scene: Phaser.Scene, layout: DistrictLayout) {
    if (!scene.textures.exists(POSTER)) {
      const p = createCanvas(7, 9);
      rect(p.ctx, 0, 0, 7, 9, 0x0b0b12);
      rect(p.ctx, 1, 1, 5, 7, 0xf0f6ff);
      ellipse(p.ctx, 3.5, 4, 1.6, 1.6, 0x00e5ff);
      rect(p.ctx, 2, 6, 3, 1, 0x5a6a80);
      addCanvasTexture(scene, POSTER, p);
      const h = createCanvas(9, 6);
      ellipse(h.ctx, 4.5, 3, 4.2, 2.4, 0xd7dde8);
      ellipse(h.ctx, 4.5, 3, 2.8, 1.2, 0x000000, 0);
      h.ctx.clearRect(2, 2, 5, 2);
      addCanvasTexture(scene, HALO, h);
    }
    let i = 0;
    for (const b of layout.buildings) {
      if (b.door.facing !== 'south' || (i++ % 2 !== 0 && b.neon === null)) continue;
      const block = blockOf(layout, b.x + b.w / 2, b.y + b.h / 2);
      if (!block) continue;
      const x = (b.x + 0.6 + ((b.w - 1.2) * ((b.x * 7 + b.y * 3) % 10)) / 10) * T;
      const y = (b.y + b.h) * T - 9;
      this.decals.push({
        blockId: block.id,
        poster: scene.add.image(x, y, POSTER).setDepth(Depth.buildings + 1).setVisible(false),
        halo: scene.add.image(x, y - 2, HALO).setDepth(Depth.buildings + 1).setVisible(false),
        glow: scene.add.image(x, y, 'fx-glow').setTint(0x00e5ff).setScale(0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(Depth.glow).setVisible(false),
      });
    }
  }

  update(controllers: Record<string, string | null>, darkness: number): void {
    for (const d of this.decals) {
      const c = controllers[d.blockId] ?? null;
      d.poster.setVisible(c === 'halcyon');
      d.glow.setVisible(c === 'halcyon').setAlpha(0.2 + darkness * 0.4);
      d.halo.setVisible(c === 'saints' || c === null).setAlpha(c === null ? 0.5 : 0.9);
    }
  }
}
