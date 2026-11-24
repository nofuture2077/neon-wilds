/**
 * Daily routines per archetype (AI.md §2.5). Each block lists candidate
 * activities with base weights; the utility scorer combines them with needs.
 * Hours wrap around midnight (e.g. from 22 to 6).
 */
export type ActivityId = 'sleep' | 'eat' | 'work' | 'socialize' | 'patrol' | 'wander' | 'listen' | 'commute';

export interface ScheduleBlock {
  from: number;
  to: number;
  weights: Partial<Record<ActivityId, number>>;
}

export interface Routine {
  /** Where 'work' happens. */
  workplace: 'stall' | 'workshop' | 'office' | 'none';
  sociability: number;
  blocks: ScheduleBlock[];
}

export const ROUTINES: Record<string, Routine> = {
  'gutter-saint': {
    workplace: 'none',
    sociability: 1.2,
    blocks: [
      { from: 2, to: 9, weights: { sleep: 4, patrol: 0.5 } },
      { from: 9, to: 13, weights: { patrol: 2, eat: 1, socialize: 1 } },
      { from: 13, to: 20, weights: { patrol: 3, socialize: 1.5, eat: 1 } },
      { from: 20, to: 2, weights: { patrol: 2.5, socialize: 2, eat: 0.8 } },
    ],
  },
  'street-vendor': {
    workplace: 'stall',
    sociability: 1,
    blocks: [
      { from: 1, to: 8, weights: { sleep: 4 } },
      { from: 8, to: 11, weights: { eat: 1, work: 1.5, socialize: 0.5 } },
      { from: 11, to: 24, weights: { work: 4, eat: 0.8, socialize: 0.6 } },
      { from: 0, to: 1, weights: { socialize: 1, sleep: 2 } },
    ],
  },
  'night-worker': {
    workplace: 'office',
    sociability: 0.6,
    blocks: [
      { from: 6, to: 14, weights: { sleep: 4 } },
      { from: 14, to: 19, weights: { eat: 1, socialize: 1, wander: 1 } },
      { from: 19, to: 6, weights: { work: 3, eat: 0.8, wander: 0.5 } },
    ],
  },
  'old-timer': {
    workplace: 'none',
    sociability: 1.6,
    blocks: [
      { from: 22, to: 7, weights: { sleep: 4, wander: 0.3 } },
      { from: 7, to: 22, weights: { socialize: 2, wander: 1.5, eat: 1 } },
    ],
  },
  'street-kid': {
    workplace: 'none',
    sociability: 1.4,
    blocks: [
      { from: 0, to: 8, weights: { sleep: 4 } },
      { from: 8, to: 24, weights: { wander: 2, socialize: 2, eat: 1 } },
    ],
  },
  tinkerer: {
    workplace: 'workshop',
    sociability: 0.7,
    blocks: [
      { from: 3, to: 10, weights: { sleep: 4 } },
      { from: 10, to: 3, weights: { work: 2.5, wander: 1, socialize: 0.8, eat: 1 } },
    ],
  },
  'aegis-agent': {
    workplace: 'none',
    sociability: 0.2,
    blocks: [{ from: 0, to: 24, weights: { patrol: 4 } }],
  },
  'office-worker': {
    workplace: 'office',
    sociability: 0.6,
    blocks: [
      { from: 23, to: 7, weights: { sleep: 4 } },
      { from: 7, to: 9, weights: { eat: 1.5, commute: 0, wander: 1 } },
      { from: 9, to: 19, weights: { work: 4, eat: 0.8 } },
      { from: 19, to: 23, weights: { socialize: 1.5, eat: 1, wander: 1 } },
    ],
  },
  socialite: {
    workplace: 'none',
    sociability: 2,
    blocks: [
      { from: 4, to: 12, weights: { sleep: 4 } },
      { from: 12, to: 4, weights: { socialize: 2.5, wander: 1.5, eat: 1 } },
    ],
  },
  busker: {
    workplace: 'stall',
    sociability: 1,
    blocks: [
      { from: 2, to: 10, weights: { sleep: 4 } },
      { from: 10, to: 2, weights: { work: 3, eat: 0.8, socialize: 0.8 } },
    ],
  },
  'aegis-guard': {
    workplace: 'none',
    sociability: 0.3,
    blocks: [{ from: 0, to: 24, weights: { patrol: 4, eat: 0.4 } }],
  },
  docker: {
    workplace: 'office',
    sociability: 1,
    blocks: [
      { from: 2, to: 10, weights: { sleep: 4 } },
      { from: 10, to: 2, weights: { work: 3, eat: 1, socialize: 1.2 } },
    ],
  },
  smuggler: {
    workplace: 'none',
    sociability: 1,
    blocks: [
      { from: 8, to: 16, weights: { sleep: 4 } },
      { from: 16, to: 8, weights: { patrol: 2.5, socialize: 1.5, eat: 0.8 } },
    ],
  },
  fishmonger: {
    workplace: 'stall',
    sociability: 1,
    blocks: [
      { from: 22, to: 4, weights: { sleep: 4 } },
      { from: 4, to: 22, weights: { work: 3.5, eat: 0.8, socialize: 0.6 } },
    ],
  },
  'factory-worker': {
    workplace: 'office',
    sociability: 1,
    blocks: [
      { from: 0, to: 8, weights: { sleep: 4 } },
      { from: 8, to: 18, weights: { work: 4, eat: 0.8 } },
      { from: 18, to: 24, weights: { socialize: 2, eat: 1.2, wander: 0.6 } },
    ],
  },
  'chain-enforcer': {
    workplace: 'none',
    sociability: 1,
    blocks: [
      { from: 6, to: 14, weights: { sleep: 4 } },
      { from: 14, to: 6, weights: { patrol: 3, socialize: 1.2, eat: 0.8 } },
    ],
  },
  scrapper: {
    workplace: 'workshop',
    sociability: 0.7,
    blocks: [
      { from: 4, to: 12, weights: { sleep: 4 } },
      { from: 12, to: 4, weights: { wander: 2, work: 1.5, eat: 0.8 } },
    ],
  },
  'choir-acolyte': {
    workplace: 'office',
    sociability: 1.3,
    blocks: [
      { from: 23, to: 6, weights: { sleep: 4 } },
      { from: 6, to: 12, weights: { work: 2.5, socialize: 1, eat: 0.8 } },
      { from: 12, to: 19, weights: { wander: 1.8, socialize: 1.5, eat: 0.8 } },
      { from: 19, to: 23, weights: { work: 2, socialize: 1.5 } },
    ],
  },
  antiquarian: {
    workplace: 'workshop',
    sociability: 0.6,
    blocks: [
      { from: 22, to: 7, weights: { sleep: 4 } },
      { from: 7, to: 22, weights: { work: 2.5, wander: 1.5, eat: 0.8, socialize: 0.6 } },
    ],
  },
  'tunnel-guide': {
    workplace: 'office',
    sociability: 1,
    blocks: [
      { from: 4, to: 11, weights: { sleep: 4 } },
      { from: 11, to: 18, weights: { work: 2.5, socialize: 1, eat: 0.8 } },
      { from: 18, to: 4, weights: { patrol: 2, wander: 1.2, socialize: 1 } },
    ],
  },
  pilgrim: {
    workplace: 'none',
    sociability: 1.2,
    blocks: [
      { from: 22, to: 6, weights: { sleep: 4 } },
      { from: 6, to: 22, weights: { wander: 2.5, socialize: 1.2, eat: 0.8 } },
    ],
  },
  hermit: {
    workplace: 'workshop',
    sociability: 0.3,
    blocks: [
      { from: 21, to: 5, weights: { sleep: 4 } },
      { from: 5, to: 21, weights: { work: 2, wander: 2, eat: 0.8 } },
    ],
  },
  'field-tech': {
    workplace: 'office',
    sociability: 0.8,
    blocks: [
      { from: 23, to: 6, weights: { sleep: 4 } },
      { from: 6, to: 18, weights: { work: 2.5, wander: 1.5, eat: 0.8 } },
      { from: 18, to: 23, weights: { socialize: 2, eat: 1 } },
    ],
  },
  citizen: {
    workplace: 'none',
    sociability: 0.5,
    blocks: [{ from: 0, to: 24, weights: { commute: 3, wander: 1 } }],
  },
};

export function blockAt(routine: Routine, hour: number): ScheduleBlock | null {
  for (const b of routine.blocks) {
    const inside = b.from <= b.to ? hour >= b.from && hour < b.to : hour >= b.from || hour < b.to;
    if (inside) return b;
  }
  return null;
}
