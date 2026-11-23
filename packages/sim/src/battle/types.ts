import type { StageStat, StatusKind, WildlingInstance } from '../creatures/model';

export type BattleTerrain = 'street' | 'alley' | 'park';
export type BattleAi = 'wild' | 'novice' | 'skilled';
export type Side = 'player' | 'enemy';
export type Stages = Record<StageStat, number>;

export const ZERO_STAGES: Stages = Object.freeze({ attack: 0, defence: 0, focus: 0, resolve: 0, speed: 0, accuracy: 0 });

export interface BattleState {
  id: string;
  kind: 'wild' | 'trainer';
  trainerId: string | null;
  trainerName: string | null;
  ai: BattleAi;
  env: { night: boolean; terrain: BattleTerrain };
  turn: number;
  phase: 'choose' | 'force-switch' | 'ended';
  outcome: null | 'win' | 'lose' | 'fled' | 'captured';
  /** Player side refers to the player's party by index (the party lives in progression state). */
  player: { active: number; stages: Stages; participants: string[] };
  enemy: { party: WildlingInstance[]; active: number; stages: Stages; items: Record<string, number>; lastSwitchTurn: number };
  firstStrike: boolean;
  fleeAttempts: number;
  /** World entity of the wild Wildling, if any. */
  wildEntityId: string | null;
  questTag: string | null;
  rewardMoney: number;
}

export type BattleAction =
  | { kind: 'skill'; index: number }
  | { kind: 'switch'; partyIndex: number }
  | { kind: 'item'; itemId: string; partyIndex: number }
  | { kind: 'capture'; itemId: string }
  | { kind: 'flee' };

export type BattleLog =
  | { t: 'text'; text: string }
  | { t: 'use'; side: Side; skill: string; type: string }
  | { t: 'damage'; side: Side; amount: number; hp: number; max: number; effectiveness: number; crit: boolean }
  | { t: 'heal'; side: Side; hp: number; max: number }
  | { t: 'miss'; side: Side }
  | { t: 'status'; side: Side; status: StatusKind | null }
  | { t: 'stage'; side: Side; stat: StageStat; delta: number }
  | { t: 'faint'; side: Side }
  | { t: 'switch'; side: Side; index: number }
  | { t: 'throw'; item: string }
  | { t: 'shake'; n: number }
  | { t: 'capture'; success: boolean }
  | { t: 'xp'; uid: string; amount: number }
  | { t: 'levelup'; uid: string; level: number }
  | { t: 'evolve'; uid: string; from: string; to: string }
  | { t: 'end'; outcome: NonNullable<BattleState['outcome']> };
