import type { ElementType } from './types';

export interface Stats {
  hp: number;
  attack: number;
  defence: number;
  focus: number;
  resolve: number;
  speed: number;
}

export type Personality = 'aggressive' | 'shy' | 'curious' | 'territorial' | 'social' | 'predatory' | 'sleepy' | 'loyal';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'unique';
export type TimeOfDay = 'day' | 'dusk' | 'night';
export type HabitatTile = 'sidewalk' | 'alley' | 'grass' | 'plaza' | 'road';

export interface Habitat {
  district: string;
  tiles: HabitatTile[];
  time: TimeOfDay[];
  weight: number;
  levels: [number, number];
}

export type EvolutionCondition = { kind: 'level'; level: number };

export interface Species {
  id: string;
  name: string;
  types: ElementType[];
  personality: Personality;
  baseStats: Stats;
  /** 0..255; higher is easier to capture. */
  captureRate: number;
  /** Base experience yield. */
  xpYield: number;
  rarity: Rarity;
  habitats: Habitat[];
  learnset: { level: number; skill: string }[];
  evolutions: { into: string; when: EvolutionCondition }[];
  /** Overworld movement speed, tiles/second. */
  speed: number;
  /** Species this one chases / flees from in the overworld. */
  prey: string[];
  /** Spawns in groups of this size. */
  flock: number;
  /** Nocturnal species sleep by day, diurnal ones at night. */
  activity: 'diurnal' | 'nocturnal' | 'any';
  lore: string;
}

export type StatusKind = 'shorted' | 'scorched' | 'soaked' | 'rooted' | 'poisoned' | 'rusted' | 'spooked' | 'dazed';

export type StageStat = 'attack' | 'defence' | 'focus' | 'resolve' | 'speed' | 'accuracy';

export interface Skill {
  id: string;
  name: string;
  type: ElementType;
  category: 'physical' | 'focus' | 'status';
  power: number;
  /** 0..100 */
  accuracy: number;
  priority: number;
  target: 'foe' | 'self';
  status?: { kind: StatusKind; chance: number };
  stages?: { stat: StageStat; delta: number; chance: number; target: 'foe' | 'self' };
  /** Fraction of max HP restored to the user. */
  heal?: number;
  /** Fraction of damage dealt taken as recoil. */
  recoil?: number;
  description: string;
}

export interface StatusEffect {
  kind: StatusKind;
  turns: number;
  stacks: number;
}

export interface SkillSlot {
  id: string;
}

export interface WildlingInstance {
  uid: string;
  speciesId: string;
  nickname: string | null;
  level: number;
  xp: number;
  ivs: Stats;
  hp: number;
  status: StatusEffect | null;
  skills: string[];
  heldItem: string | null;
  /** 0..255 */
  friendship: number;
  /** 0..100 */
  loyalty: number;
  /** Untreated injuries from fainting; each lowers max HP by 10% until a clinic visit. */
  injuries: number;
  caughtTick: number;
}

export type ItemCategory = 'snare' | 'medicine' | 'key';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  price: number;
  description: string;
  /** Capture multiplier for snares. */
  snare?: { multiplier: number; bonusVs?: ElementType[]; sleepingBonus?: number };
  /** Medicine effect. */
  heal?: number;
  cures?: boolean;
}
