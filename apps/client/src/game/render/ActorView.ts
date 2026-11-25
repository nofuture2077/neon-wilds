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
  private angle: number | null = null;
  private idle = Math.random() * 10;

  constructor(scene: Phaser.Scene, textureKey: string) {
    this.shadow = scene.add.image(0, 0, TEXTURES.shadow).setDepth(Depth.shadows);
    this.sprite = scene.add.sprite(0, 0, textureKey, 0).setDepth(Depth.actors);
  }

  /** `alpha` interpolates between the previous and current simulation step. */
  sync(actor: ActorState, alpha: number, deltaSeconds: number): void {
    const x = (actor.prevX + (actor.x - actor.prevX) * alpha) * TILE_SIZE;
    const y = (actor.prevY + (actor.y - actor.prevY) * alpha) * TILE_SIZE;
    // Turn smoothly toward the heading instead of snapping (fast enough to stay responsive).
    const target = actor.heading + Math.PI / 2;
    if (this.angle === null || deltaSeconds === 0) this.angle = target;
    else this.angle += Phaser.Math.Angle.Wrap(target - this.angle) * Math.min(1, deltaSeconds * 18);
    this.sprite.setPosition(x, y).setRotation(this.angle);

    if (actor.speed > 0.2) {
      this.distance += actor.speed * deltaSeconds;
      const stride = this.distance * STRIDE_FRAMES_PER_TILE;
      this.sprite.setFrame(Math.floor(stride) % CHARACTER_FRAMES);
      // A small push on every footfall; bigger when running.
      const step = Math.abs(Math.sin(stride * Math.PI * 0.5)) * Math.min(0.08, actor.speed * 0.012);
      this.sprite.setScale(1 + step);
      this.shadow.setPosition(x + 1.5, y + 2.5).setScale(1 - step * 1.5);
    } else {
      this.distance = 0;
      this.sprite.setFrame(0);
      // Idle: slow breathing.
      this.idle += deltaSeconds;
      this.sprite.setScale(1 + Math.sin(this.idle * 2.2) * 0.015);
      this.shadow.setPosition(x + 1.5, y + 2.5).setScale(1);
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
