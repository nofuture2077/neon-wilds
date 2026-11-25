import Phaser from 'phaser';
import { playBattleSfx } from '../../audio/eventSfx';
import { flash, shake } from '../cameraFx';
import { type BattleLog, type ElementType, type StatusKind } from '@neon-wilds/sim';
import { useGameStore } from '../../state/gameStore';
import { TEXTURES } from '../assets/manifest';
import { onBattleFx } from '../battleFx';
import { playElementFx, playStatusFx } from '../elementFx';

const STATUS_TINT: Record<StatusKind, number> = {
  shorted: 0xffd23f,
  scorched: 0xff6b35,
  soaked: 0x4fa3ff,
  rooted: 0x6fd36f,
  poisoned: 0xb36bff,
  rusted: 0xc0563a,
  spooked: 0x7a5cff,
  dazed: 0xd0d0d0,
};

/**
 * The battle stage: backdrop, two Wildlings and all battle animations.
 * Menus and text live in React (BattleUi); this scene only listens to the
 * battle FX stream, so it never decides anything about the battle itself.
 */
export class BattleScene extends Phaser.Scene {
  private mine!: Phaser.GameObjects.Sprite;
  private foe!: Phaser.GameObjects.Sprite;
  private snare: Phaser.GameObjects.Image | null = null;
  private mineSpecies = '';
  private foeSpecies = '';
  private readonly scaleFactor = 3;
  private unsubscribe: (() => void) | null = null;
  private backdrop!: Phaser.GameObjects.Graphics;
  private glows: Phaser.GameObjects.Image[] = [];
  private foeBreath: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('battle');
  }

  create(): void {
    this.backdrop = this.add.graphics();
    const b = useGameStore.getState().battle;
    this.drawBackdrop(b?.view.terrain ?? 'street', b?.view.night ?? true);
    this.foe = this.add.sprite(0, 0, TEXTURES.creature('fizzlet', 'large'), 0).setScale(this.scaleFactor).setFlipX(true);
    this.mine = this.add.sprite(0, 0, TEXTURES.creature('glitchling', 'large'), 0).setScale(this.scaleFactor);
    this.layout();
    this.syncSpecies(true);
    this.foe.setAlpha(0).setX(this.foe.x + 200);
    this.tweens.add({ targets: this.foe, alpha: 1, x: this.foePos().x, duration: 450, ease: 'Cubic.out' });
    this.mine.setAlpha(0).setX(this.mine.x - 200);
    this.tweens.add({ targets: this.mine, alpha: 1, x: this.minePos().x, duration: 450, ease: 'Cubic.out' });

    // Idle breathing on the battle stage (scaleY only, so attack tweens on x/y stay free).
    const breathe = (s: Phaser.GameObjects.Sprite, delay: number) =>
      this.tweens.add({ targets: s, scaleY: this.scaleFactor * 1.035, duration: 900, delay: 500 + delay, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    breathe(this.mine, 0);
    this.foeBreath = breathe(this.foe, 400);
    this.unsubscribe = onBattleFx((e) => this.fx(e));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });
  }

  override update(time: number): void {
    this.syncSpecies(false);
    const idle = Math.floor(time / 400) % 2;
    if (this.mine.alpha > 0) this.mine.setFrame(idle);
    if (this.foe.alpha > 0) this.foe.setFrame(1 - idle);
    for (const [i, g] of this.glows.entries()) g.setAlpha(0.35 + 0.15 * Math.sin(time / 700 + i));
  }

  private onResize(): void {
    const b = useGameStore.getState().battle;
    this.drawBackdrop(b?.view.terrain ?? 'street', b?.view.night ?? true);
    this.layout();
  }

  private foePos() {
    const { width, height } = this.scale;
    return { x: width * 0.68, y: height * 0.34 };
  }

  private minePos() {
    const { width, height } = this.scale;
    return { x: width * 0.3, y: height * 0.56 };
  }

  private layout(): void {
    const f = this.foePos();
    const m = this.minePos();
    this.foe.setPosition(f.x, f.y);
    this.mine.setPosition(m.x, m.y);
  }

  private syncSpecies(force: boolean): void {
    const b = useGameStore.getState().battle;
    if (!b) return;
    if (force || b.player.speciesId !== this.mineSpecies) {
      this.mineSpecies = b.player.speciesId;
      this.mine.setTexture(TEXTURES.creature(this.mineSpecies, 'large'), 0);
    }
    if (force || b.enemy.speciesId !== this.foeSpecies) {
      this.foeSpecies = b.enemy.speciesId;
      this.foe.setTexture(TEXTURES.creature(this.foeSpecies, 'large'), 0);
    }
  }

  private drawBackdrop(terrain: string, night: boolean): void {
    const g = this.backdrop;
    const { width: w, height: h } = this.scale;
    g.clear();
    for (const glow of this.glows) glow.destroy();
    this.glows = [];
    const top = night ? 0x0d0718 : 0x2a2140;
    const bottom = night ? 0x2a0f3d : 0x4a3a66;
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(0, 0, w, h * 0.55);

    // Skyline silhouettes with lit windows and neon signs.
    let x = 0;
    let i = 0;
    while (x < w) {
      const bw = 60 + ((i * 37) % 90);
      const bh = h * (0.18 + ((i * 53) % 25) / 100);
      g.fillStyle(0x120c1e, 1).fillRect(x, h * 0.55 - bh, bw - 6, bh);
      for (let wy = h * 0.55 - bh + 10; wy < h * 0.55 - 12; wy += 16) {
        for (let wx = x + 8; wx < x + bw - 18; wx += 14) {
          if ((wx * 7 + wy * 3 + i) % 5 < 2) g.fillStyle([0xff8fd0, 0x7ff6ff, 0xffc46b][(wx + wy) % 3]!, 0.7).fillRect(wx, wy, 6, 8);
        }
      }
      if (i % 3 === 1) {
        const color = [0xff3fa4, 0x00e5ff, 0xffb347][i % 3]!;
        g.fillStyle(color, 1).fillRect(x + 10, h * 0.55 - bh + 14, Math.min(50, bw - 30), 6);
        this.glows.push(this.add.image(x + 35, h * 0.55 - bh + 17, TEXTURES.glow).setTint(color).setScale(2.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(-1));
      }
      x += bw;
      i++;
    }

    const ground = terrain === 'park' ? 0x1f3d2c : terrain === 'alley' ? 0x231e2b : 0x1f1b2a;
    g.fillStyle(ground, 1).fillRect(0, h * 0.55, w, h * 0.45);
    if (terrain === 'street') {
      g.fillStyle(0xb8902c, 0.6);
      for (let lx = 20; lx < w; lx += 90) g.fillRect(lx, h * 0.72, 50, 6);
      g.fillStyle(0xff3fa4, 0.5).fillRect(0, h * 0.55, w, 3);
    } else if (terrain === 'park') {
      g.fillStyle(0x2a5238, 1);
      for (let k = 0; k < 60; k++) g.fillRect((k * 97) % w, h * 0.56 + ((k * 61) % (h * 0.4)), 4, 6);
    } else {
      g.fillStyle(0x2b2350, 0.8).fillEllipse(w * 0.5, h * 0.8, 220, 40);
    }

    const f = this.foePos();
    const m = this.minePos();
    g.fillStyle(0x000000, 0.35).fillEllipse(f.x, f.y + 70, 220, 46);
    g.fillStyle(0x000000, 0.35).fillEllipse(m.x, m.y + 70, 240, 50);
    g.lineStyle(2, 0x00e5ff, 0.4).strokeEllipse(m.x, m.y + 70, 240, 50);
    g.lineStyle(2, 0xff3fa4, 0.4).strokeEllipse(f.x, f.y + 70, 220, 46);
    g.setDepth(-2);
  }

  private spriteOf(side: 'player' | 'enemy'): Phaser.GameObjects.Sprite {
    return side === 'player' ? this.mine : this.foe;
  }

  private home(side: 'player' | 'enemy') {
    return side === 'player' ? this.minePos() : this.foePos();
  }

  private fx(e: BattleLog): void {
    playBattleSfx(e, useGameStore.getState().battle?.view.enemy.speciesId ?? null);
    switch (e.t) {
      case 'use': {
        const s = this.spriteOf(e.side);
        const dir = e.side === 'player' ? 1 : -1;
        this.tweens.add({ targets: s, x: this.home(e.side).x + dir * 40, duration: 110, yoyo: true, ease: 'Quad.out' });
        const target = this.spriteOf(e.side === 'player' ? 'enemy' : 'player');
        playElementFx(this, e.type as ElementType, { x: s.x, y: s.y }, { x: target.x, y: target.y });
        break;
      }
      case 'damage': {
        const s = this.spriteOf(e.side);
        s.setTintFill(0xffffff);
        this.time.delayedCall(90, () => s.clearTint());
        this.tweens.add({ targets: s, x: this.home(e.side).x + 8, duration: 50, yoyo: true, repeat: 3 });
        if (e.crit || e.effectiveness > 1) shake(this.cameras.main, 160, 0.01);
        break;
      }
      case 'miss': {
        const s = this.spriteOf(e.side);
        this.tweens.add({ targets: s, x: this.home(e.side).x + (e.side === 'player' ? -30 : 30), duration: 120, yoyo: true });
        break;
      }
      case 'faint': {
        const s = this.spriteOf(e.side);
        this.tweens.add({ targets: s, y: this.home(e.side).y + 60, alpha: 0, duration: 450, ease: 'Quad.in' });
        break;
      }
      case 'switch': {
        const s = this.spriteOf(e.side);
        const p = this.home(e.side);
        this.time.delayedCall(10, () => {
          this.syncSpecies(true);
          s.setPosition(p.x, p.y).setAlpha(0).setScale(this.scaleFactor * 0.3);
          this.tweens.add({ targets: s, alpha: 1, scale: this.scaleFactor, duration: 300, ease: 'Back.out' });
        });
        break;
      }
      case 'status':
        if (e.status) {
          const s = this.spriteOf(e.side);
          this.pulse(s, STATUS_TINT[e.status]);
          playStatusFx(this, e.status, { x: s.x, y: s.y });
        }
        break;
      case 'heal':
        this.pulse(this.spriteOf(e.side), 0x4fffb0);
        break;
      case 'throw': {
        this.foeBreath?.pause();
        const from = this.minePos();
        const to = this.foePos();
        this.snare?.destroy();
        // Animations capture their own snare: the log may advance (and destroy it) before they finish.
        const snare = this.add.image(from.x, from.y, TEXTURES.snare).setScale(3);
        this.snare = snare;
        this.tweens.add({ targets: snare, x: to.x, duration: 420, ease: 'Linear' });
        this.tweens.add({ targets: snare, y: to.y - 90, duration: 210, yoyo: true, ease: 'Quad.out' });
        this.tweens.add({ targets: snare, angle: 720, duration: 420 });
        this.time.delayedCall(420, () => {
          if (!snare.active || this.snare !== snare) return;
          this.pulse(this.foe, 0xff3fa4);
          this.tweens.add({ targets: this.foe, scale: 0, alpha: 0, duration: 220 });
          this.tweens.add({ targets: snare, y: to.y + 40, duration: 260, ease: 'Bounce.out' });
        });
        break;
      }
      case 'shake': {
        const snare = this.snare;
        if (snare?.active) {
          this.tweens.add({ targets: snare, angle: { from: -25, to: 25 }, duration: 140, yoyo: true, delay: 200, onStart: () => undefined });
        }
        break;
      }
      case 'capture':
        if (e.success) {
          this.burst(this.snare?.x ?? this.foe.x, this.snare?.y ?? this.foe.y, 0xfff275);
        } else {
          if (this.snare) {
            this.tweens.killTweensOf(this.snare);
            this.snare.destroy();
          }
          this.snare = null;
          this.foeBreath?.resume();
          this.tweens.getTweensOf(this.foe).filter((t) => t !== this.foeBreath).forEach((t) => t.remove());
          this.foe.setScale(this.scaleFactor).setAlpha(1).setPosition(this.foePos().x, this.foePos().y);
          this.burst(this.foe.x, this.foe.y, 0xff3fa4);
        }
        break;
      case 'evolve': {
        flash(this.cameras.main, 500, 255, 255, 255);
        this.time.delayedCall(250, () => this.syncSpecies(true));
        break;
      }
      case 'levelup':
        this.burst(this.mine.x, this.mine.y - 40, 0xfff275);
        break;
      default:
        break;
    }
  }

  private pulse(s: Phaser.GameObjects.Sprite, color: number): void {
    s.setTint(color);
    this.time.delayedCall(260, () => s.clearTint());
  }

  private burst(x: number, y: number, color: number): void {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const dot = this.add.rectangle(x, y, 8, 8, color).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * 70,
        y: y + Math.sin(a) * 50,
        alpha: 0,
        duration: 380,
        ease: 'Quad.out',
        onComplete: () => dot.destroy(),
      });
    }
  }
}
