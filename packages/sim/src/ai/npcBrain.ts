import {
  ALARM_RADIUS,
  DT,
  GRUDGE_TICKS,
  NPC_HALF_EXTENT,
  NPC_RUN_SPEED,
  TICK_RATE,
  TURN_RATE,
} from '../constants';
import type { NpcArchetype } from '../content/types';
import type { EmoteKind, EventQueue } from '../core/events';
import type { Rng } from '../core/rng';
import { turnToward } from '../core/vec';
import { moveAndCollide } from '../physics/collision';
import type { DistrictLayout } from '../world/district';
import type { Pathfinder } from '../world/pathfinding';
import type { NpcState, PlayerState } from '../state';
import { lineOfSight, remember } from './memory';
import { type RoutineHooks, tickRoutine } from './routine';

/** Everything an NPC may read or affect. Brains never touch the Simulation object directly. */
export interface NpcContext {
  layout: DistrictLayout;
  rng: Rng;
  events: EventQueue;
  pathfinder: Pathfinder;
  tick: number;
  player: PlayerState;
  archetype(id: string): NpcArchetype;
  /** Remaining A* searches this tick. */
  pathBudget: { remaining: number };
  /** Seconds simulated by this update (DT, or a multiple of it for far-away NPCs). */
  dt: number;
  /** Absolute in-game minute (day * 1440 + minutes). */
  now: number;
  /** In-game minutes covered by this update. */
  minuteDelta: number;
  hooks: RoutineHooks;
}

export function updateNpc(npc: NpcState, ctx: NpcContext): void {
  npc.prevX = npc.x;
  npc.prevY = npc.y;
  npc.speed = 0;
  if (!npc.present) return;
  if (npc.indoors) {
    tickRoutine(npc, ctx);
    return;
  }

  switch (npc.mode) {
    case 'stationary':
      if (Math.hypot(ctx.player.x - npc.x, ctx.player.y - npc.y) < 5) faceToward(npc, ctx.player.x, ctx.player.y);
      return;
    case 'talking':
      if (ctx.player.conversationWith !== npc.id) {
        setIdle(npc, 1);
      } else {
        faceToward(npc, ctx.player.x, ctx.player.y);
      }
      return;
    case 'confronting':
      faceToward(npc, ctx.player.x, ctx.player.y);
      npc.timer -= ctx.dt;
      if (npc.timer <= 0) setIdle(npc, 0.5);
      return;
    case 'idle':
      if (npc.agent) {
        tickRoutine(npc, ctx);
        return;
      }
      npc.timer -= ctx.dt;
      if (npc.timer <= 0 && ctx.pathBudget.remaining > 0) {
        ctx.pathBudget.remaining--;
        if (!startWander(npc, ctx)) setIdle(npc, 1 + ctx.rng.next());
      }
      return;
    case 'walking':
      followPath(npc, npc.walkSpeed, ctx);
      if (npc.agent) tickRoutine(npc, ctx);
      return;
    case 'fleeing':
      followPath(npc, NPC_RUN_SPEED, ctx);
      return;
  }
}

/** Start walking to a tile (uses this tick's path budget). */
export function walkTo(npc: NpcState, tx: number, ty: number, ctx: NpcContext): boolean | 'busy' {
  if (npc.pathRetryTick !== undefined && ctx.tick < npc.pathRetryTick) return false;
  if (ctx.pathBudget.remaining <= 0) return 'busy';
  ctx.pathBudget.remaining--;
  const path = ctx.pathfinder.find(walkableNear(ctx, Math.floor(npc.x), Math.floor(npc.y)), { tx, ty }, { maxExpanded: 4000, weight: 1.5 });
  if (!path) {
    npc.pathRetryTick = ctx.tick + TICK_RATE * 8;
    return false;
  }
  delete npc.pathRetryTick;
  npc.mode = 'walking';
  npc.path = path;
  npc.pathIndex = 0;
  npc.stuckTime = 0;
  return true;
}

/** The NPC's tile, or a walkable neighbour if it has been shoved onto the road. */
function walkableNear(ctx: NpcContext, tx: number, ty: number): { tx: number; ty: number } {
  const map = ctx.layout.map;
  if (map.isPedestrianWalkable(tx, ty)) return { tx, ty };
  for (let r = 1; r <= 3; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && map.isPedestrianWalkable(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
    }
  }
  return { tx, ty };
}

function setIdle(npc: NpcState, seconds: number): void {
  npc.mode = npc.stationary ? 'stationary' : 'idle';
  npc.timer = seconds;
  npc.path = [];
  npc.pathIndex = 0;
  npc.stuckTime = 0;
}

function faceToward(npc: NpcState, x: number, y: number): void {
  const dx = x - npc.x;
  const dy = y - npc.y;
  if (dx * dx + dy * dy > 1e-6) npc.heading = turnToward(npc.heading, Math.atan2(dy, dx), TURN_RATE * DT);
}

function startWander(npc: NpcState, ctx: NpcContext): boolean {
  const { map } = ctx.layout;
  const from = { tx: Math.floor(npc.x), ty: Math.floor(npc.y) };
  for (let attempt = 0; attempt < 8; attempt++) {
    const tx = from.tx + ctx.rng.int(-20, 20);
    const ty = from.ty + ctx.rng.int(-20, 20);
    if (Math.abs(tx - from.tx) + Math.abs(ty - from.ty) < 5) continue;
    if (!map.isPedestrianWalkable(tx, ty)) continue;
    const path = ctx.pathfinder.find(from, { tx, ty }, { maxExpanded: 2500, weight: 1.3 });
    if (path && path.length > 0) {
      npc.mode = 'walking';
      npc.path = path;
      npc.pathIndex = 0;
      npc.stuckTime = 0;
      return true;
    }
  }
  return false;
}

/** Run to the reachable spot (among a few samples) farthest from the threat. */
export function startFlee(npc: NpcState, threatX: number, threatY: number, ctx: NpcContext): void {
  const { map } = ctx.layout;
  const from = { tx: Math.floor(npc.x), ty: Math.floor(npc.y) };
  let best: { tx: number; ty: number } | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 12; i++) {
    const tx = from.tx + ctx.rng.int(-12, 12);
    const ty = from.ty + ctx.rng.int(-12, 12);
    if (!map.isPedestrianWalkable(tx, ty)) continue;
    const score = Math.hypot(tx + 0.5 - threatX, ty + 0.5 - threatY);
    if (score > bestScore) {
      bestScore = score;
      best = { tx, ty };
    }
  }
  const path = best ? ctx.pathfinder.find(from, best, { maxExpanded: 2500, weight: 1.3 }) : null;
  if (path && path.length > 0) {
    npc.mode = 'fleeing';
    npc.path = path;
    npc.pathIndex = 0;
    npc.stuckTime = 0;
    ctx.events.push({ type: 'npc.fled', npcId: npc.id });
  } else {
    confront(npc, 2);
  }
}

function confront(npc: NpcState, seconds: number): void {
  npc.mode = 'confronting';
  npc.timer = seconds;
  npc.path = [];
  npc.pathIndex = 0;
}

function followPath(npc: NpcState, speed: number, ctx: NpcContext): void {
  const node = npc.path[npc.pathIndex];
  if (!node) {
    setIdle(npc, npc.mode === 'fleeing' ? 2 + ctx.rng.next() * 2 : 1.5 + ctx.rng.next() * 3.5);
    return;
  }
  const tx = node.tx + 0.5;
  const ty = node.ty + 0.5;
  const dx = tx - npc.x;
  const dy = ty - npc.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.06) {
    npc.pathIndex++;
    return;
  }
  const step = Math.min(speed * ctx.dt, dist);
  const res = moveAndCollide(ctx.layout.map, npc.x, npc.y, NPC_HALF_EXTENT, (dx / dist) * step, (dy / dist) * step);
  const moved = Math.hypot(res.x - npc.x, res.y - npc.y);
  npc.x = res.x;
  npc.y = res.y;
  npc.speed = moved / ctx.dt;
  npc.heading = turnToward(npc.heading, Math.atan2(dy, dx), TURN_RATE * ctx.dt);
  npc.stuckTime = moved < step * 0.3 ? npc.stuckTime + ctx.dt : 0;
  if (npc.stuckTime > 1) setIdle(npc, 0.5 + ctx.rng.next());
}

function bark(npc: NpcState, lines: readonly string[], emote: EmoteKind, ctx: NpcContext): void {
  if (lines.length === 0) return;
  ctx.events.push({ type: 'bark', actorId: npc.id, text: ctx.rng.pick(lines), emote });
  npc.nextBarkTick = ctx.tick + TICK_RATE * 8;
}

/**
 * The player barged into `victim` while sprinting. The victim reacts according
 * to temperament, remembers it for a while, and bystanders react to the commotion.
 */
export function onShoved(victim: NpcState, others: readonly NpcState[], ctx: NpcContext): void {
  const archetype = ctx.archetype(victim.archetypeId);
  victim.shoveCooldownUntilTick = ctx.tick + TICK_RATE * 1.5;
  victim.grudgeUntilTick = ctx.tick + GRUDGE_TICKS;
  ctx.events.push({ type: 'npc.shoved', npcId: victim.id, byPlayer: true });
  remember(victim.memory, { kind: 'shoved', salience: 0.8, important: false, secondhand: false, at: ctx.now });

  switch (archetype.temperament) {
    case 'timid':
      bark(victim, archetype.barks.shoved, 'alarm', ctx);
      if (victim.stationary) confront(victim, 1.5);
      else startFlee(victim, ctx.player.x, ctx.player.y, ctx);
      break;
    case 'steady':
      bark(victim, archetype.barks.shoved, 'anger', ctx);
      confront(victim, 1.5);
      break;
    case 'tough':
      bark(victim, archetype.barks.shoved, 'anger', ctx);
      confront(victim, 3.5);
      break;
  }

  let barks = 0;
  for (const other of others) {
    if (other === victim || !other.present || other.indoors || other.mode === 'talking' || other.mode === 'fleeing') continue;
    if (Math.hypot(other.x - victim.x, other.y - victim.y) > ALARM_RADIUS) continue;
    if (!lineOfSight(ctx.layout.map, other.x, other.y, victim.x, victim.y)) continue;
    remember(other.memory, { kind: 'witnessed-assault', salience: 0.5, important: false, secondhand: false, at: ctx.now });
    const a = ctx.archetype(other.archetypeId);
    const speak = barks < 2 && ctx.rng.chance(0.6);
    if (a.temperament === 'timid' && !other.stationary && ctx.rng.chance(0.8)) {
      if (speak) {
        bark(other, a.barks.alarmed, 'alarm', ctx);
        barks++;
      }
      startFlee(other, ctx.player.x, ctx.player.y, ctx);
    } else {
      if (speak) {
        bark(other, a.barks.alarmed, a.temperament === 'tough' ? 'anger' : 'alarm', ctx);
        barks++;
      }
      confront(other, 1.2 + ctx.rng.next() * 1.5);
    }
  }
}

export function ambientBark(npc: NpcState, night: boolean, ctx: NpcContext): void {
  const a = ctx.archetype(npc.archetypeId);
  const lines = night && a.barks.night.length > 0 && ctx.rng.chance(0.6) ? a.barks.night : a.barks.ambient;
  bark(npc, lines, 'chatter', ctx);
  npc.nextBarkTick = ctx.tick + TICK_RATE * ctx.rng.int(25, 60);
}
