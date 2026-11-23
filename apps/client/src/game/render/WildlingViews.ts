import Phaser from 'phaser';
import { TILE_SIZE, type WildlingEntity } from '@neon-wilds/sim';
import { TEXTURES } from '../assets/manifest';
import { Depth } from './depth';

interface View {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  marker: Phaser.GameObjects.Text;
  animTime: number;
}

/** Pooled sprites for roaming Wildlings, keyed by entity id. */
export class WildlingViews {
  private readonly views = new Map<string, View>();
  private readonly pool: View[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textResolution: () => number,
  ) {}

  sync(list: readonly WildlingEntity[], alpha: number, deltaSeconds: number, now: number): void {
    const alive = new Set<string>();
    for (const w of list) {
      alive.add(w.id);
      let v = this.views.get(w.id);
      if (!v) {
        v = this.acquire();
        v.sprite.setTexture(TEXTURES.creature(w.speciesId, 'small'), 0);
        this.views.set(w.id, v);
      }
      const x = (w.prevX + (w.x - w.prevX) * alpha) * TILE_SIZE;
      const y = (w.prevY + (w.y - w.prevY) * alpha) * TILE_SIZE;
      v.sprite.setPosition(Math.round(x), Math.round(y - 4)).setFlipX(w.facingLeft);
      v.shadow.setPosition(x, y + 3);
      const asleep = w.mode === 'sleep';
      v.sprite.setTint(asleep ? 0x9a9ad0 : 0xffffff);
      if (w.speed > 0.2) v.animTime += deltaSeconds * (w.speed * 2.5);
      else v.animTime += deltaSeconds * 1.2;
      v.sprite.setFrame(Math.floor(v.animTime) % 2);
      const mark = asleep ? 'z' : w.mode === 'charge' ? '!' : w.questTag ? '▼' : '';
      v.marker
        .setText(mark)
        .setColor(w.mode === 'charge' ? '#ff4f5e' : w.questTag ? '#ff3fa4' : '#c7c7ff')
        .setPosition(Math.round(x), Math.round(y - 14 + Math.sin(now / 200) * (asleep ? 1 : 1.5)))
        .setVisible(mark !== '');
    }
    for (const [id, v] of this.views) {
      if (alive.has(id)) continue;
      this.release(v);
      this.views.delete(id);
    }
  }

  private acquire(): View {
    const v = this.pool.pop();
    if (v) {
      v.sprite.setVisible(true);
      v.shadow.setVisible(true);
      return v;
    }
    return {
      shadow: this.scene.add.image(0, 0, TEXTURES.shadow).setDepth(Depth.shadows).setScale(0.8),
      sprite: this.scene.add.sprite(0, 0, TEXTURES.creature('fizzlet', 'small'), 0).setDepth(Depth.actors),
      marker: this.scene.add
        .text(0, 0, '', { fontFamily: 'VT323, monospace', fontSize: '10px', resolution: this.textResolution(), stroke: '#000', strokeThickness: 2 })
        .setOrigin(0.5, 1)
        .setDepth(Depth.focus),
      animTime: Math.random() * 2,
    };
  }

  private release(v: View): void {
    v.sprite.setVisible(false);
    v.shadow.setVisible(false);
    v.marker.setVisible(false);
    this.pool.push(v);
  }
}
