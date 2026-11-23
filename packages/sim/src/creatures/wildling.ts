import { SKILLS } from '../content/skills';
import { getSpecies } from '../content/wildlings';
import type { Rng } from '../core/rng';
import type { Stats, WildlingInstance } from './model';

export const MAX_LEVEL = 60;
export const MAX_SKILLS = 4;
export const MAX_INJURIES = 3;

/** Total XP required to reach `level` (medium curve). */
export function xpForLevel(level: number): number {
  return Math.floor(0.8 * level ** 3);
}

export function computeStats(w: WildlingInstance): Stats {
  const base = getSpecies(w.speciesId).baseStats;
  const calc = (b: number, iv: number) => Math.floor(((2 * b + iv) * w.level) / 100) + 5;
  const hp = Math.floor(((2 * base.hp + w.ivs.hp) * w.level) / 100) + w.level + 10;
  return {
    hp: Math.max(1, Math.floor(hp * (1 - 0.1 * w.injuries))),
    attack: calc(base.attack, w.ivs.attack),
    defence: calc(base.defence, w.ivs.defence),
    focus: calc(base.focus, w.ivs.focus),
    resolve: calc(base.resolve, w.ivs.resolve),
    speed: calc(base.speed, w.ivs.speed),
  };
}

export function maxHp(w: WildlingInstance): number {
  return computeStats(w).hp;
}

/** The four most recent skills available at `level`. */
export function defaultSkills(speciesId: string, level: number): string[] {
  const known = getSpecies(speciesId)
    .learnset.filter((l) => l.level <= level)
    .map((l) => l.skill);
  return [...new Set(known)].slice(-MAX_SKILLS);
}

export function createWildling(speciesId: string, level: number, rng: Rng, uid: string, tick = 0): WildlingInstance {
  const iv = () => rng.int(0, 15);
  const w: WildlingInstance = {
    uid,
    speciesId,
    nickname: null,
    level,
    xp: xpForLevel(level),
    ivs: { hp: iv(), attack: iv(), defence: iv(), focus: iv(), resolve: iv(), speed: iv() },
    hp: 0,
    status: null,
    skills: defaultSkills(speciesId, level),
    heldItem: null,
    friendship: 70,
    loyalty: 100,
    injuries: 0,
    caughtTick: tick,
  };
  w.hp = maxHp(w);
  return w;
}

export function displayName(w: WildlingInstance): string {
  return w.nickname ?? getSpecies(w.speciesId).name;
}

export type ProgressEvent =
  | { kind: 'levelup'; level: number }
  | { kind: 'learned'; skill: string }
  | { kind: 'cannot-learn'; skill: string }
  | { kind: 'evolved'; from: string; to: string };

/** Add XP, applying level-ups, new skills and evolutions. Returns what happened, in order. */
export function gainXp(w: WildlingInstance, amount: number): ProgressEvent[] {
  const out: ProgressEvent[] = [];
  if (w.level >= MAX_LEVEL) return out;
  w.xp += amount;
  while (w.level < MAX_LEVEL && w.xp >= xpForLevel(w.level + 1)) {
    const before = maxHp(w);
    w.level++;
    w.friendship = Math.min(255, w.friendship + 2);
    w.hp = Math.min(maxHp(w), w.hp + (maxHp(w) - before));
    out.push({ kind: 'levelup', level: w.level });
    for (const l of getSpecies(w.speciesId).learnset) {
      if (l.level !== w.level || w.skills.includes(l.skill)) continue;
      if (w.skills.length < MAX_SKILLS) {
        w.skills.push(l.skill);
        out.push({ kind: 'learned', skill: l.skill });
      } else {
        out.push({ kind: 'cannot-learn', skill: l.skill });
      }
    }
    const evo = getSpecies(w.speciesId).evolutions.find((e) => e.when.kind === 'level' && w.level >= e.when.level);
    if (evo) {
      const from = w.speciesId;
      const ratio = w.hp / Math.max(1, maxHp(w));
      w.speciesId = evo.into;
      w.hp = Math.max(1, Math.round(maxHp(w) * ratio));
      out.push({ kind: 'evolved', from, to: evo.into });
    }
  }
  return out;
}

export function healFully(w: WildlingInstance, clearInjuries: boolean): void {
  if (clearInjuries) w.injuries = 0;
  w.hp = maxHp(w);
  w.status = null;
}

export function skillName(id: string): string {
  return SKILLS[id]?.name ?? id;
}
