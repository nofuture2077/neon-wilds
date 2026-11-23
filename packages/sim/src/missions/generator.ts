import { relationship } from '../ai/memory';
import { ARCHETYPE_FACTION } from '../content/factions';
import { SPECIES, getSpecies } from '../content/wildlings';
import type { Rng } from '../core/rng';
import type { FactionAgent } from '../factions/strategy';
import type { TerritoryState } from '../factions/territory';
import type { ProgressionState } from '../progression';
import type { NpcState } from '../state';
import type { Building, DistrictLayout } from '../world/district';
import type { MissionDef } from './types';

/**
 * Deterministic procedural missions (AI.md §8). Each template checks
 * preconditions against the live world, binds roles to real NPCs,
 * buildings, species and faction operations, validates completability,
 * then fills handwritten text slots. No generative AI.
 */
export interface MissionGenContext {
  layout: DistrictLayout;
  npcs: readonly NpcState[];
  progression: ProgressionState;
  territory: TerritoryState;
  factions: readonly FactionAgent[];
  rng: Rng;
  /** Absolute in-game minute. */
  now: number;
  hour: number;
  player: { x: number; y: number };
  locationOf(x: number, y: number): string;
}

type Template = (ctx: MissionGenContext, id: string) => MissionDef | null;

const clockText = (abs: number) => {
  const m = Math.floor(abs % 1440);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const timesFor = (hour: number): Array<'day' | 'dusk' | 'night'> => {
  const t = (h: number) => (h >= 6 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'dusk' : 'night');
  return [...new Set([t(hour), t((hour + 3) % 24)])] as Array<'day' | 'dusk' | 'night'>;
};

/** Species that can actually be found in this district within the next few hours. */
function availableSpecies(ctx: MissionGenContext): string[] {
  const times = timesFor(ctx.hour);
  return Object.values(SPECIES)
    .filter((s) => s.captureRate > 0 && s.rarity === 'common' && s.habitats.some((h) => h.district === ctx.layout.id && h.time.some((t) => times.includes(t))))
    .map((s) => s.id);
}

function canCatch(p: ProgressionState): boolean {
  const snares = Object.entries(p.inventory).some(([id, q]) => id.endsWith('-snare') && q > 0);
  return p.party.some((w) => w.hp > 0) && (snares || p.money >= 60);
}

function freeGiver(ctx: MissionGenContext, filter: (n: NpcState) => boolean): NpcState | null {
  const busy = new Set(ctx.progression.generated.filter((m) => ctx.progression.board.includes(m.id) || ctx.progression.missions.some((r) => r.id === m.id && r.status === 'active')).map((m) => m.giver));
  const options = ctx.npcs.filter(
    (n) => n.present && !n.transient && !n.stationary && n.agent && !busy.has(n.id) && relationship(n.memory).affection > -0.25 && filter(n),
  );
  return options.length ? ctx.rng.pick(options) : null;
}

const delivery: Template = (ctx, id) => {
  const candidates = ctx.layout.buildings.filter((b) => b.name);
  if (candidates.length < 2) return null;
  const from = ctx.rng.pick(candidates);
  const far = candidates.filter((b) => Math.abs(b.entrance.tx - from.entrance.tx) + Math.abs(b.entrance.ty - from.entrance.ty) >= 25 && b.name !== from.name);
  if (!far.length) return null;
  const to = ctx.rng.pick(far);
  const dist =
    Math.abs(ctx.player.x - from.entrance.tx) + Math.abs(ctx.player.y - from.entrance.ty) + Math.abs(from.entrance.tx - to.entrance.tx) + Math.abs(from.entrance.ty - to.entrance.ty);
  // Completability: generous deadline from walking time (1 tile ≈ 0.3 in-game minutes on foot) plus slack.
  const deadline = Math.round(ctx.now + 25 + dist * 0.9);
  const pay = 50 + Math.round(dist * 1.5);
  const what = ctx.rng.pick(['a sealed envelope', 'a crate of bootleg coils', 'a box of medicine', 'a warm, buzzing parcel', 'a bag of Snares']);
  return {
    id,
    title: `Courier: ${to.name}`,
    summary: `Pick up ${what} at ${from.name} and get it to ${to.name} by ${clockText(deadline)}.`,
    requires: [],
    objectives: [
      { text: `Pick up the parcel at ${from.name}`, kind: 'inspect', target: from.name, onComplete: [{ type: 'message', speaker: from.name, pages: [`"Here — ${what}. Don't shake it." Deliver to ${to.name} by ${clockText(deadline)}.`] }] },
      { text: `Deliver it to ${to.name} by ${clockText(deadline)}`, kind: 'inspect', target: to.name },
    ],
    rewards: [
      { type: 'give-money', amount: pay },
      { type: 'message', speaker: to.name, pages: ['"Right on time. The Co-op will hear good things."'] },
    ],
    generated: { template: 'delivery', deadlineMinutes: deadline, onFail: [{ type: 'message', speaker: 'Co-op Dispatch', pages: ['That parcel was due ages ago, {player}. The client cancelled. No pay.'] }], reward: `${pay}₵` },
  };
};

const wildlingRequest: Template = (ctx, id) => {
  if (!canCatch(ctx.progression)) return null;
  const giver = freeGiver(ctx, () => true);
  const species = availableSpecies(ctx);
  if (!giver || !species.length) return null;
  const sp = getSpecies(ctx.rng.pick(species));
  const pay = 90 + Math.round((255 - sp.captureRate) * 0.8);
  const faction = ARCHETYPE_FACTION[giver.archetypeId];
  const why = ctx.rng.pick([
    `my kid won't stop talking about ${sp.name}s`,
    `I need a ${sp.name} to keep the rats out of the stockroom`,
    `the clinic needs a healthy ${sp.name} to compare against the sick ones`,
    `I lost mine to a Halcyon van last month`,
  ]);
  return {
    id,
    title: `${giver.name} wants a ${sp.name}`,
    summary: `${giver.name} asked you to catch a ${sp.name} and show it to them.`,
    requires: [],
    giver: giver.id,
    offer: [`{player}, could you do me a favour? Catch a ${sp.name} for me — ${why}.`, `There's ${pay}₵ in it for you.`],
    objectives: [
      { text: `Catch a ${sp.name}`, kind: 'capture', target: sp.id },
      { text: `Show the ${sp.name} to ${giver.name}`, kind: 'talk', target: giver.id, pages: [`A ${sp.name}! You actually did it. Thank you, {player}.`] },
    ],
    rewards: [
      { type: 'give-money', amount: pay },
      { type: 'remember', npc: giver.id, kind: 'helped', important: false },
      ...(faction ? [{ type: 'reputation' as const, faction, delta: 4 }] : []),
    ],
    generated: { template: 'wildling-request', deadlineMinutes: ctx.now + 24 * 60, onFail: [], reward: `${pay}₵` },
  };
};

const recovery: Template = (ctx, id) => {
  if (!canCatch(ctx.progression)) return null;
  const giver = freeGiver(ctx, (n) => ['street-vendor', 'old-timer', 'tinkerer', 'street-kid'].includes(n.archetypeId));
  if (!giver) return null;
  const night = ctx.hour >= 17 || ctx.hour < 6;
  const thief = night ? 'binbandit' : 'ventwing';
  const item = ctx.rng.pick(['pocket watch', 'lucky coin', 'spare keys', 'grandmother’s ring']);
  const tag = `thief-${id}`;
  return {
    id,
    title: `Stolen ${item}`,
    summary: `A ${getSpecies(thief).name} snatched ${giver.name}'s ${item}.`,
    requires: [],
    giver: giver.id,
    offer: [`A ${getSpecies(thief).name} just stole my ${item}! It went toward the alleys.`, 'Please, {player} — get it back.'],
    onStart: [{ type: 'spawn-quest-wildling', species: thief, level: 4 + ctx.rng.int(0, 3), tag }],
    objectives: [
      { text: `Track down the ${getSpecies(thief).name} with the ${item}`, kind: 'resolve-tag', target: tag },
      { text: `Return the ${item} to ${giver.name}`, kind: 'talk', target: giver.id, pages: [`My ${item}! I'll never forget this, {player}.`] },
    ],
    rewards: [
      { type: 'give-money', amount: 110 },
      { type: 'remember', npc: giver.id, kind: 'helped', important: true },
    ],
    generated: { template: 'recovery', deadlineMinutes: ctx.now + 12 * 60, onFail: [], reward: '110₵' },
  };
};

const disruptHalcyon: Template = (ctx, id) => {
  const halcyon = ctx.factions.find((f) => f.id === 'halcyon');
  const op = halcyon?.op;
  if (!op || op.crew.length === 0 || op.hoursLeft < 2 || !op.blockId || (ctx.progression.reputation.saints ?? 0) < -10) return null;
  const giver = freeGiver(ctx, (n) => n.archetypeId === 'gutter-saint');
  if (!giver) return null;
  const block = ctx.layout.blocks.find((b) => b.id === op.blockId);
  const where = block ? ctx.locationOf(block.x + block.w / 2, block.y + block.h / 2) : 'the Slums';
  return {
    id,
    title: 'Run Halcyon off the block',
    summary: `A Halcyon crew is working near ${where}. ${giver.name} wants them gone.`,
    requires: [],
    giver: giver.id,
    offer: [`Halcyon sent a crew to ${where}. Posters today, vans tomorrow.`, "Go make them feel unwelcome, {player}. Shove one of them and they'll scatter."],
    objectives: [
      { text: `Break up the Halcyon crew near ${where}`, kind: 'disrupt', target: 'halcyon' },
      { text: `Report back to ${giver.name}`, kind: 'talk', target: giver.id, pages: ["Ha! Mother Rook will want to hear about this."] },
    ],
    rewards: [
      { type: 'give-money', amount: 80 },
      { type: 'reputation', faction: 'saints', delta: 8 },
      { type: 'reputation', faction: 'halcyon', delta: -6 },
    ],
    generated: { template: 'disrupt-halcyon', deadlineMinutes: ctx.now + op.hoursLeft * 60, onFail: [], reward: '80₵, Saints +8' },
  };
};

const halcyonContract: Template = (ctx, id) => {
  if (!canCatch(ctx.progression) || (ctx.progression.reputation.halcyon ?? 0) < -25) return null;
  const species = availableSpecies(ctx);
  if (!species.length) return null;
  const sp = getSpecies(ctx.rng.pick(species));
  const pay = 220 + Math.round((255 - sp.captureRate) * 1.2);
  return {
    id,
    title: `Halcyon contract: ${sp.name}`,
    summary: `Halcyon pays well for "licensing samples". Catch a ${sp.name} and hand it in at the Outreach Kiosk.`,
    requires: [],
    objectives: [
      { text: `Catch a ${sp.name}`, kind: 'capture', target: sp.id },
      {
        text: 'Hand it in at the Halcyon Outreach Kiosk',
        kind: 'inspect',
        target: 'Halcyon Outreach Kiosk',
        onComplete: [
          { type: 'take-wildling', species: sp.id },
          { type: 'message', speaker: 'Halcyon Outreach', pages: [`"Thank you for supporting a gentler city." The ${sp.name} is carried into the back. It doesn't look back at you.`] },
        ],
      },
    ],
    rewards: [
      { type: 'give-money', amount: pay },
      { type: 'reputation', faction: 'halcyon', delta: 8 },
      { type: 'reputation', faction: 'saints', delta: -8 },
    ],
    generated: { template: 'halcyon-contract', deadlineMinutes: ctx.now + 24 * 60, onFail: [], reward: `${pay}₵, Halcyon +8, Saints -8` },
  };
};

/** Job board at the Courier Co-op: up to three missions without a giver. */
export function generateBoard(ctx: MissionGenContext, nextId: () => string): MissionDef[] {
  const out: MissionDef[] = [];
  for (const t of [delivery, halcyonContract, delivery]) {
    const def = t(ctx, nextId());
    if (def && !out.some((d) => d.title === def.title)) out.push(def);
  }
  return out;
}

/** A request from an NPC (offered when you talk to them). */
export function generateNpcRequest(ctx: MissionGenContext, nextId: () => string): MissionDef | null {
  const order = [disruptHalcyon, wildlingRequest, recovery];
  const start = ctx.rng.int(0, order.length - 1);
  for (let i = 0; i < order.length; i++) {
    const def = order[(start + i) % order.length]!(ctx, nextId());
    if (def) return def;
  }
  return null;
}

export function buildingByName(layout: DistrictLayout, name: string): Building | undefined {
  return layout.buildings.find((b) => b.name === name);
}
