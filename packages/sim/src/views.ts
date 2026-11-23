import { ITEMS } from './content/items';
import { MISSIONS } from './content/missions';
import { SKILLS } from './content/skills';
import { SPECIES, getSpecies } from './content/wildlings';
import type { StatusKind, WildlingInstance } from './creatures/model';
import type { ElementType } from './creatures/types';
import { computeStats, displayName, maxHp, xpForLevel } from './creatures/wildling';
import { currentObjective } from './missions/runtime';
import type { Simulation } from './simulation';

/**
 * Read-only, UI-friendly projections of simulation state. The UI never needs
 * to understand internal structures; it renders these.
 */
export interface WildlingView {
  uid: string;
  name: string;
  speciesId: string;
  speciesName: string;
  types: ElementType[];
  level: number;
  hp: number;
  maxHp: number;
  status: StatusKind | null;
  xp: number;
  xpLevelStart: number;
  xpNextLevel: number;
  friendship: number;
  loyalty: number;
  injuries: number;
  stats: ReturnType<typeof computeStats>;
  skills: { id: string; name: string; type: ElementType; category: string; power: number; accuracy: number; description: string }[];
}

export function wildlingView(w: WildlingInstance): WildlingView {
  const s = getSpecies(w.speciesId);
  return {
    uid: w.uid,
    name: displayName(w),
    speciesId: w.speciesId,
    speciesName: s.name,
    types: s.types,
    level: w.level,
    hp: w.hp,
    maxHp: maxHp(w),
    status: w.status?.kind ?? null,
    xp: w.xp,
    xpLevelStart: xpForLevel(w.level),
    xpNextLevel: xpForLevel(w.level + 1),
    friendship: w.friendship,
    loyalty: w.loyalty,
    injuries: w.injuries,
    stats: computeStats(w),
    skills: w.skills.flatMap((id) => {
      const k = SKILLS[id];
      return k ? [{ id, name: k.name, type: k.type, category: k.category, power: k.power, accuracy: k.accuracy, description: k.description }] : [];
    }),
  };
}

export interface ProgressView {
  money: number;
  inventory: { id: string; name: string; qty: number; category: string; description: string }[];
  party: WildlingView[];
  storage: WildlingView[];
  index: { id: string; name: string; types: ElementType[]; seen: boolean; caught: boolean; lore: string }[];
  missions: { id: string; title: string; summary: string; status: 'active' | 'completed'; objective: string | null }[];
}

export function progressView(sim: Simulation): ProgressView {
  const p = sim.progression;
  return {
    money: p.money,
    inventory: Object.entries(p.inventory)
      .filter(([, q]) => q > 0)
      .map(([id, qty]) => ({ id, qty, name: ITEMS[id]?.name ?? id, category: ITEMS[id]?.category ?? 'key', description: ITEMS[id]?.description ?? '' })),
    party: p.party.map(wildlingView),
    storage: p.storage.map(wildlingView),
    index: Object.values(SPECIES).map((s) => ({
      id: s.id,
      name: s.name,
      types: s.types,
      seen: p.index.seen.includes(s.id),
      caught: p.index.caught.includes(s.id),
      lore: s.lore,
    })),
    missions: p.missions.map((rt) => {
      const def = MISSIONS.find((m) => m.id === rt.id)!;
      return { id: rt.id, title: def.title, summary: def.summary, status: rt.status, objective: currentObjective(rt)?.text ?? null };
    }),
  };
}

export interface BattleView {
  id: string;
  kind: 'wild' | 'trainer';
  trainerName: string | null;
  terrain: string;
  night: boolean;
  phase: 'choose' | 'force-switch' | 'ended';
  activeIndex: number;
  party: WildlingView[];
  enemy: WildlingView;
  enemyPartySize: number;
  enemyRemaining: number;
  snares: { id: string; name: string; qty: number }[];
  medicine: { id: string; name: string; qty: number; description: string }[];
}

export function battleView(sim: Simulation): BattleView | null {
  const b = sim.battle;
  if (!b) return null;
  const inv = sim.progression.inventory;
  const enemy = b.enemy.party[b.enemy.active]!;
  const items = (cat: string) =>
    Object.entries(inv)
      .filter(([id, q]) => q > 0 && ITEMS[id]?.category === cat)
      .map(([id, qty]) => ({ id, qty, name: ITEMS[id]!.name, description: ITEMS[id]!.description }));
  return {
    id: b.id,
    kind: b.kind,
    trainerName: b.trainerName,
    terrain: b.env.terrain,
    night: b.env.night,
    phase: b.phase,
    activeIndex: b.player.active,
    party: sim.progression.party.map(wildlingView),
    enemy: wildlingView(enemy),
    enemyPartySize: b.enemy.party.length,
    enemyRemaining: b.enemy.party.filter((w) => w.hp > 0).length,
    snares: items('snare'),
    medicine: items('medicine'),
  };
}
