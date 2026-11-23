import Phaser from 'phaser';
import { generateProceduralAssets, queueFileAssets } from '../assets/manifest';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    queueFileAssets(this);
  }

  create(): void {
    generateProceduralAssets(this);
    this.scene.start('world', this.registry.get('session'));
  }
}
