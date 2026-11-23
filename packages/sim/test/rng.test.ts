import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src';

describe('Rng', () => {
  it('is reproducible for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('resumes exactly from a saved state', () => {
    const a = new Rng(7);
    for (let i = 0; i < 10; i++) a.next();
    const b = Rng.fromState(a.getState());
    for (let i = 0; i < 50; i++) expect(b.next()).toBe(a.next());
  });

  it('keeps int() within inclusive bounds and hits both ends', () => {
    const rng = new Rng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('derives distinct seeds per label', () => {
    expect(deriveSeed(1, 'a')).not.toBe(deriveSeed(1, 'b'));
    expect(deriveSeed(1, 'a')).toBe(deriveSeed(1, 'a'));
  });
});
