import type { TileMap } from '../world/tilemap';

/**
 * Deterministic NPC memory (AI.md §2.2). Memories are about the player;
 * they decay by the in-game hour unless important, spread by gossip as
 * second-hand rumours, and drive relationships, dialogue and reactions.
 */
export type MemoryKind =
  | 'shoved'
  | 'hit-by-car'
  | 'witnessed-crime'
  | 'witnessed-assault'
  | 'saw-battle-win'
  | 'helped'
  | 'chatted'
  | 'sold-wildling';

export interface MemoryRecord {
  kind: MemoryKind;
  /** 0..1 — how strongly it is remembered right now. */
  salience: number;
  /** Important memories never decay. */
  important: boolean;
  /** Heard from someone else. */
  secondhand: boolean;
  /** In-game minute (absolute) it happened or was heard. */
  at: number;
}

const MAX_MEMORIES = 12;

/** Per-kind effect on how the NPC feels about the player. */
const EFFECT: Record<MemoryKind, { trust: number; fear: number; affection: number; respect: number; hourlyDecay: number }> = {
  shoved: { trust: -0.4, fear: 0.3, affection: -0.5, respect: 0, hourlyDecay: 0.93 },
  'hit-by-car': { trust: -0.8, fear: 0.9, affection: -0.8, respect: 0, hourlyDecay: 0.97 },
  'witnessed-crime': { trust: -0.4, fear: 0.4, affection: -0.2, respect: 0.1, hourlyDecay: 0.95 },
  'witnessed-assault': { trust: -0.3, fear: 0.3, affection: -0.2, respect: 0, hourlyDecay: 0.94 },
  'saw-battle-win': { trust: 0.1, fear: 0, affection: 0.1, respect: 0.5, hourlyDecay: 0.96 },
  helped: { trust: 0.9, fear: -0.2, affection: 0.9, respect: 0.4, hourlyDecay: 0.99 },
  chatted: { trust: 0.1, fear: -0.05, affection: 0.15, respect: 0, hourlyDecay: 0.9 },
  'sold-wildling': { trust: -0.3, fear: 0, affection: -0.4, respect: 0, hourlyDecay: 0.98 },
};

export interface Relationship {
  trust: number;
  fear: number;
  affection: number;
  respect: number;
}

export function remember(memory: MemoryRecord[], rec: MemoryRecord): void {
  // Reinforce an existing memory of the same kind instead of duplicating it.
  const same = memory.find((m) => m.kind === rec.kind && m.secondhand === rec.secondhand);
  if (same) {
    same.salience = Math.min(1, same.salience + rec.salience * 0.6);
    same.important ||= rec.important;
    same.at = rec.at;
    return;
  }
  memory.push(rec);
  if (memory.length > MAX_MEMORIES) {
    // Forget the faintest non-important memory.
    let worst = -1;
    for (let i = 0; i < memory.length; i++) {
      const m = memory[i]!;
      if (m.important) continue;
      if (worst < 0 || m.salience < memory[worst]!.salience) worst = i;
    }
    if (worst >= 0) memory.splice(worst, 1);
  }
}

export function decayMemories(memory: MemoryRecord[]): void {
  for (let i = memory.length - 1; i >= 0; i--) {
    const m = memory[i]!;
    if (m.important) continue;
    m.salience *= EFFECT[m.kind].hourlyDecay;
    if (m.salience < 0.05) memory.splice(i, 1);
  }
}

/** Relationship with the player, derived from memories (each axis -1..1). */
export function relationship(memory: readonly MemoryRecord[]): Relationship {
  const r = { trust: 0, fear: 0, affection: 0, respect: 0 };
  for (const m of memory) {
    const e = EFFECT[m.kind];
    const w = m.salience * (m.secondhand ? 0.5 : 1);
    r.trust += e.trust * w;
    r.fear += e.fear * w;
    r.affection += e.affection * w;
    r.respect += e.respect * w;
  }
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return { trust: clamp(r.trust), fear: clamp(r.fear), affection: clamp(r.affection), respect: clamp(r.respect) };
}

/** The most salient memory (for dialogue and gossip). */
export function strongest(memory: readonly MemoryRecord[]): MemoryRecord | null {
  let best: MemoryRecord | null = null;
  for (const m of memory) if (!best || m.salience > best.salience) best = m;
  return best;
}

/** Share the teller's strongest first-hand memory as a rumour. Returns the shared kind. */
export function gossip(teller: readonly MemoryRecord[], listener: MemoryRecord[], at: number): MemoryKind | null {
  const m = [...teller].filter((x) => !x.secondhand && x.kind !== 'chatted').sort((a, b) => b.salience - a.salience)[0];
  if (!m || m.salience < 0.25) return null;
  remember(listener, { kind: m.kind, salience: m.salience * 0.6, important: false, secondhand: true, at });
  return m.kind;
}

/** Bresenham line of sight across the collision layer (walls block vision). */
export function lineOfSight(map: TileMap, x0: number, y0: number, x1: number, y1: number): boolean {
  let x = Math.floor(x0);
  let y = Math.floor(y0);
  const tx = Math.floor(x1);
  const ty = Math.floor(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 128; guard++) {
    if (x === tx && y === ty) return true;
    if ((x !== Math.floor(x0) || y !== Math.floor(y0)) && map.isSolid(x, y)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return false;
}

/** Human phrasing for rumours in dialogue. */
export const RUMOUR_TEXT: Record<MemoryKind, string> = {
  shoved: 'you go around shoving people',
  'hit-by-car': 'you ran someone down with a car',
  'witnessed-crime': "you're in trouble with the Wardens",
  'witnessed-assault': 'you started a fight on the street',
  'saw-battle-win': 'your Wildlings fight like a storm',
  helped: 'you helped out someone in trouble',
  chatted: 'you like to talk',
  'sold-wildling': 'you sell Wildlings to the pawnshop back room',
};
