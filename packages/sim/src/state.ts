import type { Appearance } from './content/types';
import type { AgentState } from './ai/routine';
import type { MemoryRecord } from './ai/memory';
import type { BattleAction, BattleState } from './battle/types';
import type { TilePos } from './core/vec';
import type { ChoiceOption, Effect } from './missions/types';
import type { ProgressionState } from './progression';
import type { MarketState, TerritoryState } from './factions/territory';
import type { LawState } from './law/law';
import type { FactionAgent } from './factions/strategy';
import type { WorldState } from './world/director';
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
  /** After a failed path search, don't search again before this tick. */
  pathRetryTick?: number;
  /** Until this tick the NPC remembers being shoved by the player. */
  grudgeUntilTick: number;
  shoveCooldownUntilTick: number;
  nextBarkTick: number;
  /** Mission NPCs exist in the list but stay hidden and inert until spawned. */
  present: boolean;
  stationary: boolean;
  /** Daily-routine brain; null for stationary/scripted NPCs. */
  agent: AgentState | null;
  /** Building id while inside (hidden, not simulated spatially). */
  indoors: string | null;
  /** Background pedestrians that come and go (not persisted beyond their lifetime). */
  transient: boolean;
  /** What this NPC remembers about the player. */
  memory: MemoryRecord[];
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
  | { type: 'shop.buy'; shopId: string; itemId: string; qty: number }
  | { type: 'market.sellWildling'; from: 'party' | 'storage'; index: number }
  | { type: 'mission.accept'; missionId: string }
  | { type: 'dialogue.choose'; optionId: string };

export type Focus =
  | { kind: 'npc'; id: string; label: string }
  | { kind: 'building'; id: string; label: string };

export const SNAPSHOT_VERSION = 11;

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
  day: number;
  /** Null means "initialise from the layout" (migrated saves). */
  territory: TerritoryState | null;
  market: MarketState;
  factions: { agents: FactionAgent[]; lastControllers: Record<string, string | null> } | null;
  world: WorldState;
  /** A dialogue choice waiting for the player. */
  pendingChoice: { speaker: string; options: ChoiceOption[] } | null;
  /** Parked state of the districts the player is not in. */
  away: Record<string, { npcs: NpcState[]; wildlings: WildlingEntity[]; vehicles: VehicleState[]; territory: TerritoryState }>;
}
