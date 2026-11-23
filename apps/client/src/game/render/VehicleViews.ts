import Phaser from 'phaser';
import { TILE_SIZE, type RoadNetwork, type VehicleState, vehicleClass } from '@neon-wilds/sim';
import { TEXTURES } from '../assets/manifest';
import { Depth } from './depth';

interface View {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image[];
  brake: Phaser.GameObjects.Image;
  fire: Phaser.GameObjects.Image;
  siren: Phaser.GameObjects.Image;
  key: string;
  smokeTimer: number;
}

const T = TILE_SIZE;

/** Pooled views for all simulated vehicles, with lights, smoke and fire. */
export class VehicleViews {
  private readonly views = new Map<string, View>();
  private readonly pool: View[] = [];
  private readonly puffs: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  positionOf(id: string): { x: number; y: number } | null {
    const v = this.views.get(id);
    return v ? { x: v.sprite.x, y: v.sprite.y } : null;
  }

  sync(list: readonly VehicleState[], alpha: number, deltaMs: number, darkness: number, now: number): void {
    const alive = new Set<string>();
    for (const v of list) {
      alive.add(v.id);
      let view = this.views.get(v.id);
      const key = TEXTURES.vehicle(v.classId, v.variant);
      if (!view) {
        view = this.acquire(key);
        this.views.set(v.id, view);
      }
      if (view.key !== key) {
        view.sprite.setTexture(key);
        view.shadow.setTexture(key);
        view.key = key;
      }
      const x = (v.prevX + (v.x - v.prevX) * alpha) * T;
      const y = (v.prevY + (v.y - v.prevY) * alpha) * T;
      const rot = v.heading + Math.PI / 2;
      view.sprite.setPosition(x, y).setRotation(rot);
      view.shadow.setPosition(x + 2, y + 3).setRotation(rot);
      const wrecked = v.wreckedTick !== null;
      view.sprite.setTint(v.exploded ? 0x2a2622 : wrecked ? 0x6a5a50 : 0xffffff);

      const fx = Math.cos(v.heading);
      const fy = Math.sin(v.heading);
      const half = (vehicleClass(v).length / 2) * T;
      const occupied = v.driver !== 'none' && !wrecked;
      view.head.forEach((h, i) => {
        const side = (i === 0 ? -1 : 1) * 3;
        h.setPosition(x + fx * (half + 8) - fy * side, y + fy * (half + 8) + fx * side).setAlpha(occupied ? 0.15 + darkness * 0.45 : 0);
      });
      view.brake.setPosition(x - fx * half, y - fy * half).setAlpha(occupied && v.braking ? 0.7 : occupied ? darkness * 0.25 : 0);
      view.fire.setPosition(x, y).setVisible(wrecked && !v.exploded).setAlpha(0.6 + 0.4 * Math.sin(now / 60));
      const sirenOn = v.classId === 'cruiser' && v.driver === 'police';
      view.siren.setPosition(x, y).setVisible(sirenOn).setTint(Math.floor(now / 180) % 2 ? 0xff3b3b : 0x3b6bff);

      const damaged = v.hp / vehicleClass(v).hp < 0.35 && !v.exploded;
      view.smokeTimer -= deltaMs;
      if ((damaged || (wrecked && !v.exploded)) && view.smokeTimer <= 0) {
        view.smokeTimer = wrecked ? 70 : 160;
        this.puff(x + fx * half * 0.6, y + fy * half * 0.6, wrecked ? 0x2a2622 : 0x777788);
      }
    }
    for (const [id, view] of this.views) {
      if (alive.has(id)) continue;
      this.release(view);
      this.views.delete(id);
    }
  }

  private puff(x: number, y: number, tint: number): void {
    const p = this.puffs.pop() ?? this.scene.add.image(0, 0, TEXTURES.puff).setDepth(Depth.canopy);
    p.setPosition(x, y).setTint(tint).setAlpha(0.7).setScale(0.6).setVisible(true);
    this.scene.tweens.add({
      targets: p,
      y: y - 10,
      x: x + 4,
      scale: 1.6,
      alpha: 0,
      duration: 900,
      onComplete: () => {
        p.setVisible(false);
        this.puffs.push(p);
      },
    });
  }

  private acquire(key: string): View {
    const v = this.pool.pop();
    if (v) {
      for (const o of [v.sprite, v.shadow, v.brake, ...v.head]) o.setVisible(true);
      v.sprite.setTexture(key);
      v.shadow.setTexture(key);
      v.key = key;
      return v;
    }
    const glow = (tint: number, scale: number) =>
      this.scene.add.image(0, 0, TEXTURES.glow).setTint(tint).setScale(scale).setBlendMode(Phaser.BlendModes.ADD).setDepth(Depth.glow);
    return {
      shadow: this.scene.add.image(0, 0, key).setTint(0x000000).setAlpha(0.4).setDepth(Depth.shadows),
      sprite: this.scene.add.image(0, 0, key).setDepth(Depth.actors - 1),
      head: [glow(0xfff1d0, 0.45), glow(0xfff1d0, 0.45)],
      brake: glow(0xff2a2a, 0.3),
      fire: glow(0xff6b20, 0.9).setVisible(false),
      siren: glow(0xff3b3b, 0.8).setVisible(false),
      key,
      smokeTimer: 0,
    };
  }

  private release(v: View): void {
    for (const o of [v.sprite, v.shadow, v.brake, v.fire, v.siren, ...v.head]) o.setVisible(false);
    this.pool.push(v);
  }
}

/** Signal heads at every signalised intersection, one per approach. */
export class SignalViews {
  private readonly heads: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; node: number; dir: 'N' | 'E' | 'S' | 'W' }[] = [];

  constructor(scene: Phaser.Scene, private readonly roads: RoadNetwork) {
    for (const n of roads.intersections) {
      if (!n.signal) continue;
      const spots: Array<['N' | 'E' | 'S' | 'W', number, number]> = [
        ['S', n.x0 - 0.3, n.y0 - 0.3],
        ['N', n.x1 + 1.3, n.y1 + 1.3],
        ['E', n.x0 - 0.3, n.y1 + 1.3],
        ['W', n.x1 + 1.3, n.y0 - 0.3],
      ];
      for (const [dir, x, y] of spots) {
        if (!n.exits[dir === 'S' ? 'N' : dir === 'N' ? 'S' : dir === 'E' ? 'W' : 'E']) continue; // no approach from that side
        const img = scene.add.image(x * T, y * T, TEXTURES.signal).setDepth(Depth.canopy);
        const glow = scene.add.image(x * T, y * T, TEXTURES.glow).setScale(0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(Depth.glow);
        this.heads.push({ img, glow, node: n.id, dir });
      }
    }
  }

  update(tick: number): void {
    for (const h of this.heads) {
      const node = this.roads.intersections[h.node]!;
      const state = this.roads.signalState(node, h.dir, tick);
      const color = state === 'green' ? 0x4fffb0 : state === 'amber' ? 0xffb347 : 0xff3b3b;
      h.img.setTint(color);
      h.glow.setTint(color);
    }
  }
}
