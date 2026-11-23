import type { Appearance } from './content/types';
import type { BattleAction, BattleState } from './battle/types';
import type { TilePos } from './core/vec';
import type { Effect } from './missions/types';
import type { ProgressionState } from './progression';
import type { LawState } from './law/law';
import type { VehicleState } from './world/vehicles';
import type { WildlingEntity } from './world/wildlings';

export interface ActorState {
  id: string;
  /** Position in tile units (tile (0,0) spans [0,1) x [0,1)). */
  x: number;
  y: number;
  /** Position at the start of the last step; renderers interpolate between prev and current. */
  prevX: number;
  prevY: number;
  /** Facing angle in radians (0 = east, PI/2 = south). */
  heading: number;
  /** Actual speed during the last step, tiles/second (drives walk animation). */
  speed: number;
}

export interface PlayerState extends ActorState {
  name: string;
  appearance: Appearance;
  vx: number;
  vy: number;
  running: boolean;
  conversationWith: string | null;
  /** Vehicle the player is driving, if any. */
  vehicleId: string | null;
}

export type NpcMode = 'idle' | 'walking' | 'talking' | 'fleeing' | 'confronting' | 'stationary';

export interface NpcState extends ActorState {
  name: string;
  archetypeId: string;
  appearance: Appearance;
  walkSpeed: number;
  mode: NpcMode;
  /** Seconds remaining in the current idle/confront phase. */
  timer: number;
  path: TilePos[];
  pathIndex: number;
  stuckTime: number;
  /** Until this tick the NPC remembers being shoved by the player. */
  grudgeUntilTick: number;
  shoveCooldownUntilTick: number;
  nextBarkTick: number;
  /** Mission NPCs exist in the list but stay hidden and inert until spawned. */
  present: boolean;
  stationary: boolean;
}

export interface PlayerInput {
  /** Analog movement, each axis in [-1, 1]. */
  moveX: number;
  moveY: number;
  run: boolean;
  /** Edge-triggered: true only on the step the button was pressed. */
  interact: boolean;
  /** Edge-triggered: enter / exit vehicle. */
  action?: boolean;
}

export const NO_INPUT: PlayerInput = Object.freeze({ moveX: 0, moveY: 0, run: false, interact: false, action: false });

export type SimCommand =
  /** All UI dialogue for the current interaction has been dismissed. */
  | { type: 'endDialogue' }
  | { type: 'battle.action'; action: BattleAction }
  | { type: 'item.use'; itemId: string; partyIndex: number }
  | { type: 'party.setLead'; partyIndex: number }
  | { type: 'party.deposit'; partyIndex: number }
  | { type: 'party.withdraw'; storageIndex: number }
  | { type: 'shop.buy'; shopId: string; itemId: string; qty: number };

export type Focus =
  | { kind: 'npc'; id: string; label: string }
  | { kind: 'building'; id: string; label: string };

export const SNAPSHOT_VERSION = 4;

/** Everything needed to resume a simulation. The district layout is regenerated from seed + districtId. */
export interface SimSnapshot {
  version: typeof SNAPSHOT_VERSION;
  seed: number;
  districtId: string;
  tick: number;
  minutes: number;
  rngState: number;
  ambientBarkTick: number;
  player: PlayerState;
  npcs: NpcState[];
  wildlings: WildlingEntity[];
  battle: BattleState | null;
  progression: ProgressionState;
  pendingEffects: Effect[];
  encounterCooldownUntilTick: number;
  nextEntityId: number;
  /** Null means "regenerate parked cars from the layout" (used when migrating older saves). */
  vehicles: VehicleState[] | null;
  law: LawState;
}
