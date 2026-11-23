import { type ActivityId, ROUTINES, blockAt } from '../content/schedules';
import type { NpcState } from '../state';
import { type BtHost, type BtNode, type BtStatus, act, cond, sel, seq, tickTree } from './bt';
import { RUMOUR_TEXT, gossip } from './memory';
import type { NpcContext } from './npcBrain';

/** Routine state of an autonomous NPC (AI.md §2.4–2.5). Plain data; saved with the NPC. */
export interface AgentState {
  homeId: string | null;
  workId: string | null;
  workSpot: { tx: number; ty: number } | null;
  /** 0 = satisfied, 1 = urgent. */
  needs: { hunger: number; fatigue: number; social: number };
  activity: ActivityId | null;
  activityStart: number;
  target: { tx: number; ty: number; buildingId: string | null; npcId: string | null } | null;
  /** Behaviour-tree running state for the current activity. */
  bt: Record<string, number>;
  /** Top utility scores from the last decision (for the debug overlay). */
  scores: [string, number][];
  nextDecision: number;
}

/** Hooks the routine needs from the NPC brain and the simulation. */
export interface RoutineHooks {
  /** Begin walking to a tile; false if no path (or out of path budget this tick). */
  walkTo(npc: NpcState, tx: number, ty: number): boolean | 'busy';
  isWalking(npc: NpcState): boolean;
  /** A random walkable sidewalk tile in a block the NPC's faction controls. */
  patrolTile(npc: NpcState): { tx: number; ty: number } | null;
  /** Random pedestrian tile near a point. */
  nearbyTile(x: number, y: number, radius: number): { tx: number; ty: number } | null;
  buildingEntrance(id: string): { tx: number; ty: number } | null;
  /** An eatery entrance close to the NPC. */
  foodPlace(npc: NpcState): { id: string; tx: number; ty: number } | null;
  /** Another NPC that would chat now. */
  findFriend(npc: NpcState): NpcState | null;
  npcById(id: string): NpcState | null;
  /** NPC leaves the simulation (crowd pedestrians entering buildings). */
  despawn(npc: NpcState): void;
}

export type RoutineContext = NpcContext;

const TREES: Record<ActivityId, BtNode> = {
  sleep: seq(act('goto'), act('enter'), act('wait', { minutes: 240, need: 'fatigue' }), act('exit')),
  eat: seq(act('goto'), act('enter'), act('wait', { minutes: 35, need: 'hunger' }), act('exit')),
  work: sel(
    seq(cond('worksIndoors'), act('goto'), act('enter'), act('wait', { minutes: 120 }), act('exit')),
    seq(act('goto'), act('stand', { minutes: 90, bark: 1 })),
  ),
  socialize: sel(seq(act('pickFriend'), act('goto'), act('chat', { minutes: 14 })), seq(act('goto'), act('stand', { minutes: 8 }))),
  listen: act('stand', { minutes: 14, face: 1 }),
  patrol: seq(act('goto'), act('stand', { minutes: 12 })),
  wander: seq(act('goto'), act('stand', { minutes: 4 })),
  commute: seq(act('goto'), act('enter'), act('vanish')),
};

const ROLE_BARKS = ['Skewers! Hot skewers!', 'Two for a coin!', 'Fresh off the grill!', 'Best noodles in the Slums!'];

export function newAgent(homeId: string | null, workId: string | null, workSpot: { tx: number; ty: number } | null, seed: number): AgentState {
  return {
    homeId,
    workId,
    workSpot,
    needs: { hunger: (seed % 7) / 10, fatigue: (seed % 5) / 10, social: (seed % 3) / 4 },
    activity: null,
    activityStart: 0,
    target: null,
    bt: {},
    scores: [],
    nextDecision: 0,
  };
}

/** Utility scores for the activities of the current schedule block. */
export function scoreActivities(npc: NpcState, agent: AgentState, hour: number, noise: () => number): [ActivityId, number][] {
  const routine = ROUTINES[npc.archetypeId] ?? ROUTINES.citizen!;
  const block = blockAt(routine, hour);
  if (!block) return [['wander', 1]];
  const n = agent.needs;
  const out: [ActivityId, number][] = [];
  for (const [id, base] of Object.entries(block.weights) as [ActivityId, number][]) {
    let s = base;
    if (id === 'sleep') s *= 0.15 + n.fatigue * 2;
    if (id === 'eat') s *= 0.1 + n.hunger * 2.2;
    if (id === 'socialize') s *= (0.3 + n.social * 1.6) * routine.sociability;
    if (id === agent.activity) s *= 1.3; // momentum: avoid dithering
    out.push([id, s * (0.9 + noise() * 0.2)]);
  }
  return out.sort((a, b) => b[1] - a[1]);
}

/** One routine tick while the NPC is free (not talking, fleeing or confronting). */
export function tickRoutine(npc: NpcState, ctx: RoutineContext): void {
  const agent = npc.agent;
  if (!agent) return;
  updateNeeds(npc, agent, ctx.minuteDelta);

  // Re-plan when idle, or every 20 in-game minutes if something clearly better is on the schedule.
  if (!agent.activity || ctx.now >= agent.nextDecision) {
    const hour = Math.floor((ctx.now % 1440) / 60);
    const scores = scoreActivities(npc, agent, hour, () => ctx.rng.next());
    agent.scores = scores.slice(0, 3).map(([a, s]) => [a, Math.round(s * 100) / 100]);
    agent.nextDecision = ctx.now + 20;
    const best = scores[0]?.[0] ?? 'wander';
    if (!agent.activity || (best !== agent.activity && agent.activity !== 'listen' && !npc.indoors)) startActivity(npc, agent, best, ctx);
  }
  if (!agent.activity) return;
  const status = tickTree(TREES[agent.activity], host, { npc, agent, ctx }, agent.bt);
  if (status !== 'running') {
    if (npc.indoors && agent.activity !== 'commute') exitBuilding(npc, ctx);
    agent.activity = null;
    agent.target = null;
    agent.bt = {};
  }
}

export function startActivity(npc: NpcState, agent: AgentState, activity: ActivityId, ctx: RoutineContext): void {
  if (npc.indoors) exitBuilding(npc, ctx);
  if (npc.mode === 'walking') {
    npc.mode = 'idle';
    npc.path = [];
    npc.pathIndex = 0;
  }
  agent.activity = activity;
  agent.activityStart = ctx.now;
  agent.bt = {};
  agent.target = chooseTarget(npc, agent, activity, ctx);
}

function chooseTarget(npc: NpcState, agent: AgentState, activity: ActivityId, ctx: RoutineContext): AgentState['target'] {
  const h = ctx.hooks;
  const at = (t: { tx: number; ty: number } | null, buildingId: string | null = null, npcId: string | null = null) =>
    t ? { tx: t.tx, ty: t.ty, buildingId, npcId } : null;
  switch (activity) {
    case 'sleep':
      return agent.homeId ? at(h.buildingEntrance(agent.homeId), agent.homeId) : at(h.nearbyTile(npc.x, npc.y, 10));
    case 'eat': {
      const f = h.foodPlace(npc);
      return f ? at(f, f.id) : null;
    }
    case 'work':
      if (agent.workSpot) return at(agent.workSpot);
      return agent.workId ? at(h.buildingEntrance(agent.workId), agent.workId) : at(h.nearbyTile(npc.x, npc.y, 8));
    case 'patrol':
      return at(h.patrolTile(npc) ?? h.nearbyTile(npc.x, npc.y, 14));
    case 'socialize':
      return at(h.nearbyTile(npc.x, npc.y, 10));
    case 'listen':
      return null;
    case 'wander':
      return at(h.nearbyTile(npc.x, npc.y, 16));
    case 'commute': {
      const target = agent.homeId ?? agent.workId;
      return target ? at(h.buildingEntrance(target), target) : at(h.nearbyTile(npc.x, npc.y, 20));
    }
  }
}

function updateNeeds(npc: NpcState, agent: AgentState, minutes: number): void {
  const n = agent.needs;
  n.hunger = Math.min(1, n.hunger + minutes / 600);
  n.fatigue = Math.min(1, n.fatigue + minutes / 960);
  n.social = Math.min(1, n.social + minutes / 480);
  if (npc.indoors && agent.activity === 'sleep') n.fatigue = Math.max(0, n.fatigue - minutes / 200);
  if (npc.indoors && agent.activity === 'eat') n.hunger = Math.max(0, n.hunger - minutes / 25);
  if (agent.activity === 'listen') n.social = Math.max(0, n.social - minutes / 15);
}

function exitBuilding(npc: NpcState, ctx: RoutineContext): void {
  const id = npc.indoors;
  npc.indoors = null;
  const e = id ? ctx.hooks.buildingEntrance(id) : null;
  if (e) {
    npc.x = npc.prevX = e.tx + 0.5;
    npc.y = npc.prevY = e.ty + 0.5;
  }
}

interface HostCtx {
  npc: NpcState;
  agent: AgentState;
  ctx: RoutineContext;
}

const host: BtHost<HostCtx> = {
  condition(name, _params, { agent }) {
    if (name === 'worksIndoors') return agent.workSpot === null && agent.workId !== null;
    return false;
  },
  action(name, params, { npc, agent, ctx }, memory, key): BtStatus {
    const h = ctx.hooks;
    switch (name) {
      case 'goto': {
        const t = agent.target;
        if (!t) return 'failure';
        if (t.npcId) {
          const other = h.npcById(t.npcId);
          if (!other || other.indoors) return 'failure';
          if (Math.hypot(other.x - npc.x, other.y - npc.y) < 1.7) return 'success';
          t.tx = Math.floor(other.x);
          t.ty = Math.floor(other.y);
        }
        if (Math.hypot(t.tx + 0.5 - npc.x, t.ty + 0.5 - npc.y) < 0.7) return 'success';
        if (h.isWalking(npc)) return 'running';
        const tries = (memory[key] ?? 0) + 1;
        memory[key] = tries;
        if (tries > 6) return 'failure';
        const res = h.walkTo(npc, t.tx, t.ty);
        return res === false ? 'failure' : 'running';
      }
      case 'enter': {
        const id = agent.target?.buildingId;
        if (!id) return 'success';
        npc.indoors = id;
        npc.path = [];
        return 'success';
      }
      case 'exit':
        if (npc.indoors) exitBuilding(npc, ctx);
        return 'success';
      case 'vanish':
        h.despawn(npc);
        return 'success';
      case 'wait': {
        const end = memory[key] ?? ctx.now + Number(params.minutes ?? 30) * (0.7 + ctx.rng.next() * 0.6);
        memory[key] = end;
        const need = params.need as keyof AgentState['needs'] | undefined;
        if (need && agent.needs[need] <= 0.02) return 'success';
        return ctx.now >= end ? 'success' : 'running';
      }
      case 'stand': {
        const end = memory[key] ?? ctx.now + Number(params.minutes ?? 10) * (0.7 + ctx.rng.next() * 0.6);
        memory[key] = end;
        if (params.bark && ctx.rng.chance(0.002)) ctx.events.push({ type: 'bark', actorId: npc.id, text: ctx.rng.pick(ROLE_BARKS), emote: 'chatter' });
        if (params.face && agent.target?.npcId) {
          const other = h.npcById(agent.target.npcId);
          if (other) npc.heading = Math.atan2(other.y - npc.y, other.x - npc.x);
        }
        return ctx.now >= end ? 'success' : 'running';
      }
      case 'pickFriend': {
        const friend = h.findFriend(npc);
        if (!friend) return 'failure';
        agent.target = { tx: Math.floor(friend.x), ty: Math.floor(friend.y), buildingId: null, npcId: friend.id };
        return 'success';
      }
      case 'chat': {
        const friendId = agent.target?.npcId;
        const friend = friendId ? h.npcById(friendId) : null;
        if (!friend || friend.indoors) return 'failure';
        if (memory[key] === undefined) {
          memory[key] = ctx.now + Number(params.minutes ?? 12);
          // The partner stops to listen; both trade what they know about the player.
          if (friend.agent && friend.mode !== 'talking' && friend.mode !== 'fleeing') {
            startActivity(friend, friend.agent, 'listen', ctx);
            friend.agent.target = { tx: Math.floor(npc.x), ty: Math.floor(npc.y), buildingId: null, npcId: npc.id };
          }
          const told = gossip(npc.memory, friend.memory, ctx.now);
          gossip(friend.memory, npc.memory, ctx.now);
          if (told) {
            ctx.events.push({ type: 'bark', actorId: npc.id, text: `Heard ${ctx.player.name}... ${RUMOUR_TEXT[told].replace(/^you /, '')}.`, emote: 'chatter' });
          } else if (ctx.rng.chance(0.3)) {
            ctx.events.push({ type: 'bark', actorId: npc.id, text: ctx.rng.pick(['You hear about the blackout?', 'Halcyon vans again.', 'Rain later, they say.', 'Long night.']), emote: 'chatter' });
          }
          agent.needs.social = Math.max(0, agent.needs.social - 0.6);
        }
        // Face each other.
        npc.heading = Math.atan2(friend.y - npc.y, friend.x - npc.x);
        return ctx.now >= memory[key]! ? 'success' : 'running';
      }
    }
    return 'failure';
  },
};
