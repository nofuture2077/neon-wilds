import Phaser from 'phaser';
import { TILE_SIZE, type ActorState } from '@neon-wilds/sim';
import { CHARACTER_FRAMES } from '../assets/characters';
import { TEXTURES } from '../assets/manifest';
import { Depth } from './depth';

const STRIDE_FRAMES_PER_TILE = 3.2;

/** Visual for one simulated character: drop shadow + rotating walk-cycle sprite. */
export class ActorView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private distance = 0;

  constructor(scene: Phaser.Scene, textureKey: string) {
    this.shadow = scene.add.image(0, 0, TEXTURES.shadow).setDepth(Depth.shadows);
    this.sprite = scene.add.sprite(0, 0, textureKey, 0).setDepth(Depth.actors);
  }

  /** `alpha` interpolates between the previous and current simulation step. */
  sync(actor: ActorState, alpha: number, deltaSeconds: number): void {
    const x = (actor.prevX + (actor.x - actor.prevX) * alpha) * TILE_SIZE;
    const y = (actor.prevY + (actor.y - actor.prevY) * alpha) * TILE_SIZE;
    this.sprite.setPosition(x, y);
    this.sprite.setRotation(actor.heading + Math.PI / 2);
    this.shadow.setPosition(x + 1.5, y + 2.5);

    if (actor.speed > 0.2) {
      this.distance += actor.speed * deltaSeconds;
      this.sprite.setFrame(Math.floor(this.distance * STRIDE_FRAMES_PER_TILE) % CHARACTER_FRAMES);
    } else {
      this.distance = 0;
      this.sprite.setFrame(0);
    }
  }

  setVisible(visible: boolean): void {
    this.sprite.setVisible(visible);
    this.shadow.setVisible(visible);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
