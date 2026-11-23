import { describe, expect, it } from 'vitest';
import {
  ELEMENTS,
  Rng,
  SKILLS,
  SPECIES,
  createWildling,
  effectiveness,
  gainXp,
  maxHp,
  typeMultiplier,
  xpForLevel,
} from '../src';

describe('type chart', () => {
  it('matches design examples', () => {
    expect(typeMultiplier('spark', 'tide')).toBe(2);
    expect(typeMultiplier('tide', 'toxic')).toBe(2);
    expect(typeMultiplier('toxic', 'tide')).toBe(2);
    expect(typeMultiplier('rubble', 'bloom')).toBe(0.5);
    expect(effectiveness('spark', ['tide', 'alloy'])).toBe(4);
    expect(effectiveness('shade', ['spark', 'shade'])).toBe(4);
  });

  it('has no immunities and every type has at least one weakness', () => {
    for (const def of ELEMENTS) {
      const weaknesses = ELEMENTS.filter((a) => typeMultiplier(a, def) === 2);
      expect(weaknesses.length, def).toBeGreaterThan(0);
      for (const a of ELEMENTS) expect(typeMultiplier(a, def)).toBeGreaterThan(0);
    }
  });
});

describe('content integrity', () => {
  it('references only existing skills, species and evolutions', () => {
    for (const s of Object.values(SPECIES)) {
      for (const l of s.learnset) expect(SKILLS[l.skill], `${s.id}:${l.skill}`).toBeDefined();
      for (const e of s.evolutions) expect(SPECIES[e.into], `${s.id}->${e.into}`).toBeDefined();
      for (const p of s.prey) expect(SPECIES[p]).toBeDefined();
      expect(s.learnset.some((l) => l.level <= 2), `${s.id} needs a starting skill`).toBe(true);
    }
  });

  it('offers at least 10 wild-catchable species in the Slums', () => {
    const catchable = Object.values(SPECIES).filter((s) => s.captureRate > 0 && s.habitats.some((h) => h.district === 'slums'));
    expect(catchable.length).toBeGreaterThanOrEqual(10);
  });
});

describe('wildling progression', () => {
  it('creates deterministic instances with full HP and up to four skills', () => {
    const a = createWildling('fizzlet', 10, new Rng(5), 'a');
    const b = createWildling('fizzlet', 10, new Rng(5), 'a');
    expect(a).toEqual(b);
    expect(a.hp).toBe(maxHp(a));
    expect(a.skills.length).toBeLessThanOrEqual(4);
    expect(a.xp).toBe(xpForLevel(10));
  });

  it('levels up, learns skills and evolves', () => {
    const w = createWildling('fizzlet', 13, new Rng(1), 'f');
    const events = gainXp(w, xpForLevel(18) - w.xp);
    expect(w.level).toBe(18);
    expect(events.some((e) => e.kind === 'learned' && e.skill === 'arc-bolt')).toBe(true);
    expect(events).toContainEqual({ kind: 'evolved', from: 'fizzlet', to: 'neonyx' });
    expect(w.speciesId).toBe('neonyx');
    expect(w.hp).toBeGreaterThan(0);
    expect(w.hp).toBeLessThanOrEqual(maxHp(w));
  });

  it('injuries lower max HP until healed', () => {
    const w = createWildling('pebblet', 10, new Rng(2), 'p');
    const full = maxHp(w);
    w.injuries = 2;
    expect(maxHp(w)).toBe(Math.floor(full * 0.8));
  });
});
