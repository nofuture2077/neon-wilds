import Phaser from 'phaser';
import type { EmoteKind } from '@neon-wilds/sim';
import { Depth } from './depth';

const LIFETIME_MS = 2800;
const BORDER: Record<EmoteKind, string> = {
  none: '#d0d0e0',
  chatter: '#d0d0e0',
  alarm: '#ffd23f',
  anger: '#ff4f5e',
};

interface Bark {
  text: Phaser.GameObjects.Text;
  bornAt: number;
}

/** Floating speech snippets above characters. One bark per actor at a time. */
export class BarkLayer {
  private readonly barks = new Map<string, Bark>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly resolution: () => number,
  ) {}

  show(actorId: string, line: string, emote: EmoteKind): void {
    this.barks.get(actorId)?.text.destroy();
    const prefix = emote === 'anger' ? '! ' : emote === 'alarm' ? '!? ' : '';
    const text = this.scene.add
      .text(0, 0, prefix + line, {
        fontFamily: 'VT323, monospace',
        fontSize: '9px',
        color: emote === 'anger' ? '#ffd0d4' : '#f2f2ff',
        backgroundColor: '#0b0b18e6',
        padding: { x: 3, y: 1 },
        resolution: this.resolution(),
        stroke: BORDER[emote],
        strokeThickness: 0,
      })
      .setOrigin(0.5, 1)
      .setDepth(Depth.barks);
    this.barks.set(actorId, { text, bornAt: this.scene.time.now });
  }

  update(positionOf: (actorId: string) => { x: number; y: number } | null): void {
    const now = this.scene.time.now;
    for (const [id, bark] of this.barks) {
      const age = now - bark.bornAt;
      const pos = positionOf(id);
      if (age > LIFETIME_MS || !pos) {
        bark.text.destroy();
        this.barks.delete(id);
        continue;
      }
      bark.text.setPosition(Math.round(pos.x), Math.round(pos.y - 10 - Math.min(age / 200, 2)));
      bark.text.setAlpha(age > LIFETIME_MS - 400 ? (LIFETIME_MS - age) / 400 : 1);
    }
  }

  clear(): void {
    for (const b of this.barks.values()) b.text.destroy();
    this.barks.clear();
  }
}
