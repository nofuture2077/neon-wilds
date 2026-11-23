import { ITEMS } from '../content/items';
import { SKILLS } from '../content/skills';
import { getSpecies } from '../content/wildlings';
import type { Skill } from '../creatures/model';
import { effectiveness } from '../creatures/types';
import { maxHp } from '../creatures/wildling';
import type { BattleContext } from './engine';
import { expectedDamage } from './formulas';
import type { BattleAction } from './types';

/**
 * Deterministic tactical opponent (AI.md §5).
 * - wild: weighted random among skills, favouring damaging ones
 * - novice: greedy expected value with some randomness, never switches
 * - skilled: greedy, heals at low HP if it has items, switches out of bad matchups
 */
export function chooseEnemyAction(ctx: BattleContext): BattleAction {
  const b = ctx.battle;
  const me = b.enemy.party[b.enemy.active]!;
  const foe = ctx.playerParty[b.player.active]!;
  const scored = me.skills
    .map((id, index) => ({ index, skill: SKILLS[id], score: 0 }))
    .filter((s): s is { index: number; skill: Skill; score: number } => !!s.skill)
    .map((s) => ({ ...s, score: scoreSkill(ctx, s.skill) }));
  if (scored.length === 0) return { kind: 'skill', index: 0 };

  if (b.ai === 'skilled') {
    const hpFrac = me.hp / maxHp(me);
    const heal = Object.entries(b.enemy.items).find(([id, n]) => n > 0 && ITEMS[id]?.heal);
    if (hpFrac < 0.3 && heal) return { kind: 'item', itemId: heal[0], partyIndex: b.enemy.active };

    const best = Math.max(...scored.map((s) => s.score));
    if (best < 0.25 && b.turn - b.enemy.lastSwitchTurn >= 2 && me.status?.kind !== 'rooted') {
      const foeTypes = getSpecies(foe.speciesId).types;
      const candidate = b.enemy.party.findIndex(
        (w, i) =>
          i !== b.enemy.active &&
          w.hp > 0 &&
          w.skills.some((id) => {
            const sk = SKILLS[id];
            return !!sk && sk.category !== 'status' && effectiveness(sk.type, foeTypes) >= 2;
          }),
      );
      if (candidate >= 0) return { kind: 'switch', partyIndex: candidate };
    }
  }

  if (b.ai === 'wild') {
    const weights = scored.map((s) => 0.15 + s.score * s.score);
    const total = weights.reduce((a, w) => a + w, 0);
    let r = ctx.rng.next() * total;
    for (let i = 0; i < scored.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return { kind: 'skill', index: scored[i]!.index };
    }
    return { kind: 'skill', index: scored[scored.length - 1]!.index };
  }

  scored.sort((a, c) => c.score - a.score || a.index - c.index);
  if (b.ai === 'novice' && scored.length > 1 && ctx.rng.chance(0.2)) return { kind: 'skill', index: scored[1]!.index };
  return { kind: 'skill', index: scored[0]!.index };
}

/** Value of a skill in [0, ~1.5], comparable across damaging and status skills. */
export function scoreSkill(ctx: BattleContext, skill: Skill): number {
  const b = ctx.battle;
  const me = b.enemy.party[b.enemy.active]!;
  const foe = ctx.playerParty[b.player.active]!;
  if (skill.category !== 'status') {
    const dmg = expectedDamage({ attacker: me, attackerStages: b.enemy.stages, defender: foe, defenderStages: b.player.stages, skill, env: b.env });
    const frac = Math.min(1, dmg / Math.max(1, foe.hp));
    return frac + (dmg >= foe.hp ? 0.5 : 0) + (skill.status && !foe.status ? 0.05 : 0);
  }
  if (skill.heal) {
    const missing = 1 - me.hp / maxHp(me);
    return missing > 0.5 ? 0.7 : missing * 0.4;
  }
  if (skill.status) return foe.status ? 0 : 0.35;
  if (skill.stages) {
    const stages = skill.stages.target === 'self' ? b.enemy.stages : b.player.stages;
    const current = stages[skill.stages.stat];
    const room = skill.stages.delta > 0 ? current < 2 : current > -2;
    return room && me.hp / maxHp(me) > 0.5 ? 0.3 : 0.02;
  }
  return 0.05;
}

/** Pick the next enemy Wildling after a faint: best type matchup, else first healthy. */
export function chooseEnemyReplacement(ctx: BattleContext): number | null {
  const b = ctx.battle;
  const foe = ctx.playerParty[b.player.active];
  const healthy = b.enemy.party.map((w, i) => ({ w, i })).filter(({ w, i }) => w.hp > 0 && i !== b.enemy.active);
  if (healthy.length === 0) return null;
  if (!foe) return healthy[0]!.i;
  const foeTypes = getSpecies(foe.speciesId).types;
  let best = healthy[0]!.i;
  let bestScore = -Infinity;
  for (const { w, i } of healthy) {
    const score = Math.max(
      0,
      ...w.skills.map((id) => {
        const sk = SKILLS[id];
        return sk && sk.category !== 'status' ? effectiveness(sk.type, foeTypes) : 0;
      }),
    );
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}
