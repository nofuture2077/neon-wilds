import type { EventQueue } from '../core/events';
import type { CityBlock, DistrictLayout } from '../world/district';
import { type TerritoryState, adjustInfluence } from './territory';

/**
 * Faction intelligence (AI.md §6): utility-scored goals, planned with GOAP
 * over symbolic facts, executed as multi-hour operations with crews in the
 * world. Deterministic: no randomness beyond ordered tie-breaking.
 */
export type Facts = Record<string, boolean>;

export interface GoapAction {
  id: string;
  cost: number;
  pre: Facts;
  eff: Facts;
  /** In-game hours the operation takes. */
  hours: number;
  /** Needs a target block. */
  targeted: boolean;
  /** Crew members deployed to the block (visible NPCs). */
  crew: number;
}

export interface Operation {
  action: string;
  blockId: string | null;
  hoursLeft: number;
  crew: string[];
  disrupted: boolean;
}

export interface FactionAgent {
  id: 'saints' | 'halcyon';
  cash: number;
  members: number;
  morale: number;
  goal: string | null;
  target: string | null;
  plan: string[];
  op: Operation | null;
  /** Hour of the last block lost (drives retaliation). */
  lostBlockAt: number;
  /** Short decision log for the debug overlay and journal. */
  log: string[];
}

export interface WorldConditions {
  blackout: boolean;
  recallDrive: boolean;
  procession: boolean;
  hour: number;
  /** Absolute hour counter. */
  absHour: number;
}

const ACTIONS: Record<'saints' | 'halcyon', GoapAction[]> = {
  halcyon: [
    { id: 'fundraise', cost: 2, pre: {}, eff: { hasCash: true }, hours: 2, targeted: false, crew: 0 },
    { id: 'scout', cost: 1, pre: {}, eff: { hasIntel: true }, hours: 1, targeted: true, crew: 1 },
    { id: 'hire', cost: 2, pre: { hasCash: true }, eff: { hasCrew: true }, hours: 1, targeted: false, crew: 0 },
    { id: 'outreach', cost: 3, pre: { hasCash: true, hasIntel: true }, eff: { targetGained: true }, hours: 3, targeted: true, crew: 2 },
    { id: 'raid', cost: 2, pre: { hasIntel: true, hasCrew: true, aggressive: true }, eff: { targetGained: true }, hours: 2, targeted: true, crew: 3 },
  ],
  saints: [
    { id: 'collect', cost: 2, pre: {}, eff: { hasCash: true }, hours: 2, targeted: false, crew: 0 },
    { id: 'recruit', cost: 2, pre: { hasCash: true }, eff: { hasCrew: true }, hours: 1, targeted: false, crew: 0 },
    { id: 'rally', cost: 2, pre: { hasCrew: true, hasCash: true }, eff: { targetDefended: true }, hours: 3, targeted: true, crew: 2 },
    { id: 'strip-posters', cost: 3, pre: {}, eff: { targetDefended: true }, hours: 2, targeted: true, crew: 1 },
    { id: 'soup-kitchen', cost: 1, pre: { hasCash: true }, eff: { moraleUp: true }, hours: 2, targeted: false, crew: 0 },
  ],
};

export function newFactionAgents(): FactionAgent[] {
  return [
    { id: 'halcyon', cash: 50, members: 2, morale: 0.7, goal: null, target: null, plan: [], op: null, lostBlockAt: -99, log: [] },
    { id: 'saints', cash: 20, members: 3, morale: 0.6, goal: null, target: null, plan: [], op: null, lostBlockAt: -99, log: [] },
  ];
}

/** Forward A* over fact sets (depth-limited, deterministic). Returns action ids or null. */
export function planGoap(start: Facts, goal: Facts, actions: GoapAction[], maxDepth = 4): string[] | null {
  const satisfied = (s: Facts) => Object.entries(goal).every(([k, v]) => (s[k] ?? false) === v);
  const applicable = (s: Facts, a: GoapAction) => Object.entries(a.pre).every(([k, v]) => (s[k] ?? false) === v);
  const key = (s: Facts) => Object.keys(s).filter((k) => s[k]).sort().join(',');
  const open: Array<{ state: Facts; plan: string[]; cost: number }> = [{ state: start, plan: [], cost: 0 }];
  const seen = new Map<string, number>();
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost || a.plan.length - b.plan.length || a.plan.join().localeCompare(b.plan.join()));
    const node = open.shift()!;
    if (satisfied(node.state)) return node.plan;
    if (node.plan.length >= maxDepth) continue;
    for (const a of actions) {
      if (!applicable(node.state, a)) continue;
      const state = { ...node.state, ...a.eff };
      const cost = node.cost + a.cost;
      const k = key(state);
      if ((seen.get(k) ?? Infinity) <= cost) continue;
      seen.set(k, cost);
      open.push({ state, plan: [...node.plan, a.id], cost });
    }
  }
  return null;
}

export interface StrategyContext {
  layout: DistrictLayout;
  territory: TerritoryState;
  reputation: Record<string, number>;
  events: EventQueue;
  world: WorldConditions;
  /** Spawn crew NPCs for an operation in a block; returns their ids. */
  spawnCrew(faction: 'saints' | 'halcyon', blockId: string, count: number): string[];
  /** Was any of these crew members harassed by the player since the operation began? */
  crewDisrupted(ids: string[]): boolean;
  dismissCrew(ids: string[]): void;
}

function center(b: CityBlock) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function facts(f: FactionAgent, ctx: StrategyContext): Facts {
  return {
    hasCash: f.cash >= 40,
    hasCrew: f.members >= 3,
    hasIntel: false,
    aggressive: f.id === 'halcyon' && ctx.world.absHour - f.lostBlockAt < 6,
  };
}

/** Choose the goal with the highest utility; also picks the target block. */
function chooseGoal(f: FactionAgent, ctx: StrategyContext): { goal: string; want: Facts; target: string | null } {
  const blocks = ctx.layout.blocks.filter((b) => b.kind !== 'park');
  const inf = (b: CityBlock, k: string) => ctx.territory.influence[b.id]?.[k] ?? 0;
  if (f.id === 'halcyon') {
    if (ctx.world.blackout) return { goal: 'accumulate', want: { hasCash: true }, target: null };
    const held = blocks.filter((b) => ctx.territory.controllers[b.id] === 'halcyon');
    const anchors = held.length ? held : blocks.filter((b) => inf(b, 'halcyon') >= 30);
    const target = blocks
      .filter((b) => ctx.territory.controllers[b.id] !== 'halcyon')
      .map((b) => ({ b, d: Math.min(...anchors.map((a) => Math.hypot(center(a).x - center(b).x, center(a).y - center(b).y)), Infinity) }))
      .sort((a, c) => a.d - c.d || a.b.id.localeCompare(c.b.id))[0]?.b;
    return { goal: 'expand', want: { targetGained: true }, target: target?.id ?? null };
  }
  // Saints
  const threatened = blocks
    .map((b) => ({ b, threat: inf(b, 'halcyon') - inf(b, 'saints') * 0.5 }))
    .sort((a, c) => c.threat - a.threat || a.b.id.localeCompare(c.b.id))[0];
  const utilities: Array<{ goal: string; u: number; want: Facts; target: string | null }> = [
    { goal: 'defend', u: 0.4 + Math.max(0, threatened?.threat ?? 0) / 60, want: { targetDefended: true }, target: threatened?.b.id ?? null },
    { goal: 'morale', u: (1 - f.morale) * 0.9, want: { moraleUp: true }, target: null },
    { goal: 'grow', u: f.members < 3 ? 0.7 : 0.1, want: { hasCrew: true }, target: null },
  ];
  utilities.sort((a, b) => b.u - a.u || a.goal.localeCompare(b.goal));
  const best = utilities[0]!;
  return { goal: best.goal, want: best.want, target: best.target };
}

function strength(f: FactionAgent, ctx: StrategyContext): number {
  const rep = ctx.reputation[f.id] ?? 0;
  const eventBoost = f.id === 'halcyon' && ctx.world.recallDrive ? 1.4 : f.id === 'saints' && ctx.world.procession ? 1.3 : 1;
  return (1 + Math.max(-0.5, Math.min(0.6, rep / 100))) * (0.7 + f.morale * 0.5) * eventBoost;
}

/** One strategic hour for one faction. */
export function factionTick(f: FactionAgent, ctx: StrategyContext): void {
  // Income and world-event reactions.
  f.cash += f.id === 'halcyon' ? (ctx.world.blackout ? 2 : 8) + (ctx.world.recallDrive ? 15 : 0) : 3 + Math.floor(f.morale * 3);
  if (f.id === 'saints' && ctx.world.procession) f.morale = Math.min(1, f.morale + 0.08);

  // Progress the running operation.
  if (f.op) {
    const op = f.op;
    if (!op.disrupted && op.crew.length && ctx.crewDisrupted(op.crew)) {
      op.disrupted = true;
      f.morale = Math.max(0, f.morale - 0.15);
      ctx.events.push({ type: 'faction.operation', faction: f.id, action: op.action, blockId: op.blockId, status: 'disrupted' });
    }
    if (!op.disrupted) applyOperationHour(f, op, ctx);
    op.hoursLeft--;
    if (op.hoursLeft <= 0 || op.disrupted) {
      ctx.dismissCrew(op.crew);
      if (!op.disrupted) ctx.events.push({ type: 'faction.operation', faction: f.id, action: op.action, blockId: op.blockId, status: 'completed' });
      f.op = null;
    } else {
      return;
    }
  }

  // Re-plan when there is no plan left.
  if (f.plan.length === 0) {
    const { goal, want, target } = chooseGoal(f, ctx);
    const plan = planGoap(facts(f, ctx), want, ACTIONS[f.id]);
    f.goal = goal;
    f.target = target;
    f.plan = plan ?? [];
    f.log = [`h${ctx.world.absHour}: goal ${goal}${target ? ` @${target}` : ''} → ${f.plan.join(' → ') || 'no plan'}`, ...f.log].slice(0, 6);
    if (!plan || plan.length === 0) return; // nothing to do (or goal already satisfied)
  }

  const next = f.plan.shift()!;
  const action = ACTIONS[f.id].find((a) => a.id === next);
  if (!action) return;
  const blockId = action.targeted ? f.target : null;
  if (action.targeted && !blockId) {
    f.plan = [];
    return;
  }
  const crew = action.crew > 0 && blockId ? ctx.spawnCrew(f.id, blockId, action.crew) : [];
  f.op = { action: action.id, blockId, hoursLeft: action.hours, crew, disrupted: false };
  if (action.crew > 0 || action.id === 'soup-kitchen') {
    ctx.events.push({ type: 'faction.operation', faction: f.id, action: action.id, blockId, status: 'started' });
  }
}

function applyOperationHour(f: FactionAgent, op: Operation, ctx: StrategyContext): void {
  const s = strength(f, ctx);
  const block = op.blockId;
  switch (op.action) {
    case 'fundraise':
      f.cash += 25;
      break;
    case 'collect':
      f.cash += 18;
      break;
    case 'hire':
    case 'recruit':
      if (f.cash >= 30) {
        f.cash -= 30;
        f.members += 1;
      }
      break;
    case 'scout':
      break;
    case 'outreach':
      if (block) {
        adjustInfluence(ctx.territory, block, 'halcyon', 9 * s, ctx.events);
        adjustInfluence(ctx.territory, block, 'saints', -6 * s, ctx.events);
      }
      f.cash = Math.max(0, f.cash - 10);
      break;
    case 'raid':
      if (block) {
        adjustInfluence(ctx.territory, block, 'halcyon', 14 * s, ctx.events);
        adjustInfluence(ctx.territory, block, 'saints', -12 * s, ctx.events);
      }
      break;
    case 'rally':
      if (block) {
        const room = Math.max(0, 85 - (ctx.territory.influence[block]?.saints ?? 0));
        adjustInfluence(ctx.territory, block, 'saints', Math.min(room, 8 * s), ctx.events);
        adjustInfluence(ctx.territory, block, 'halcyon', -5 * s, ctx.events);
      }
      f.cash = Math.max(0, f.cash - 12);
      break;
    case 'strip-posters':
      if (block) adjustInfluence(ctx.territory, block, 'halcyon', -7 * s, ctx.events);
      break;
    case 'soup-kitchen':
      if (f.cash >= 20) {
        f.cash -= 20;
        f.morale = Math.min(1, f.morale + 0.2);
      }
      break;
  }
}

/** Called when a block changes hands, so factions can react (retaliation). */
export function noteTerritoryChange(agents: FactionAgent[], previous: string | null, absHour: number): void {
  for (const f of agents) {
    if (f.id === previous) {
      f.lostBlockAt = absHour;
      f.morale = Math.max(0, f.morale - 0.1);
      f.plan = []; // re-plan next hour
    }
  }
}
