import { DT, TICK_RATE } from '../constants';
import { SPECIES, getSpecies } from '../content/wildlings';
import type { HabitatTile, TimeOfDay } from '../creatures/model';
import type { Rng } from '../core/rng';
import type { TilePos } from '../core/vec';
import { moveAndCollide } from '../physics/collision';
import type { ActorState } from '../state';
import type { DistrictLayout } from './district';
import type { Pathfinder } from './pathfinding';
import { Tile, type TileKind } from './tiles';

export const WILDLING_HALF_EXTENT = 0.25;
const TARGET_POPULATION = 14;
const SPAWN_MIN_DIST = 13;
const SPAWN_MAX_DIST = 32;
const DESPAWN_DIST = 45;

export type WildlingMode = 'idle' | 'wander' | 'flee' | 'approach' | 'charge' | 'sleep' | 'chase' | 'follow';

/** A Wildling roaming the overworld (not yet caught). */
export interface WildlingEntity extends ActorState {
  speciesId: string;
  level: number;
  mode: WildlingMode;
  timer: number;
  path: TilePos[];
  pathIndex: number;
  stuckTime: number;
  leaderId: string | null;
  questTag: string | null;
  spawnTick: number;
  facingLeft: boolean;
  /** Ignores the player until this tick (after a battle or flee). */
  calmUntilTick: number;
}

export interface WildlingContext {
  layout: DistrictLayout;
  rng: Rng;
  pathfinder: Pathfinder;
  tick: number;
  timeOfDay: TimeOfDay;
  player: { x: number; y: number; running: boolean };
  /** Whether the player has a Wildling able to battle (aggressive species only charge then). */
  playerCanBattle: boolean;
  pathBudget: { remaining: number };
  nextId(): string;
  /** Rain brings out Tide Wildlings; blackouts send Spark Wildlings into a frenzy. */
  weather?: 'clear' | 'drizzle' | 'rain' | 'storm';
  blackout?: boolean;
}

const HABITAT_TILES: Record<HabitatTile, TileKind[]> = {
  sidewalk: [Tile.Sidewalk],
  alley: [Tile.Alley],
  grass: [Tile.Grass],
  plaza: [Tile.Plaza],
  road: [Tile.Road, Tile.RoadLineH, Tile.RoadLineV],
};

export function timeOfDay(minutes: number): TimeOfDay {
  const h = minutes / 60;
  if (h >= 6 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'dusk';
  return 'night';
}

/** Maintain the population: despawn distant Wildlings, spawn new ones out of view. Call every ~0.5 s. */
export function manageSpawns(list: WildlingEntity[], ctx: WildlingContext): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const w = list[i]!;
    if (w.questTag) continue;
    const d = Math.hypot(w.x - ctx.player.x, w.y - ctx.player.y);
    if (d > DESPAWN_DIST && ctx.tick - w.spawnTick > TICK_RATE * 20) list.splice(i, 1);
  }
  const wild = list.filter((w) => !w.questTag).length;
  if (wild >= TARGET_POPULATION) return;

  const options = Object.values(SPECIES).flatMap((s) =>
    s.habitats
      .filter((h) => h.district === ctx.layout.id && h.time.includes(ctx.timeOfDay))
      .map((h) => {
        const wet = ctx.weather === 'rain' || ctx.weather === 'storm';
        const boost = (wet && s.types.includes('tide') ? 3 : 1) * (ctx.blackout && s.types.includes('spark') ? 3 : 1);
        return { species: s, habitat: h, weight: h.weight * boost };
      }),
  );
  if (options.length === 0) return;
  const total = options.reduce((a, o) => a + o.weight, 0);
  let r = ctx.rng.next() * total;
  const pick = options.find((o) => (r -= o.weight) <= 0) ?? options[options.length - 1]!;
  const kinds = pick.habitat.tiles.flatMap((t) => HABITAT_TILES[t]);
  const tile = findSpawnTile(ctx, kinds, SPAWN_MIN_DIST, SPAWN_MAX_DIST);
  if (!tile) return;
  const level = ctx.rng.int(pick.habitat.levels[0], pick.habitat.levels[1]);
  const leader = spawnWildling(list, ctx, pick.species.id, level, tile, null);
  for (let i = 1; i < pick.species.flock; i++) {
    const near = { tx: tile.tx + ctx.rng.int(-1, 1), ty: tile.ty + ctx.rng.int(-1, 1) };
    if (!ctx.layout.map.isSolid(near.tx, near.ty)) spawnWildling(list, ctx, pick.species.id, level, near, leader.id);
  }
}

export function spawnWildling(
  list: WildlingEntity[],
  ctx: Pick<WildlingContext, 'rng' | 'tick' | 'nextId'>,
  speciesId: string,
  level: number,
  tile: TilePos,
  leaderId: string | null,
  questTag: string | null = null,
): WildlingEntity {
  const x = tile.tx + 0.5;
  const y = tile.ty + 0.5;
  const w: WildlingEntity = {
    id: ctx.nextId(),
    speciesId,
    level,
    x,
    y,
    prevX: x,
    prevY: y,
    heading: 0,
    speed: 0,
    mode: 'idle',
    timer: ctx.rng.range(0.5, 2),
    path: [],
    pathIndex: 0,
    stuckTime: 0,
    leaderId,
    questTag,
    spawnTick: ctx.tick,
    facingLeft: ctx.rng.chance(0.5),
    calmUntilTick: 0,
  };
  list.push(w);
  return w;
}

export function findSpawnTile(
  ctx: Pick<WildlingContext, 'layout' | 'rng' | 'player'>,
  kinds: TileKind[],
  minDist: number,
  maxDist: number,
): TilePos | null {
  const { map } = ctx.layout;
  for (let attempt = 0; attempt < 24; attempt++) {
    const angle = ctx.rng.range(0, Math.PI * 2);
    const dist = ctx.rng.range(minDist, maxDist);
    const tx = Math.floor(ctx.player.x + Math.cos(angle) * dist);
    const ty = Math.floor(ctx.player.y + Math.sin(angle) * dist);
    if (!map.inBounds(tx, ty) || map.isSolid(tx, ty)) continue;
    if (kinds.includes(map.get(tx, ty))) return { tx, ty };
  }
  return null;
}

/** Per-tick behaviour for every roaming Wildling. */
export function updateWildlings(list: WildlingEntity[], ctx: WildlingContext): void {
  for (const w of list) updateOne(w, list, ctx);
}

function updateOne(w: WildlingEntity, all: WildlingEntity[], ctx: WildlingContext): void {
  w.prevX = w.x;
  w.prevY = w.y;
  w.speed = 0;
  const species = getSpecies(w.speciesId);
  const p = ctx.player;
  const d = Math.hypot(w.x - p.x, w.y - p.y);
  const calm = ctx.tick < w.calmUntilTick;
  const runSpeed = species.speed * 1.35;

  // --- Reactions that interrupt whatever the Wildling is doing (behaviour-tree "selector" order).
  if (w.mode === 'sleep') {
    w.timer -= DT;
    if ((p.running && d < 3) || d < 1.2) startFlee(w, p.x, p.y, ctx);
    else if (w.timer <= 0) setIdle(w, ctx, 1);
    return;
  }

  if (!calm) {
    const personality = w.questTag ? 'shy' : species.personality;
    const fleeRadius = w.questTag ? 7 : p.running ? 7 : 3.5;
    if ((personality === 'shy' || personality === 'social') && d < fleeRadius && w.mode !== 'flee') {
      startFlee(w, p.x, p.y, ctx);
      if (personality === 'social') alertFlock(w, all, ctx);
    } else if ((personality === 'territorial' || personality === 'aggressive') && ctx.playerCanBattle && d < 4.5 && w.mode !== 'charge') {
      w.mode = 'charge';
      w.timer = 4;
    } else if ((personality === 'curious' || personality === 'loyal') && w.mode !== 'flee') {
      if (p.running && d < 3) startFlee(w, p.x, p.y, ctx);
      else if (!p.running && d < 6 && d > 1.8 && w.mode !== 'approach') {
        w.mode = 'approach';
        w.timer = 5;
      }
    }
  }

  // Predator/prey relations between Wildlings.
  if (w.mode === 'idle' || w.mode === 'wander') {
    const prey = species.prey.length ? all.find((o) => species.prey.includes(o.speciesId) && Math.hypot(o.x - w.x, o.y - w.y) < 5) : undefined;
    if (prey && ctx.rng.chance(0.02)) {
      w.mode = 'chase';
      w.timer = 3;
      w.leaderId = prey.id;
    }
    const predator = all.find((o) => getSpecies(o.speciesId).prey.includes(w.speciesId) && Math.hypot(o.x - w.x, o.y - w.y) < 4);
    if (predator) startFlee(w, predator.x, predator.y, ctx);
  }

  switch (w.mode) {
    case 'idle':
      w.timer -= DT;
      if (w.leaderId && species.flock > 1) {
        w.mode = 'follow';
        break;
      }
      if (w.timer <= 0 && ctx.pathBudget.remaining > 0) {
        ctx.pathBudget.remaining--;
        if (species.personality === 'sleepy' && ctx.rng.chance(0.4)) {
          w.mode = 'sleep';
          w.timer = ctx.rng.range(10, 20);
        } else if (!startWander(w, ctx)) setIdle(w, ctx, 1);
      }
      break;
    case 'wander':
    case 'flee':
      followPath(w, w.mode === 'flee' ? runSpeed : species.speed * 0.6, ctx);
      break;
    case 'approach':
      w.timer -= DT;
      if (d <= 1.6 || w.timer <= 0) setIdle(w, ctx, 2);
      else steer(w, p.x, p.y, species.speed * 0.7, ctx);
      break;
    case 'charge':
      w.timer -= DT;
      if (d > 8 || w.timer <= 0 || calm) {
        w.calmUntilTick = ctx.tick + TICK_RATE * 4;
        setIdle(w, ctx, 1);
      } else steer(w, p.x, p.y, runSpeed, ctx);
      break;
    case 'chase': {
      w.timer -= DT;
      const target = all.find((o) => o.id === w.leaderId);
      if (!target || w.timer <= 0) {
        w.leaderId = null;
        setIdle(w, ctx, 2);
      } else steer(w, target.x, target.y, runSpeed, ctx);
      break;
    }
    case 'follow': {
      const leader = all.find((o) => o.id === w.leaderId);
      if (!leader) {
        w.leaderId = null;
        setIdle(w, ctx, 1);
      } else if (leader.mode === 'flee') {
        startFlee(w, p.x, p.y, ctx);
      } else if (Math.hypot(leader.x - w.x, leader.y - w.y) > 1.4) {
        steer(w, leader.x, leader.y, species.speed, ctx);
      }
      break;
    }
  }
}

function alertFlock(w: WildlingEntity, all: WildlingEntity[], ctx: WildlingContext): void {
  for (const o of all) {
    if (o !== w && (o.leaderId === w.id || o.id === w.leaderId) && o.mode !== 'flee') startFlee(o, ctx.player.x, ctx.player.y, ctx);
  }
}

function setIdle(w: WildlingEntity, ctx: WildlingContext, seconds: number): void {
  w.mode = 'idle';
  w.timer = seconds * ctx.rng.range(0.6, 1.4);
  w.path = [];
  w.pathIndex = 0;
  w.stuckTime = 0;
}

function startWander(w: WildlingEntity, ctx: WildlingContext): boolean {
  const from = { tx: Math.floor(w.x), ty: Math.floor(w.y) };
  for (let i = 0; i < 6; i++) {
    const tx = from.tx + ctx.rng.int(-6, 6);
    const ty = from.ty + ctx.rng.int(-6, 6);
    if (ctx.layout.map.isSolid(tx, ty)) continue;
    const path = ctx.pathfinder.find(from, { tx, ty }, { maxExpanded: 600 });
    if (path && path.length > 0) {
      w.mode = 'wander';
      w.path = path;
      w.pathIndex = 0;
      return true;
    }
  }
  return false;
}

function startFlee(w: WildlingEntity, fromX: number, fromY: number, ctx: WildlingContext): void {
  const from = { tx: Math.floor(w.x), ty: Math.floor(w.y) };
  let best: TilePos | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 10; i++) {
    const tx = from.tx + ctx.rng.int(-9, 9);
    const ty = from.ty + ctx.rng.int(-9, 9);
    if (ctx.layout.map.isSolid(tx, ty)) continue;
    const score = Math.hypot(tx + 0.5 - fromX, ty + 0.5 - fromY);
    if (score > bestScore) {
      bestScore = score;
      best = { tx, ty };
    }
  }
  const path = best ? ctx.pathfinder.find(from, best, { maxExpanded: 900 }) : null;
  if (path && path.length > 0) {
    w.mode = 'flee';
    w.path = path;
    w.pathIndex = 0;
    w.stuckTime = 0;
  } else {
    setIdle(w, ctx, 0.5);
  }
}

function steer(w: WildlingEntity, tx: number, ty: number, speed: number, ctx: WildlingContext): void {
  const dx = tx - w.x;
  const dy = ty - w.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-3) return;
  const step = Math.min(speed * DT, dist);
  move(w, (dx / dist) * step, (dy / dist) * step, ctx);
}

function followPath(w: WildlingEntity, speed: number, ctx: WildlingContext): void {
  const node = w.path[w.pathIndex];
  if (!node) {
    setIdle(w, ctx, w.mode === 'flee' ? 1.5 : 2.5);
    return;
  }
  const dx = node.tx + 0.5 - w.x;
  const dy = node.ty + 0.5 - w.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.06) {
    w.pathIndex++;
    return;
  }
  const step = Math.min(speed * DT, dist);
  const moved = move(w, (dx / dist) * step, (dy / dist) * step, ctx);
  w.stuckTime = moved < step * 0.3 ? w.stuckTime + DT : 0;
  if (w.stuckTime > 1) setIdle(w, ctx, 0.5);
}

function move(w: WildlingEntity, dx: number, dy: number, ctx: WildlingContext): number {
  const res = moveAndCollide(ctx.layout.map, w.x, w.y, WILDLING_HALF_EXTENT, dx, dy);
  const moved = Math.hypot(res.x - w.x, res.y - w.y);
  w.x = res.x;
  w.y = res.y;
  w.speed = moved / DT;
  if (Math.abs(dx) > 1e-4) w.facingLeft = dx < 0;
  w.heading = Math.atan2(dy, dx);
  return moved;
}
