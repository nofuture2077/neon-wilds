import { describe, expect, it } from 'vitest';
import { ELEMENTS, MISSIONS, Rng, SPECIES, TRAINERS, createWildling, effectiveness, scaledTrainerLevels, xpForLevel, xpReward } from '../src';

const trainerFor = (missionId: string) =>
  MISSIONS.find((m) => m.id === missionId)!
    .objectives.filter((o) => o.kind === 'defeat')
    .map((o) => TRAINERS[o.target]!);
const top = (t: { party: { level: number }[] }) => Math.max(...t.party.map((p) => p.level));

describe('balance', () => {
  it('scales story trainers down to meet an under-levelled player, never below six levels', () => {
    expect(scaledTrainerLevels([20, 22, 21], [10, 9])).toEqual([14, 16, 15]);
    expect(scaledTrainerLevels([20, 22, 21], [3])).toEqual([14, 16, 15]);
    expect(scaledTrainerLevels([20, 22, 21], [30])).toEqual([20, 22, 21]);
    expect(scaledTrainerLevels([4], [1])).toEqual([3]);
  });

  it('makes the final confrontation the hardest fight of the main story', () => {
    const finale = top(trainerFor('the-quiet')[0]!);
    for (const arc of ['tethered', 'cargo', 'the-pit', 'founders-vault', 'vik-challenge', 'last-run']) {
      for (const t of trainerFor(arc)) expect(top(t), `${arc}: ${t.npcId}`).toBeLessThan(finale);
    }
  });

  it('keeps Act II fights within reach of a player who has just finished Act I', () => {
    const player = [10];
    for (const arc of ['tethered', 'cargo', 'the-pit', 'founders-vault']) {
      for (const t of trainerFor(arc)) expect(Math.max(...scaledTrainerLevels(t.party.map((p) => p.level), player)), t.npcId).toBeLessThanOrEqual(16);
    }
  });

  it('paces levelling: wild battles in the current district carry a Wildling from 10 to 20 in a reasonable number of fights', () => {
    let level = 10;
    let xp = xpForLevel(level);
    let battles = 0;
    const rng = new Rng(1);
    while (level < 20 && battles < 500) {
      // Typical encounter: a common or uncommon species a little below the player.
      const foe = createWildling(battles % 2 ? 'smogling' : 'mossling', Math.max(2, level - 1), rng, 'f');
      xp += xpReward(foe, false);
      battles++;
      while (xp >= xpForLevel(level + 1)) level++;
    }
    expect(battles).toBeGreaterThan(15);
    expect(battles).toBeLessThan(80);
  });

  it('gives every element an answer: something hits it super-effectively', () => {
    for (const defender of ELEMENTS) {
      expect(ELEMENTS.some((attacker) => effectiveness(attacker, [defender]) > 1), defender).toBe(true);
    }
  });

  it('keeps every trainer team made of real species with moves', () => {
    for (const t of Object.values(TRAINERS)) {
      for (const p of t.party) {
        expect(SPECIES[p.species], `${t.npcId}: ${p.species}`).toBeTruthy();
        expect(createWildling(p.species, p.level, new Rng(2), 'x').skills.length, `${t.npcId}: ${p.species}`).toBeGreaterThan(0);
      }
    }
  });
});
