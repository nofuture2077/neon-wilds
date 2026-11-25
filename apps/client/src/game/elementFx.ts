import Phaser from 'phaser';
import { ELEMENT_COLORS, type ElementType, type StatusKind } from '@neon-wilds/sim';
import { getSettings } from '../settings';

type Pt = { x: number; y: number };

/**
 * Per-element battle effects, drawn with plain shapes and tweens: lightning for Spark,
 * flames for Blaze, a water arc and splash for Tide, swirling leaves for Bloom, bubbles
 * for Toxic, metal shards for Alloy, a shadow slash for Shade, falling rocks for Rubble.
 * Everything cleans itself up; nothing here affects the battle.
 */
export function playElementFx(scene: Phaser.Scene, type: ElementType, from: Pt, to: Pt): void {
  const color = ELEMENT_COLORS[type] ?? 0xffffff;
  switch (type) {
    case 'spark':
      bolt(scene, from, to, color);
      break;
    case 'blaze':
      for (let i = 0; i < 14; i++) rise(scene, to, [0xff6b35, 0xffd23f, 0xff3f3f][i % 3]!, i * 18, 10 + (i % 4) * 3, 60 + (i % 5) * 12);
      break;
    case 'tide':
      arc(scene, from, to, 0x4fa3ff, () => ring(scene, to, 0x9fd3ff));
      break;
    case 'bloom':
      for (let i = 0; i < 10; i++) leaf(scene, to, i);
      break;
    case 'toxic':
      for (let i = 0; i < 12; i++) bubble(scene, to, i);
      break;
    case 'alloy':
      for (let i = 0; i < 10; i++) shard(scene, to, i);
      ring(scene, to, 0xe8ecf4);
      break;
    case 'shade':
      slash(scene, to);
      for (let i = 0; i < 8; i++) rise(scene, to, 0x2a1d48, i * 25, 18, 40);
      break;
    case 'rubble':
      for (let i = 0; i < 6; i++) rock(scene, to, i);
      break;
    default:
      ring(scene, to, color);
  }
}

/** A small looping marker over a Wildling suffering a status condition. */
export function playStatusFx(scene: Phaser.Scene, status: StatusKind, at: Pt): void {
  const colors: Record<StatusKind, number> = {
    shorted: 0xffd23f,
    scorched: 0xff6b35,
    soaked: 0x4fa3ff,
    rooted: 0x6fd36f,
    poisoned: 0xb36bff,
    rusted: 0xc0563a,
    spooked: 0x7a5cff,
    dazed: 0xe0e0e0,
  };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const dot = scene.add.circle(at.x + Math.cos(a) * 30, at.y - 70, 5, colors[status]).setDepth(10);
    scene.tweens.add({
      targets: dot,
      x: at.x + Math.cos(a + Math.PI) * 30,
      y: at.y - 76,
      alpha: 0,
      duration: 700,
      delay: i * 80,
      ease: 'Sine.inOut',
      onComplete: () => dot.destroy(),
    });
  }
}

function bolt(scene: Phaser.Scene, from: Pt, to: Pt, color: number): void {
  const g = scene.add.graphics().setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
  const draw = (seed: number) => {
    g.clear();
    g.lineStyle(5, color, 0.9);
    g.beginPath();
    g.moveTo(from.x, from.y - 20);
    const steps = 7;
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      const j = Math.sin(seed * 13.7 + k * 4.1) * 28;
      g.lineTo(from.x + (to.x - from.x) * t + j * 0.3, from.y - 20 + (to.y - from.y) * t + j);
    }
    g.lineTo(to.x, to.y);
    g.strokePath();
    g.lineStyle(2, 0xffffff, 1);
    g.strokePath();
  };
  draw(1);
  const flicker = getSettings().reduceFlashing ? 0 : 2;
  scene.time.addEvent({ delay: 60, repeat: flicker, callback: () => draw(Math.random() * 10) });
  scene.tweens.add({ targets: g, alpha: 0, delay: 200, duration: 200, onComplete: () => g.destroy() });
  ring(scene, to, color);
}

function rise(scene: Phaser.Scene, at: Pt, color: number, delay: number, size: number, height: number): void {
  const dx = Math.sin(delay * 0.37) * 34;
  const p = scene.add.circle(at.x + dx, at.y + 20, size, color, 0.9).setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: p, y: at.y + 20 - height, scale: 0.2, alpha: 0, delay, duration: 520, ease: 'Quad.out', onComplete: () => p.destroy() });
}

function arc(scene: Phaser.Scene, from: Pt, to: Pt, color: number, done: () => void): void {
  for (let i = 0; i < 8; i++) {
    const d = scene.add.circle(from.x, from.y - 20, 7 - i * 0.5, color, 0.9).setDepth(10);
    const state = { t: 0 };
    scene.tweens.add({
      targets: state,
      t: 1,
      delay: i * 30,
      duration: 360,
      onUpdate: () => {
        d.setPosition(from.x + (to.x - from.x) * state.t, from.y - 20 + (to.y - from.y) * state.t - Math.sin(state.t * Math.PI) * 90);
      },
      onComplete: () => {
        d.destroy();
        if (i === 0) done();
      },
    });
  }
}

function ring(scene: Phaser.Scene, at: Pt, color: number): void {
  const r = scene.add.circle(at.x, at.y, 12).setStrokeStyle(4, color, 0.9).setDepth(10);
  scene.tweens.add({ targets: r, scale: 5, alpha: 0, duration: 420, ease: 'Quad.out', onComplete: () => r.destroy() });
}

function leaf(scene: Phaser.Scene, at: Pt, i: number): void {
  const a = (i / 10) * Math.PI * 2;
  const l = scene.add.rectangle(at.x + Math.cos(a) * 70, at.y + Math.sin(a) * 45, 10, 5, i % 2 ? 0x6fd36f : 0x3d6b34).setDepth(10);
  const state = { t: 0 };
  scene.tweens.add({
    targets: state,
    t: 1,
    duration: 600,
    delay: i * 20,
    onUpdate: () => {
      const r = 70 * (1 - state.t);
      const ang = a + state.t * 4;
      l.setPosition(at.x + Math.cos(ang) * r, at.y + Math.sin(ang) * r * 0.65).setRotation(ang * 2);
    },
    onComplete: () => l.destroy(),
  });
}

function bubble(scene: Phaser.Scene, at: Pt, i: number): void {
  const b = scene.add.circle(at.x + ((i * 23) % 70) - 35, at.y + 30, 4 + (i % 3) * 2).setStrokeStyle(2, 0xb36bff, 0.9).setDepth(10);
  scene.tweens.add({ targets: b, y: at.y - 50 - (i % 4) * 12, alpha: 0, scale: 1.6, delay: i * 35, duration: 600, ease: 'Sine.out', onComplete: () => b.destroy() });
}

function shard(scene: Phaser.Scene, at: Pt, i: number): void {
  const a = (i / 10) * Math.PI * 2 + 0.3;
  const s = scene.add.rectangle(at.x, at.y, 14, 3, i % 2 ? 0xe8ecf4 : 0xa8b0c0).setRotation(a).setDepth(10);
  scene.tweens.add({ targets: s, x: at.x + Math.cos(a) * 80, y: at.y + Math.sin(a) * 60, alpha: 0, duration: 320, ease: 'Quad.out', onComplete: () => s.destroy() });
}

function slash(scene: Phaser.Scene, at: Pt): void {
  const g = scene.add.graphics().setDepth(10);
  g.lineStyle(8, 0x7a5cff, 0.9);
  g.lineBetween(at.x - 50, at.y - 50, at.x + 50, at.y + 40);
  g.lineStyle(3, 0x0c0a12, 1);
  g.lineBetween(at.x - 50, at.y - 50, at.x + 50, at.y + 40);
  g.setScale(0.2, 1);
  scene.tweens.add({ targets: g, scaleX: 1, duration: 120, ease: 'Quad.out' });
  scene.tweens.add({ targets: g, alpha: 0, delay: 220, duration: 200, onComplete: () => g.destroy() });
}

function rock(scene: Phaser.Scene, at: Pt, i: number): void {
  const x = at.x - 45 + i * 18;
  const r = scene.add.rectangle(x, at.y - 160, 12 + (i % 3) * 4, 10 + (i % 2) * 4, i % 2 ? 0xb08a5a : 0x8a6a44).setDepth(10);
  scene.tweens.add({
    targets: r,
    y: at.y + 10 + (i % 3) * 6,
    angle: 90 + i * 40,
    delay: i * 50,
    duration: 280,
    ease: 'Quad.in',
    onComplete: () => scene.tweens.add({ targets: r, alpha: 0, duration: 200, onComplete: () => r.destroy() }),
  });
}
