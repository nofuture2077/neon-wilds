import { getSpecies } from '../content/wildlings';
import type { Skill, StageStat, StatusKind, WildlingInstance } from '../creatures/model';
import { effectiveness } from '../creatures/types';
import { computeStats } from '../creatures/wildling';
import type { BattleState, Stages } from './types';

export function stageMultiplier(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

export function effectiveStat(w: WildlingInstance, stages: Stages, stat: Exclude<StageStat, 'accuracy'>): number {
  const base = computeStats(w)[stat];
  let mult = stageMultiplier(stages[stat]);
  if (stat === 'attack' && w.status?.kind === 'scorched') mult *= 0.75;
  if (stat === 'defence' && w.status?.kind === 'rusted') mult *= 0.75;
  if (stat === 'speed' && w.status?.kind === 'soaked') mult *= 0.5;
  return Math.max(1, base * mult);
}

export function envMultiplier(env: BattleState['env'], skill: Skill): number {
  let m = 1;
  if (env.night && skill.type === 'shade') m *= 1.2;
  if (env.terrain === 'park' && skill.type === 'bloom') m *= 1.2;
  if (env.terrain === 'street' && skill.type === 'spark') m *= 1.1;
  if (env.terrain === 'alley' && skill.type === 'toxic') m *= 1.1;
  return m;
}

export interface DamageInput {
  attacker: WildlingInstance;
  attackerStages: Stages;
  defender: WildlingInstance;
  defenderStages: Stages;
  skill: Skill;
  env: BattleState['env'];
}

/** Damage before the random roll and crit. */
export function baseDamage(d: DamageInput): { damage: number; effectiveness: number } {
  const { attacker, defender, skill } = d;
  const physical = skill.category === 'physical';
  const a = effectiveStat(attacker, d.attackerStages, physical ? 'attack' : 'focus');
  const def = effectiveStat(defender, d.defenderStages, physical ? 'defence' : 'resolve');
  const level = attacker.level;
  const raw = Math.floor(Math.floor((Math.floor((2 * level) / 5 + 2) * skill.power * a) / def) / 50) + 2;
  const eff = effectiveness(skill.type, getSpecies(defender.speciesId).types);
  const stab = getSpecies(attacker.speciesId).types.includes(skill.type) ? 1.25 : 1;
  const soakBonus = skill.type === 'spark' && defender.status?.kind === 'soaked' ? 1.5 : 1;
  return { damage: raw * stab * eff * soakBonus * envMultiplier(d.env, skill), effectiveness: eff };
}

/** Average expected damage including accuracy (used by the AI). */
export function expectedDamage(d: DamageInput): number {
  if (d.skill.category === 'status') return 0;
  return baseDamage(d).damage * 0.925 * (d.skill.accuracy / 100);
}

export const STATUS_TURNS: Record<StatusKind, number> = {
  shorted: 3,
  scorched: 4,
  soaked: 3,
  rooted: 3,
  poisoned: 99,
  rusted: 4,
  spooked: 3,
  dazed: 3,
};

/** Types that are immune to a given status. */
export const STATUS_IMMUNE: Partial<Record<StatusKind, string[]>> = {
  scorched: ['blaze'],
  soaked: ['tide'],
  shorted: ['spark'],
  poisoned: ['toxic', 'alloy'],
};

export const STATUS_LABEL: Record<StatusKind, string> = {
  shorted: 'shorted out',
  scorched: 'scorched',
  soaked: 'soaked',
  rooted: 'rooted in place',
  poisoned: 'poisoned',
  rusted: 'rusted',
  spooked: 'spooked',
  dazed: 'dazed',
};

export function captureChance(target: WildlingInstance, hpMax: number, snare: { multiplier: number; bonusVs?: string[]; sleepingBonus?: number }): number {
  const species = getSpecies(target.speciesId);
  if (species.captureRate <= 0) return 0;
  const base = species.captureRate / 255;
  let device = snare.multiplier;
  if (snare.bonusVs && species.types.some((t) => snare.bonusVs!.includes(t))) device *= 2;
  if (snare.sleepingBonus && target.status) device *= snare.sleepingBonus;
  const hpFrac = target.hp / Math.max(1, hpMax);
  const statusBonus = target.status ? 1.5 : 1;
  return Math.max(0.02, Math.min(0.98, base * device * (1 - 0.7 * hpFrac) * statusBonus));
}

export function xpReward(defeated: WildlingInstance, trainer: boolean): number {
  return Math.max(1, Math.floor((getSpecies(defeated.speciesId).xpYield * defeated.level) / 7) * (trainer ? 1.5 : 1));
}
