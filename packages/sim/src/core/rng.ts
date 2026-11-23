/**
 * Seeded, serializable PRNG (mulberry32).
 *
 * The simulation must never call Math.random(): every random decision goes
 * through an Rng so that a (seed, input stream) pair always reproduces the
 * same world. The full state is a single uint32, which keeps save games and
 * replay snapshots trivial.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Current internal state; pass to `Rng.fromState` to resume. */
  getState(): number {
    return this.state;
  }

  static fromState(state: number): Rng {
    const rng = new Rng(0);
    rng.state = state >>> 0;
    return rng;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with an empty list');
    return items[Math.floor(this.next() * items.length)] as T;
  }
}

/** Derive an independent, stable seed from a base seed and a label. */
export function deriveSeed(seed: number, label: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}
