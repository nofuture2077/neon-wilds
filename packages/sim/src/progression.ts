import type { WildlingInstance } from './creatures/model';
import type { MissionDef, MissionRuntime } from './missions/types';

export const PARTY_SIZE = 6;

/** Everything the player owns and has achieved. Plain data; part of the save. */
export interface ProgressionState {
  money: number;
  inventory: Record<string, number>;
  party: WildlingInstance[];
  storage: WildlingInstance[];
  index: { seen: string[]; caught: string[] };
  flags: Record<string, boolean>;
  missions: MissionRuntime[];
  defeatedTrainers: string[];
  nextUid: number;
  /** factionId → -100..100 */
  reputation: Record<string, number>;
  /** Procedurally generated mission definitions (offered, active or finished). */
  generated: MissionDef[];
  /** Ids of generated missions currently on offer. */
  board: string[];
  missionSeq: number;
  /** Day the job board was last refreshed. */
  boardDay: number;
}

export function newProgression(): ProgressionState {
  return {
    money: 100,
    inventory: {},
    party: [],
    storage: [],
    index: { seen: [], caught: [] },
    flags: {},
    missions: [],
    defeatedTrainers: [],
    nextUid: 1,
    reputation: { saints: 0, halcyon: 0, compact: 0, choir: 0, 'iron-chain': 0, wardens: 0 },
    generated: [],
    board: [],
    missionSeq: 1,
    boardDay: -1,
  };
}

export function addItem(p: ProgressionState, item: string, qty: number): void {
  p.inventory[item] = (p.inventory[item] ?? 0) + qty;
  if ((p.inventory[item] ?? 0) <= 0) delete p.inventory[item];
}

export function hasItem(p: ProgressionState, item: string, qty = 1): boolean {
  return (p.inventory[item] ?? 0) >= qty;
}

/** Adds to the party, or to storage if the party is full. Returns where it went. */
export function receiveWildling(p: ProgressionState, w: WildlingInstance): 'party' | 'storage' {
  markCaught(p, w.speciesId);
  if (p.party.length < PARTY_SIZE) {
    p.party.push(w);
    return 'party';
  }
  p.storage.push(w);
  return 'storage';
}

export function markSeen(p: ProgressionState, speciesId: string): void {
  if (!p.index.seen.includes(speciesId)) p.index.seen.push(speciesId);
}

export function markCaught(p: ProgressionState, speciesId: string): void {
  markSeen(p, speciesId);
  if (!p.index.caught.includes(speciesId)) p.index.caught.push(speciesId);
}

/** Remove empty stacks after battles consumed items. */
export function pruneInventory(p: ProgressionState): void {
  for (const [k, v] of Object.entries(p.inventory)) if (v <= 0) delete p.inventory[k];
}
