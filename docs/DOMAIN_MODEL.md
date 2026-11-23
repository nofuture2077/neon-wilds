# NEON WILDS — Core Domain Model

> Owner: Technical Architect. Types marked **[implemented]** exist in `packages/sim/src`. Others are the agreed design for upcoming milestones and are implemented together with the systems that use them (no dead code ahead of time).
> All simulation state is plain JSON-safe data (no classes, Maps or typed arrays in saved state). IDs are stable strings.

## World and time

```ts
// [implemented] packages/sim/src/state.ts, world/*
interface SimSnapshot { version: 1; seed: number; districtId: string; tick: number; minutes: number;
  rngState: number; ambientBarkTick: number; player: PlayerState; npcs: NpcState[] }
interface DistrictLayout { id; name; map: TileMap; buildings: Building[]; props: Prop[]; streets: Street[];
  playerSpawn; pedestrianSpawns }
interface Building { id; x; y; w; h; name; kind: BuildingKind; description; neon: number | null; style;
  door: { tx; ty; facing }; entrance: { tx; ty } }

// [planned M3] multi-district city
interface CityState { districts: Record<DistrictId, DistrictState>; weather: WeatherState; day: number }
interface DistrictState { id: DistrictId; unlocked: boolean; heat: number; crimeRate: number;
  priceIndex: Record<ItemCategory, number>; blockInfluence: Record<BlockId, Record<FactionId, number>> }
type WeatherState = { kind: 'clear' | 'rain' | 'storm' | 'fog'; intensity: number; untilTick: number };
```

## Actors

```ts
// [implemented]
interface ActorState { id; x; y; prevX; prevY; heading; speed }
interface PlayerState extends ActorState { name; appearance: Appearance; vx; vy; running; conversationWith: string | null }
interface NpcState extends ActorState { name; archetypeId; appearance; walkSpeed; mode: NpcMode; timer;
  path: TilePos[]; pathIndex; stuckTime; grudgeUntilTick; shoveCooldownUntilTick; nextBarkTick }

// [planned M4] full agent
interface NpcAgent {
  id: NpcId; name: string; roleId: RoleId; factionId: FactionId | null; homeId: BuildingId; workId: BuildingId | null;
  traits: { bravery; aggression; sociability; greed; curiosity; lawfulness };   // 0..1
  needs: { hunger; rest; social; money; safety; duty? };                        // 0..1
  emotion: { valence; arousal; dominance };                                      // -1..1
  lod: 1 | 2 | 3;
  hsm: { state: HsmState; since: number };
  activity: { id: ActivityId; btState: Uint8Array /* serialised as number[] */; startedTick: number } | null;
  memory: { shortTerm: Perception[]; longTerm: MemoryRecord[] };
  inventory: ItemStack[]; cash: number; partyIds: WildlingId[];
}
interface MemoryRecord { id; kind: MemoryKind; subject: EntityRef; salience: number; important: boolean;
  valence: number; tick: number; location: TilePos; secondhand: boolean }
interface RelationshipEdge { from: EntityRef; to: EntityRef; trust; affection; fear; respect } // -100..100
type EntityRef = { kind: 'player' } | { kind: 'npc'; id } | { kind: 'faction'; id } | { kind: 'wildling'; id };
```

## Wildlings (M2)

```ts
type ElementType = 'spark' | 'blaze' | 'tide' | 'bloom' | 'toxic' | 'alloy' | 'shade' | 'rubble';
interface Stats { hp; attack; defence; focus; resolve; speed }
interface Species {
  id: SpeciesId; name; types: [ElementType] | [ElementType, ElementType];
  personality: 'aggressive' | 'shy' | 'curious' | 'territorial' | 'social' | 'predatory' | 'sleepy' | 'loyal';
  baseStats: Stats; growth: 'fast' | 'medium' | 'slow'; captureRate: number /* 0..255 */;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  habitats: { district: DistrictId; tiles: TileKind[]; time: ('day' | 'dusk' | 'night')[]; weather?: WeatherKind[]; weight: number }[];
  learnset: { level: number; skillId: SkillId }[]; discCompat: SkillId[];
  evolutions: { into: SpeciesId; when: EvolutionCondition }[];
  behaviour: BehaviourProfileId; relations: { prey: SpeciesId[]; predators: SpeciesId[]; allies: SpeciesId[] };
  lore: string; spriteKey: string;
}
interface WildlingInstance {
  id: WildlingId; speciesId; nickname?: string; level; xp; ivs: Stats; nature: NatureId;
  hp; status: StatusEffect | null; skills: SkillSlot[]; heldItem: ItemId | null;
  friendship: number /* 0..255 */; loyalty: number /* 0..100 */; injuries: number;
  originalTrainer: string; caughtAt: { districtId; tick; device: ItemId }; flags: string[];
}
interface Skill { id; name; type: ElementType; category: 'physical' | 'focus' | 'status'; power; accuracy; pp;
  priority; effects: SkillEffect[]; contact: boolean }
type StatusKind = 'shorted' | 'scorched' | 'soaked' | 'rooted' | 'poisoned' | 'rusted' | 'spooked' | 'dazed';
interface StatusEffect { kind: StatusKind; turns: number; stacks: number }
interface BattleState { id; kind: 'wild' | 'trainer' | 'pit'; environment: EnvModifiers; turn: number;
  sides: [BattleSide, BattleSide]; log: BattleEvent[]; rngStream: number; result: BattleResult | null }
```

## Items and economy (M2–M3)

```ts
interface ItemDef { id; name; category: 'snare' | 'medicine' | 'held' | 'disc' | 'key' | 'food' | 'contraband' | 'material';
  basePrice; legal: boolean; effect: ItemEffect }
interface ItemStack { itemId; qty }
interface Shop { id; buildingId; ownerNpcId; factionId | null; stock: { itemId; qty; restockPerDay }[]; markup; blackMarket: boolean }
interface PriceModel { base: number; districtIndex: number; factionTax: number; supplyDemand: number } // price = base × Π
```

## Factions (M3–M4)

```ts
interface Faction { id: FactionId; name; leaderNpcId; ranks: string[]; philosophy;
  resources: { cash; members; wildlingPower; weapons }; stances: Record<FactionId, Stance>;
  grievances: Record<FactionId, number>; agenda: AgendaId; currentPlan: GoapPlan | null; playerRep: number /* -100..100 */; playerRank: number }
type Stance = 'alliance' | 'friendly' | 'business' | 'wary' | 'hostile' | 'war';
interface GoapPlan { goal: GoalId; steps: { actionId; params; status: 'pending' | 'active' | 'done' | 'failed' }[]; createdTick }
```

## Law (M3)

```ts
interface WantedState { stars: 0 | 1 | 2 | 3 | 4 | 5; heat: number; lastKnown: { districtId; x; y; tick } | null;
  activeUnits: UnitId[]; reportsPending: CrimeReport[] }
interface CrimeReport { crime: CrimeKind; witnessNpcId; reportedAtTick; severity }
```

## Vehicles (M3)

```ts
interface VehicleClass { id; name; mass; maxSpeed; accel; brake; grip; turnRate; hp; seats; spriteKey }
interface VehicleState { id; classId; x; y; heading; speed; angularVel; hp; damage: { engine; body }; driverId: string | null;
  ownerFactionId | null; stolen: boolean; colour: number; lane: LaneRef | null }
```

## Missions and story (M4–M5)

```ts
interface MissionTemplate { id; category: MissionCategory; preconditions: Predicate[]; roles: RoleSpec[];
  objectives: ObjectiveSpec[]; failure: FailureSpec[]; rewards: RewardSpec; consequences: Effect[]; text: TextVariants }
interface MissionInstance { id; templateId | null /* null = handcrafted */; seed; boundRoles: Record<string, EntityRef>;
  objectiveStates: ObjectiveState[]; status: 'offered' | 'active' | 'completed' | 'failed' | 'expired'; offeredTick; deadlineTick | null }
type Predicate = { op: 'gte' | 'lte' | 'eq' | 'has' | 'not' | 'and' | 'or'; path?: string; value?: unknown; args?: Predicate[] };
interface StoryState { act: 1 | 2 | 3; flags: Record<string, boolean | number | string>; fragments: FactionId[]; endingId: EndingId | null }
interface DialogueTree { id; nodes: Record<NodeId, { speaker; variants: { when?: Predicate; text: string }[];
  choices: { text; when?: Predicate; effects: Effect[]; next: NodeId | null }[] }> }
```

## Persistence envelope (M2)

```ts
interface SaveFile { format: 'neon-wilds-save'; version: number; createdAt: string; playTimeSeconds: number;
  slot: number; summary: { playerName; district; level; indexCount }; checksum: string /* crc32 */; state: SimSnapshotVN }
```
