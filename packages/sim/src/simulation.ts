import { ambientBark, onShoved, startFlee, updateNpc, walkTo, type NpcContext } from './ai/npcBrain';
import { RUMOUR_TEXT, decayMemories, lineOfSight, relationship, remember, strongest, type MemoryKind } from './ai/memory';
import { type RoutineHooks, newAgent } from './ai/routine';
import { ROUTINES } from './content/schedules';
import { isHealthy, resolveTurn, type BattleContext } from './battle/engine';
import { type BattleState, ZERO_STAGES } from './battle/types';
import {
  DEFAULT_START_MINUTES,
  DT,
  ENTRANCE_RANGE,
  GAME_MINUTES_PER_SECOND,
  INTERACT_RANGE,
  NPC_HALF_EXTENT,
  PATH_BUDGET_PER_TICK,
  PLAYER_ACCEL,
  PLAYER_HALF_EXTENT,
  PLAYER_RUN_SPEED,
  PLAYER_WALK_SPEED,
  TICK_RATE,
  TURN_RATE,
} from './constants';
import { allArchetypes, getDistrictContent, type DistrictContent } from './content';
import { ITEMS, SHOPS } from './content/items';
import { TRAINERS } from './content/trainers';
import type { Appearance, Conversation, NpcArchetype } from './content/types';
import { getSpecies } from './content/wildlings';
import { cloneData } from './core/clone';
import { EventQueue, type SimEvent } from './core/events';
import { Rng, deriveSeed } from './core/rng';
import { clampMagnitude, turnToward } from './core/vec';
import { createWildling, displayName, healFully, maxHp } from './creatures/wildling';
import { migrateSnapshot } from './migrations';
import { checkAutoStart, checkDeadlines, isObjective, offerFrom, startMission, trigger, type MissionHost } from './missions/runtime';
import { type MissionGenContext, generateBoard, generateNpcRequest } from './missions/generator';
import type { Effect } from './missions/types';
import type { WildlingInstance } from './creatures/model';
import { moveAndCollide } from './physics/collision';
import {
  type ProgressionState,
  addItem,
  hasItem,
  markSeen,
  newProgression,
  pruneInventory,
  receiveWildling,
} from './progression';
import {
  SNAPSHOT_VERSION,
  type Focus,
  type NpcState,
  type PlayerInput,
  type PlayerState,
  type SimCommand,
  type SimSnapshot,
} from './state';
import type { Building, DistrictLayout } from './world/district';
import { generateDistrict } from './world/generator';
import { describeLocation } from './world/location';
import { Pathfinder } from './world/pathfinding';
import { RoadNetwork } from './world/roads';
import { type FactionAgent, factionTick, newFactionAgents, noteTerritoryChange } from './factions/strategy';
import { type WorldState, eventActive, newWorldState, worldHour } from './world/director';
import { type LawContext, type LawState, clearWanted, newLawState, onCrime, pursuitTarget, updateLaw } from './law/law';
import { ARCHETYPE_FACTION, repTier } from './content/factions';
import {
  type MarketState,
  type TerritoryState,
  adjustInfluence,
  blockOf,
  newTerritory,
  priceOf,
  recoverDemand,
  wildlingSalePrice,
} from './factions/territory';
import {
  type VehicleContext,
  type VehicleState,
  bodyCircles,
  coast,
  driveAi,
  drivePlayer,
  manageTraffic,
  parkedVehiclesFromLayout,
  resolveVehicleContacts,
  updateWrecks,
  vehicleClass,
} from './world/vehicles';
import { Tile } from './world/tiles';
import {
  type WildlingContext,
  type WildlingEntity,
  findSpawnTile,
  manageSpawns,
  spawnWildling,
  timeOfDay,
  updateWildlings,
} from './world/wildlings';

/** Frozen state of a district the player is not in. */
export interface AwayDistrict {
  npcs: NpcState[];
  wildlings: WildlingEntity[];
  vehicles: VehicleState[];
  territory: TerritoryState;
}

export interface NewGameConfig {
  seed: number;
  playerName: string;
  appearance: Appearance;
  districtId?: string;
  startMinutes?: number;
}

const ENCOUNTER_RADIUS = 0.62;

/**
 * The authoritative game simulation.
 *
 * - Advances in fixed steps of `DT`; never reads wall-clock time.
 * - All randomness comes from a seeded `Rng`.
 * - Receives intent (input + commands), emits events. Rendering, UI and
 *   persistence observe state and events but never mutate state directly.
 */
export class Simulation implements MissionHost {
  layout!: DistrictLayout;
  private content!: DistrictContent;
  private readonly archetypes: Map<string, NpcArchetype>;
  private pedPathfinder!: Pathfinder;
  private creaturePathfinder!: Pathfinder;
  /** Districts the player is not in: their entities wait here, frozen (simulation LOD level 3). */
  private away: Record<string, AwayDistrict> = {};
  private readonly layoutCache = new Map<string, DistrictLayout>();
  private readonly events = new EventQueue();
  private readonly commands: SimCommand[] = [];
  private rng: Rng;
  private _tick: number;
  private _minutes: number;
  private ambientBarkTick: number;
  private _focus: Focus | null = null;
  private encounterCooldownUntilTick: number;
  private nextEntityId: number;
  private pendingEffects: Effect[];
  /** Bumped whenever progression changes so the UI can refresh lazily. */
  private _progressVersion = 0;
  readonly player: PlayerState;
  npcs: NpcState[];
  wildlings: WildlingEntity[];
  readonly progression: ProgressionState;
  vehicles: VehicleState[];
  roads!: RoadNetwork;
  readonly law: LawState;
  territory: TerritoryState;
  readonly market: MarketState;
  private _day: number;
  readonly factionAgents: FactionAgent[];
  private lastControllers: Record<string, string | null>;
  readonly world: WorldState;
  private _battle: BattleState | null;

  private constructor(private readonly seed: number, districtId: string, snapshot: SimSnapshot | null, config: NewGameConfig | null) {
    this.archetypes = new Map(allArchetypes().map((a) => [a.id, a]));
    this.loadDistrict(districtId);

    if (snapshot) {
      this.rng = Rng.fromState(snapshot.rngState);
      this._tick = snapshot.tick;
      this._minutes = snapshot.minutes;
      this.ambientBarkTick = snapshot.ambientBarkTick;
      this.player = cloneData(snapshot.player);
      this.npcs = cloneData(snapshot.npcs);
      this.wildlings = cloneData(snapshot.wildlings);
      this._battle = cloneData(snapshot.battle);
      this.progression = cloneData(snapshot.progression);
      this.pendingEffects = cloneData(snapshot.pendingEffects);
      this.encounterCooldownUntilTick = snapshot.encounterCooldownUntilTick;
      this.nextEntityId = snapshot.nextEntityId;
      this.vehicles = snapshot.vehicles ? cloneData(snapshot.vehicles) : parkedVehiclesFromLayout(this.layout);
      this.law = cloneData(snapshot.law);
      this.territory = snapshot.territory ? cloneData(snapshot.territory) : newTerritory(this.layout);
      this.market = cloneData(snapshot.market);
      this._day = snapshot.day;
      this.factionAgents = snapshot.factions ? cloneData(snapshot.factions.agents) : newFactionAgents();
      this.lastControllers = snapshot.factions ? { ...snapshot.factions.lastControllers } : { ...this.territory.controllers };
      this.world = cloneData(snapshot.world);
      this.away = cloneData(snapshot.away ?? {});
    } else if (config) {
      this.rng = new Rng(deriveSeed(seed, 'simulation'));
      this._tick = 0;
      this._minutes = config.startMinutes ?? DEFAULT_START_MINUTES;
      this.ambientBarkTick = TICK_RATE * 3;
      const spawn = this.layout.playerSpawn;
      this.player = {
        id: 'player',
        name: config.playerName,
        appearance: { ...config.appearance },
        x: spawn.x,
        y: spawn.y,
        prevX: spawn.x,
        prevY: spawn.y,
        heading: Math.PI / 2,
        speed: 0,
        vx: 0,
        vy: 0,
        running: false,
        conversationWith: null,
        vehicleId: null,
      };
      this.npcs = this.spawnNpcs();
      this.wildlings = [];
      this._battle = null;
      this.progression = newProgression();
      this.pendingEffects = [];
      this.encounterCooldownUntilTick = 0;
      this.nextEntityId = 1;
      this.vehicles = parkedVehiclesFromLayout(this.layout);
      this.law = newLawState();
      this.territory = newTerritory(this.layout);
      this.market = { demand: {} };
      this._day = 0;
      this.factionAgents = newFactionAgents();
      this.lastControllers = { ...this.territory.controllers };
      this.world = newWorldState();
      checkAutoStart(this);
    } else {
      throw new Error('Simulation requires a snapshot or a config');
    }
    this.assignAgents();
    this.updateFocus();
  }

  static create(config: NewGameConfig): Simulation {
    return new Simulation(config.seed >>> 0, config.districtId ?? 'slums', null, config);
  }

  /** Restore from any supported snapshot version (older versions are migrated). */
  static fromSnapshot(raw: unknown): Simulation {
    const snapshot = migrateSnapshot(raw);
    return new Simulation(snapshot.seed, snapshot.districtId, snapshot, null);
  }

  // ---------------------------------------------------------------------------
  // Read-only accessors

  get tick(): number {
    return this._tick;
  }

  /** In-game time of day in minutes [0, 1440). */
  get minutes(): number {
    return this._minutes;
  }

  get hour(): number {
    return Math.floor(this._minutes / 60);
  }

  get isNight(): boolean {
    const h = this.hour;
    return h >= 20 || h < 5;
  }

  get focus(): Focus | null {
    return this._focus;
  }

  get battle(): Readonly<BattleState> | null {
    return this._battle;
  }

  get progressVersion(): number {
    return this._progressVersion;
  }

  get districtName(): string {
    return this.layout.name;
  }

  locationLabel(): string {
    return describeLocation(this.layout, this.player.x, this.player.y);
  }

  enqueue(command: SimCommand): void {
    this.commands.push(command);
  }

  drainEvents(): SimEvent[] {
    return this.events.drain();
  }

  emit(event: SimEvent): void {
    this.events.push(event);
  }

  // ---------------------------------------------------------------------------
  // Main step

  step(input: PlayerInput): void {
    this._tick++;
    this.processCommands();
    if (this._battle) return; // the overworld is frozen during turn-based battles

    this.advanceClock();
    const vctx = this.vehicleContext();
    if (input.action) this.toggleVehicle();
    if (this.player.vehicleId) this.updateDriving(input, vctx);
    else this.updatePlayer(input);

    const ctx = this.npcContext();
    // Simulation LOD: far-away NPCs update every 6th tick with a larger time step.
    const farCtx: NpcContext = { ...ctx, dt: DT * 6, minuteDelta: ctx.minuteDelta * 6 };
    farCtx.hooks = this.routineHooks(() => farCtx);
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i]!;
      const far = Math.hypot(npc.x - this.player.x, npc.y - this.player.y) > 45 && npc.mode !== 'talking';
      if (!far) updateNpc(npc, ctx);
      else if ((this._tick + i) % 6 === 0) {
        farCtx.pathBudget = ctx.pathBudget;
        updateNpc(npc, farCtx);
      } else {
        npc.prevX = npc.x;
        npc.prevY = npc.y;
      }
    }
    if (this._tick % 60 === 0) {
      this.manageCrowd();
      checkDeadlines(this, this.now);
    }
    this.reactToPlayer(ctx);
    const wctx = this.wildlingContext(ctx.pathBudget);
    if (this._tick % 30 === 0) manageSpawns(this.wildlings, wctx);
    updateWildlings(this.wildlings, wctx);

    this.updateVehicles(vctx);
    updateLaw(this.law, this.lawContext());
    this.resolveContacts(ctx);
    this.resolveVehicleActorContacts(ctx);
    const driving = this.playerVehicle;
    if (driving) {
      this.player.x = driving.x;
      this.player.y = driving.y;
    }
    this.checkDistrictExit();
    if (!this.player.vehicleId) this.checkEncounters();
    this.updateFocus();
    if (input.interact && !this.player.vehicleId) this.interact();
    this.maybeAmbientBark(ctx);
  }

  snapshot(): SimSnapshot {
    return {
      version: SNAPSHOT_VERSION,
      seed: this.seed,
      districtId: this.layout.id,
      tick: this._tick,
      minutes: this._minutes,
      rngState: this.rng.getState(),
      ambientBarkTick: this.ambientBarkTick,
      player: cloneData(this.player),
      npcs: cloneData(this.npcs),
      wildlings: cloneData(this.wildlings),
      battle: cloneData(this._battle),
      progression: cloneData(this.progression),
      pendingEffects: cloneData(this.pendingEffects),
      encounterCooldownUntilTick: this.encounterCooldownUntilTick,
      nextEntityId: this.nextEntityId,
      vehicles: cloneData(this.vehicles),
      law: cloneData(this.law),
      day: this._day,
      territory: cloneData(this.territory),
      market: cloneData(this.market),
      factions: { agents: cloneData(this.factionAgents), lastControllers: { ...this.lastControllers } },
      world: cloneData(this.world),
      away: cloneData(this.away),
    };
  }

  // ---------------------------------------------------------------------------
  // Mission host

  applyEffect(effect: Effect): void {
    const p = this.progression;
    this._progressVersion++;
    switch (effect.type) {
      case 'message':
        this.emit({ type: 'message', speaker: effect.speaker, pages: effect.pages.map((x) => this.personalise(x)) });
        break;
      case 'give-item':
        addItem(p, effect.item, effect.qty);
        this.emit({ type: 'notice', text: `Received ${effect.qty > 1 ? `${effect.qty}× ` : ''}${ITEMS[effect.item]?.name ?? effect.item}.` });
        break;
      case 'take-item':
        addItem(p, effect.item, -effect.qty);
        break;
      case 'give-money':
        p.money += effect.amount;
        this.emit({ type: 'notice', text: `Received ${effect.amount}₵.` });
        break;
      case 'give-wildling': {
        const w = createWildling(effect.species, effect.level, this.rng, this.newUid(), this._tick);
        const where = receiveWildling(p, w);
        this.emit({ type: 'wildling.received', speciesId: effect.species, destination: where });
        break;
      }
      case 'spawn-npc': {
        const npc = this.npcs.find((n) => n.id === effect.npc);
        if (!npc) {
          const elsewhere = this.findNpcAnywhere(effect.npc);
          if (elsewhere) elsewhere.present = true; // appears when the player returns
          break;
        }
        const b = this.layout.buildings.find((x) => x.name === effect.near);
        if (!npc || !b) break;
        const spot = this.freeTileNear(b.entrance.tx, b.entrance.ty, b);
        npc.present = true;
        npc.x = npc.prevX = spot.tx + 0.5;
        npc.y = npc.prevY = spot.ty + 0.5;
        npc.mode = npc.stationary ? 'stationary' : 'idle';
        break;
      }
      case 'despawn-npc': {
        const npc = this.findNpcAnywhere(effect.npc);
        if (npc) npc.present = false;
        break;
      }
      case 'start-trainer-battle':
        this.startTrainerBattle(effect.npc);
        break;
      case 'spawn-quest-wildling': {
        const tile = findSpawnTile({ layout: this.layout, rng: this.rng, player: this.player }, [Tile.Alley], 10, 30);
        if (tile) spawnWildling(this.wildlings, this.spawnCtx(), effect.species, effect.level, tile, null, effect.tag);
        break;
      }
      case 'set-flag':
        p.flags[effect.flag] = true;
        break;
      case 'reputation':
        this.changeReputation(effect.faction, effect.delta);
        break;
      case 'take-wildling': {
        const fromStorage = p.storage.findIndex((w) => w.speciesId === effect.species);
        if (fromStorage >= 0) p.storage.splice(fromStorage, 1);
        else {
          const i = p.party.findIndex((w) => w.speciesId === effect.species);
          if (i >= 0 && p.party.length > 1) p.party.splice(i, 1);
        }
        break;
      }
      case 'remember': {
        const npc = this.findNpcAnywhere(effect.npc);
        if (npc) remember(npc.memory, { kind: effect.kind, salience: 1, important: effect.important, secondhand: false, at: this.now });
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Commands

  private processCommands(): void {
    for (const cmd of this.commands.splice(0)) {
      switch (cmd.type) {
        case 'endDialogue':
          this.endDialogue();
          break;
        case 'battle.action':
          this.battleAction(cmd.action);
          break;
        case 'item.use':
          this.useItemOverworld(cmd.itemId, cmd.partyIndex);
          break;
        case 'party.setLead': {
          const party = this.progression.party;
          if (this._battle || cmd.partyIndex <= 0 || cmd.partyIndex >= party.length) break;
          const [w] = party.splice(cmd.partyIndex, 1);
          if (w) party.unshift(w);
          this._progressVersion++;
          break;
        }
        case 'party.deposit': {
          const party = this.progression.party;
          if (this._battle || party.length <= 1 || !party[cmd.partyIndex]) break;
          const [w] = party.splice(cmd.partyIndex, 1);
          if (w) this.progression.storage.push(w);
          this._progressVersion++;
          break;
        }
        case 'party.withdraw': {
          const p = this.progression;
          if (this._battle || p.party.length >= 6 || !p.storage[cmd.storageIndex]) break;
          const [w] = p.storage.splice(cmd.storageIndex, 1);
          if (w) p.party.push(w);
          this._progressVersion++;
          break;
        }
        case 'shop.buy':
          this.buy(cmd.shopId, cmd.itemId, cmd.qty);
          break;
        case 'market.sellWildling':
          this.sellWildling(cmd.from, cmd.index);
          break;
        case 'mission.accept': {
          const def = this.progression.generated.find((m) => m.id === cmd.missionId);
          if (def && !def.giver && this.progression.board.includes(def.id)) {
            startMission(this, def);
            this._progressVersion++;
          }
          break;
        }
      }
    }
  }

  private endDialogue(): void {
    const id = this.player.conversationWith;
    if (id) {
      this.player.conversationWith = null;
      const npc = this.npcs.find((n) => n.id === id);
      if (npc && npc.mode === 'talking') {
        npc.mode = npc.stationary ? 'stationary' : 'idle';
        npc.timer = 1.5;
      }
      this.emit({ type: 'dialogue.closed', npcId: id });
    }
    const pending = this.pendingEffects.splice(0);
    for (const e of pending) this.applyEffect(e);
  }

  private buy(shopId: string, itemId: string, qty: number): void {
    const shop = SHOPS[shopId];
    const item = ITEMS[itemId];
    if (!shop || !item || !shop.items.includes(itemId) || qty < 1 || qty > 99) return;
    const cost = this.shopPrice(shopId, itemId) * qty;
    if (this.progression.money < cost) {
      this.emit({ type: 'notice', text: "You can't afford that." });
      return;
    }
    this.progression.money -= cost;
    addItem(this.progression, itemId, qty);
    this._progressVersion++;
    this.emit({ type: 'notice', text: `Bought ${qty}× ${item.name} for ${cost}₵.` });
  }

  private useItemOverworld(itemId: string, partyIndex: number): void {
    const def = ITEMS[itemId];
    const w = this.progression.party[partyIndex];
    if (this._battle || !def || def.category !== 'medicine' || !w || !hasItem(this.progression, itemId)) return;
    if (w.hp <= 0 && !def.heal) return;
    const max = maxHp(w);
    if (def.heal && w.hp >= max && !(def.cures && w.status)) {
      this.emit({ type: 'notice', text: 'It would have no effect.' });
      return;
    }
    if (def.heal) w.hp = Math.min(max, w.hp + def.heal);
    if (def.cures) w.status = null;
    addItem(this.progression, itemId, -1);
    this._progressVersion++;
    this.emit({ type: 'notice', text: `${displayName(w)} was treated with a ${def.name}.` });
  }

  // ---------------------------------------------------------------------------
  // Battles

  private startWildBattle(entity: WildlingEntity): void {
    const enemy = createWildling(entity.speciesId, entity.level, this.rng, this.newUid(), this._tick);
    enemy.loyalty = 70;
    enemy.friendship = 50;
    const tile = this.layout.map.get(Math.floor(this.player.x), Math.floor(this.player.y));
    const firstStrike = entity.mode === 'sleep';
    this.beginBattle({
      kind: 'wild',
      trainerId: null,
      trainerName: null,
      ai: 'wild',
      party: [enemy],
      items: {},
      reward: 0,
      wildEntityId: entity.id,
      questTag: entity.questTag,
      firstStrike,
      terrain: tile === Tile.Grass ? 'park' : tile === Tile.Alley ? 'alley' : 'street',
    });
    const name = getSpecies(entity.speciesId).name;
    this.emit({
      type: 'battle.started',
      battleId: this._battle!.id,
      kind: 'wild',
      intro: firstStrike ? `You crept up on a sleeping ${name}!` : `A wild ${name} appeared!`,
    });
  }

  private startTrainerBattle(npcId: string): void {
    const t = TRAINERS[npcId];
    if (!t || !this.progression.party.some(isHealthy)) return;
    const party = t.party.map((m) => createWildling(m.species, m.level, this.rng, this.newUid(), this._tick));
    const tile = this.layout.map.get(Math.floor(this.player.x), Math.floor(this.player.y));
    this.beginBattle({
      kind: 'trainer',
      trainerId: npcId,
      trainerName: t.name,
      ai: t.ai,
      party,
      items: { ...t.items },
      reward: t.reward,
      wildEntityId: null,
      questTag: null,
      firstStrike: false,
      terrain: tile === Tile.Grass ? 'park' : tile === Tile.Alley ? 'alley' : 'street',
    });
    this.emit({
      type: 'battle.started',
      battleId: this._battle!.id,
      kind: 'trainer',
      intro: `${t.name} wants to battle! ${t.name} sends out ${getSpecies(t.party[0]!.species).name}!`,
    });
  }

  private beginBattle(o: {
    kind: 'wild' | 'trainer';
    trainerId: string | null;
    trainerName: string | null;
    ai: BattleState['ai'];
    party: BattleState['enemy']['party'];
    items: Record<string, number>;
    reward: number;
    wildEntityId: string | null;
    questTag: string | null;
    firstStrike: boolean;
    terrain: BattleState['env']['terrain'];
  }): void {
    const lead = Math.max(0, this.progression.party.findIndex(isHealthy));
    const leadUid = this.progression.party[lead]?.uid;
    for (const w of o.party) markSeen(this.progression, w.speciesId);
    this._battle = {
      id: `battle-${this._tick}`,
      kind: o.kind,
      trainerId: o.trainerId,
      trainerName: o.trainerName,
      ai: o.ai,
      env: { night: this.isNight, terrain: o.terrain },
      turn: 1,
      phase: 'choose',
      outcome: null,
      player: { active: lead, stages: { ...ZERO_STAGES }, participants: leadUid ? [leadUid] : [] },
      enemy: { party: o.party, active: 0, stages: { ...ZERO_STAGES }, items: o.items, lastSwitchTurn: 0 },
      firstStrike: o.firstStrike,
      fleeAttempts: 0,
      wildEntityId: o.wildEntityId,
      questTag: o.questTag,
      rewardMoney: o.reward,
    };
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.running = false;
    this._progressVersion++;
  }

  private battleAction(action: Parameters<typeof resolveTurn>[1]): void {
    const battle = this._battle;
    if (!battle) return;
    const ctx: BattleContext = { battle, playerParty: this.progression.party, inventory: this.progression.inventory, rng: this.rng };
    const entries = resolveTurn(ctx, action);
    pruneInventory(this.progression);
    this._progressVersion++;
    this.emit({ type: 'battle.log', battleId: battle.id, entries });
    if (battle.phase === 'ended' && battle.outcome) this.finishBattle(battle);
  }

  private finishBattle(battle: BattleState): void {
    const outcome = battle.outcome!;
    const p = this.progression;
    this._battle = null;
    this.encounterCooldownUntilTick = this._tick + TICK_RATE * 3;
    const entityIndex = this.wildlings.findIndex((w) => w.id === battle.wildEntityId);
    const entity = entityIndex >= 0 ? this.wildlings[entityIndex] : undefined;

    switch (outcome) {
      case 'captured': {
        const caught = battle.enemy.party[battle.enemy.active];
        if (caught) {
          caught.status = null;
          const where = receiveWildling(p, caught);
          this.emit({ type: 'wildling.received', speciesId: caught.speciesId, destination: where });
        }
        if (entity) this.wildlings.splice(entityIndex, 1);
        break;
      }
      case 'win':
        if (entity) this.wildlings.splice(entityIndex, 1);
        if (battle.kind === 'trainer' && battle.trainerId) {
          p.money += battle.rewardMoney;
          if (!p.defeatedTrainers.includes(battle.trainerId)) p.defeatedTrainers.push(battle.trainerId);
          this.witnessMemory(this.player.x, this.player.y, 'saw-battle-win', 0.6, 10);
          const npc = this.npcs.find((n) => n.id === battle.trainerId);
          const faction = npc ? ARCHETYPE_FACTION[npc.archetypeId] : undefined;
          if (faction === 'halcyon') {
            this.changeReputation('halcyon', -8);
            this.changeReputation('saints', 4);
            const block = blockOf(this.layout, this.player.x, this.player.y);
            if (block) {
              adjustInfluence(this.territory, block.id, 'halcyon', -15, this.events);
              adjustInfluence(this.territory, block.id, 'saints', 10, this.events);
            }
          } else if (faction) {
            this.changeReputation(faction, 3);
          }
        }
        break;
      case 'fled':
        if (entity) {
          entity.calmUntilTick = this._tick + TICK_RATE * 6;
          entity.mode = 'idle';
          entity.timer = 0;
        }
        break;
      case 'lose':
        this.blackout();
        if (entity) entity.calmUntilTick = this._tick + TICK_RATE * 10;
        break;
    }
    this.emit({ type: 'battle.ended', battleId: battle.id, outcome });
    if ((outcome === 'win' || outcome === 'captured') && battle.questTag) trigger(this, 'resolve-tag', battle.questTag);
    if (outcome === 'win' && battle.trainerId) trigger(this, 'defeat', battle.trainerId);
    if (outcome === 'captured') {
      const caught = battle.enemy.party[battle.enemy.active];
      if (caught) trigger(this, 'capture', caught.speciesId);
    }
    this._progressVersion++;
  }

  private blackout(): void {
    const clinic = this.layout.buildings.find((b) => b.service?.kind === 'clinic');
    const lost = Math.floor(this.progression.money * 0.1);
    this.progression.money -= lost;
    for (const w of this.progression.party) healFully(w, true);
    if (clinic) {
      this.player.x = this.player.prevX = clinic.entrance.tx + 0.5;
      this.player.y = this.player.prevY = clinic.entrance.ty + 0.5;
    }
    this.player.vx = this.player.vy = 0;
    clearWanted(this.law, { events: this.events, vehicles: this.vehicles });
    this.emit({ type: 'blackout', lostMoney: lost });
    this.emit({
      type: 'message',
      speaker: 'Needle',
      pages: [`Easy, ${this.player.name}. Someone carried you and your Wildlings here. They're patched up — try not to make a habit of it.`],
    });
  }

  private checkEncounters(): void {
    if (this._tick < this.encounterCooldownUntilTick || this.player.conversationWith) return;
    const canBattle = this.progression.party.some(isHealthy);
    for (const w of this.wildlings) {
      if (this._tick < w.calmUntilTick) continue;
      if (Math.hypot(w.x - this.player.x, w.y - this.player.y) > ENCOUNTER_RADIUS) continue;
      if (canBattle) {
        this.startWildBattle(w);
      } else {
        w.calmUntilTick = this._tick + TICK_RATE * 5;
        this.encounterCooldownUntilTick = this._tick + TICK_RATE * 5;
        this.emit({ type: 'notice', text: `The ${getSpecies(w.speciesId).name} hisses. You have no Wildlings to battle with!` });
      }
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Overworld

  private spawnNpcs(): NpcState[] {
    const spawns = this.layout.pedestrianSpawns.filter(
      (s) => Math.hypot(s.tx + 0.5 - this.player.x, s.ty + 0.5 - this.player.y) > 4,
    );
    return this.content.npcs.map((def) => {
      const archetype = this.archetype(def.archetype);
      const tile = this.rng.pick(spawns);
      const x = tile.tx + 0.5;
      const y = tile.ty + 0.5;
      const stationary = def.stationary ?? false;
      return {
        id: def.id,
        name: def.name,
        archetypeId: def.archetype,
        appearance: { ...def.appearance },
        x,
        y,
        prevX: x,
        prevY: y,
        heading: this.rng.range(-Math.PI, Math.PI),
        speed: 0,
        walkSpeed: archetype.walkSpeed * this.rng.range(0.9, 1.1),
        mode: stationary ? 'stationary' : 'idle',
        timer: this.rng.range(0, 2),
        path: [],
        pathIndex: 0,
        stuckTime: 0,
        grudgeUntilTick: 0,
        shoveCooldownUntilTick: 0,
        nextBarkTick: TICK_RATE * this.rng.int(5, 30),
        present: (def.spawn ?? 'start') === 'start',
        stationary,
        agent: null,
        indoors: null,
        transient: false,
        memory: [],
      } satisfies NpcState;
    });
  }

  /** Give every non-scripted NPC a home, a workplace and a daily routine (deterministic per NPC). */
  private assignAgents(): void {
    const homes = this.layout.buildings.filter((b) => b.kind === 'residential');
    const workshops = this.layout.buildings.filter((b) => b.kind === 'workshop');
    const offices = this.layout.buildings.filter((b) => b.kind === 'office' || b.kind === 'warehouse' || b.kind === 'shop');
    const square = this.layout.blocks.find((b) => b.kind === 'square');
    this.npcs.forEach((npc, i) => {
      if (npc.agent || npc.stationary || npc.transient) return;
      const routine = ROUTINES[npc.archetypeId];
      if (!routine) return;
      const pick = <T,>(list: T[], salt: number): T | null => (list.length ? list[(i * 7 + salt) % list.length]! : null);
      let workId: string | null = null;
      let workSpot: { tx: number; ty: number } | null = null;
      if (routine.workplace === 'workshop') workId = pick(workshops, 1)?.id ?? null;
      if (routine.workplace === 'office') workId = pick(offices, 3)?.id ?? null;
      if (routine.workplace === 'stall' && square) {
        const tx = square.x + 3 + ((i * 5) % Math.max(1, square.w - 6));
        workSpot = this.layout.map.isPedestrianWalkable(tx, square.y + 2) ? { tx, ty: square.y + 2 } : { tx: square.x + 1, ty: square.y + 1 };
      }
      npc.agent = newAgent(pick(homes, 0)?.id ?? null, workId, workSpot, i * 31 + 7);
    });
  }

  get now(): number {
    return this._day * 1440 + this._minutes;
  }

  private routineHooks(ctx: () => NpcContext): RoutineHooks {
    const map = this.layout.map;
    return {
      walkTo: (npc, tx, ty) => walkTo(npc, tx, ty, ctx()),
      isWalking: (npc) => npc.mode === 'walking',
      patrolTile: (npc) => {
        const faction = ARCHETYPE_FACTION[npc.archetypeId];
        const own = npc.agent?.patrolBlock;
        const blocks = own
          ? this.layout.blocks.filter((b) => b.id === own)
          : this.layout.blocks.filter((b) => faction && this.territory.controllers[b.id] === faction);
        if (!blocks.length) return null;
        const b = this.rng.pick(blocks);
        for (let k = 0; k < 6; k++) {
          const tx = b.x + this.rng.int(0, b.w - 1);
          const ty = this.rng.chance(0.5) ? b.y : b.y + b.h - 1;
          if (map.isPedestrianWalkable(tx, ty)) return { tx, ty };
        }
        return null;
      },
      nearbyTile: (x, y, r) => {
        for (let k = 0; k < 10; k++) {
          const tx = Math.floor(x) + this.rng.int(-r, r);
          const ty = Math.floor(y) + this.rng.int(-r, r);
          if (map.isPedestrianWalkable(tx, ty)) return { tx, ty };
        }
        return null;
      },
      buildingEntrance: (id) => {
        const b = this.layout.buildings.find((x) => x.id === id);
        return b ? b.entrance : null;
      },
      foodPlace: (npc) => {
        let best: { id: string; tx: number; ty: number } | null = null;
        let bestD = Infinity;
        for (const b of this.layout.buildings) {
          if (b.name !== 'Glow Noodle' && b.name !== "Mother Rook's Kitchen") continue;
          const d = Math.hypot(b.entrance.tx - npc.x, b.entrance.ty - npc.y);
          if (d < bestD) {
            bestD = d;
            best = { id: b.id, tx: b.entrance.tx, ty: b.entrance.ty };
          }
        }
        return best;
      },
      findFriend: (npc) => {
        let best: NpcState | null = null;
        let bestD = 25;
        for (const o of this.npcs) {
          if (o === npc || !o.present || o.indoors || !o.agent || o.transient) continue;
          if (o.mode !== 'idle' && o.mode !== 'walking') continue;
          if (o.agent.activity === 'sleep' || o.agent.activity === 'listen' || o.agent.activity === 'commute') continue;
          const d = Math.hypot(o.x - npc.x, o.y - npc.y) * (o.archetypeId === npc.archetypeId ? 0.6 : 1);
          if (d < bestD) {
            bestD = d;
            best = o;
          }
        }
        return best;
      },
      npcById: (id) => this.npcs.find((n) => n.id === id) ?? null,
      despawn: (npc) => {
        npc.present = false;
      },
    };
  }

  /** Background crowd: unnamed pedestrians whose density follows the time of day. */
  private manageCrowd(): void {
    const p = this.player;
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i]!;
      if (!n.transient) continue;
      const crew = n.id.startsWith('crew-') && n.agent?.patrolBlock;
      if (!n.present || (!crew && Math.hypot(n.x - p.x, n.y - p.y) > 42 && n.mode !== 'talking')) this.npcs.splice(i, 1);
    }
    const h = this.hour;
    const base = h >= 23 || h < 5 ? 5 : h < 9 ? 14 : h < 17 ? 18 : 24;
    const desired = Math.round(base * (eventActive(this.world, 'night-market') ? 1.8 : 1) * (this.world.weather === 'storm' ? 0.4 : this.world.weather === 'rain' ? 0.7 : 1));
    const count = this.npcs.filter((n) => n.transient && !n.id.startsWith('crew-')).length;
    if (count >= desired) return;
    const spawns = this.layout.pedestrianSpawns;
    for (let k = 0; k < 6; k++) {
      const t = this.rng.pick(spawns);
      const d = Math.hypot(t.tx - p.x, t.ty - p.y);
      if (d < 16 || d > 30) continue;
      this.spawnCitizen(t.tx + 0.5, t.ty + 0.5, false);
      return;
    }
  }

  private spawnCitizen(x: number, y: number, fleeing: boolean): NpcState {
    const SKIN = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a1e];
    const TOPS = [0x5c7a99, 0x8d6e63, 0x6b705c, 0x4a5568, 0x9b2335, 0xb5838d, 0x2a9d8f, 0xe07a5f, 0x3d405b];
    const HAIR = [0x111111, 0x3a2412, 0x6b4a2a, 0xbbbbbb, 0x2b1a0e];
    const homes = this.layout.buildings.filter((b) => b.kind === 'residential');
    const npc: NpcState = {
      id: `citizen-${this.nextEntityId++}`,
      name: 'Passer-by',
      archetypeId: 'citizen',
      appearance: { skin: this.rng.pick(SKIN), hair: this.rng.pick(HAIR), top: this.rng.pick(TOPS), bottom: this.rng.pick([0x22333b, 0x2b2b3a, 0x3d405b, 0x1a202c]) },
      x,
      y,
      prevX: x,
      prevY: y,
      heading: this.rng.range(-Math.PI, Math.PI),
      speed: 0,
      walkSpeed: this.rng.range(1.9, 2.8),
      mode: 'idle',
      timer: 0,
      path: [],
      pathIndex: 0,
      stuckTime: 0,
      grudgeUntilTick: 0,
      shoveCooldownUntilTick: 0,
      nextBarkTick: this._tick + TICK_RATE * this.rng.int(10, 40),
      present: true,
      stationary: false,
      agent: newAgent(homes.length ? this.rng.pick(homes).id : null, null, null, this.rng.int(0, 99)),
      indoors: null,
      transient: true,
      memory: [],
    };
    this.npcs.push(npc);
    if (fleeing) startFlee(npc, this.player.x, this.player.y, this.npcContext());
    return npc;
  }

  /** NPCs react to the player according to what they remember (AI.md §2.2–2.4). */
  private reactToPlayer(ctx: NpcContext): void {
    if (this._tick % 20 !== 0 || this.player.vehicleId) return;
    const p = this.player;
    for (const npc of this.npcs) {
      if (!npc.present || npc.indoors || !npc.agent || npc.memory.length === 0) continue;
      if (npc.mode !== 'idle' && npc.mode !== 'walking') continue;
      const d = Math.hypot(npc.x - p.x, npc.y - p.y);
      if (d > 5 || this._tick < npc.nextBarkTick || !lineOfSight(this.layout.map, npc.x, npc.y, p.x, p.y)) continue;
      const rel = relationship(npc.memory);
      const temperament = this.archetype(npc.archetypeId).temperament;
      if (rel.fear > 0.45 && temperament === 'timid') {
        ctx.events.push({ type: 'bark', actorId: npc.id, text: this.rng.pick(['Stay away from me!', 'Not you again!', "Please, I don't want trouble."]), emote: 'alarm' });
        startFlee(npc, p.x, p.y, ctx);
      } else if (rel.affection < -0.35) {
        ctx.events.push({ type: 'bark', actorId: npc.id, text: this.rng.pick(['You again?', 'Keep walking.', "I've heard about you."]), emote: 'anger' });
      } else if (rel.affection > 0.3 || rel.respect > 0.35) {
        ctx.events.push({ type: 'bark', actorId: npc.id, text: this.rng.pick([`Hey, ${p.name}!`, `Evening, ${p.name}.`, 'Good to see you.']), emote: 'chatter' });
      } else continue;
      npc.nextBarkTick = this._tick + TICK_RATE * this.rng.int(20, 40);
    }
  }

  /** Everyone within sight who could see (x, y) remembers it. */
  private witnessMemory(x: number, y: number, kind: MemoryKind, salience: number, radius: number, exclude?: string): void {
    for (const npc of this.npcs) {
      if (!npc.present || npc.indoors || npc.id === exclude) continue;
      if (Math.hypot(npc.x - x, npc.y - y) > radius) continue;
      if (!lineOfSight(this.layout.map, npc.x, npc.y, x, y)) continue;
      remember(npc.memory, { kind, salience, important: false, secondhand: false, at: this.now });
    }
  }

  private archetype(id: string): NpcArchetype {
    const a = this.archetypes.get(id);
    if (!a) throw new Error(`Unknown NPC archetype "${id}"`);
    return a;
  }

  private npcContext(): NpcContext {
    const ctx: NpcContext = {
      layout: this.layout,
      rng: this.rng,
      events: this.events,
      pathfinder: this.pedPathfinder,
      tick: this._tick,
      player: this.player,
      archetype: (id) => this.archetype(id),
      pathBudget: { remaining: PATH_BUDGET_PER_TICK },
      dt: DT,
      now: this.now,
      minuteDelta: DT * GAME_MINUTES_PER_SECOND,
      hooks: undefined as unknown as RoutineHooks,
    };
    ctx.hooks = this.routineHooks(() => ctx);
    return ctx;
  }

  private spawnCtx() {
    return { rng: this.rng, tick: this._tick, nextId: () => `wild-${this.nextEntityId++}` };
  }

  private wildlingContext(pathBudget: { remaining: number }): WildlingContext {
    return {
      ...this.spawnCtx(),
      layout: this.layout,
      pathfinder: this.creaturePathfinder,
      timeOfDay: timeOfDay(this._minutes),
      player: this.player,
      playerCanBattle: this.progression.party.some(isHealthy),
      weather: this.world.weather,
      blackout: eventActive(this.world, 'blackout'),
      pathBudget: { remaining: Math.max(2, pathBudget.remaining) },
    };
  }

  private newUid(): string {
    return `w${this.progression.nextUid++}`;
  }

  private freeTileNear(tx: number, ty: number, avoid: Building): { tx: number; ty: number } {
    const map = this.layout.map;
    for (let r = 1; r < 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = tx + dx;
          const y = ty + dy;
          const onEntrance = x === avoid.entrance.tx && y === avoid.entrance.ty;
          if (!onEntrance && map.isPedestrianWalkable(x, y)) return { tx: x, ty: y };
        }
      }
    }
    return { tx, ty };
  }

  // ---------------------------------------------------------------------------
  // Vehicles

  private vehicleContext(): VehicleContext {
    const p = this.player;
    const obstacles: { x: number; y: number }[] = [];
    if (!p.vehicleId) obstacles.push(p);
    for (const n of this.npcs) if (n.present && !n.indoors) obstacles.push(n);
    for (const w of this.wildlings) obstacles.push(w);
    return {
      layout: this.layout,
      roads: this.roads,
      rng: this.rng,
      events: this.events,
      tick: this._tick,
      obstacles,
      pursuit: pursuitTarget(this.law),
      playerVehicleId: p.vehicleId,
      signalsOff: eventActive(this.world, 'blackout'),
      nextId: () => `car-${this.nextEntityId++}`,
    };
  }

  private lawContext(): LawContext {
    return {
      layout: this.layout,
      roads: this.roads,
      rng: this.rng,
      events: this.events,
      tick: this._tick,
      player: this.player,
      playerVehicle: this.playerVehicle,
      npcs: this.npcs,
      vehicles: this.vehicles,
      pathfinder: this.creaturePathfinder,
      archetypeOf: (npc) => this.archetype(npc.archetypeId),
      nextId: () => `car-${this.nextEntityId++}`,
      bust: () => this.bust(),
      charge: (amount) => {
        if (this.progression.money < amount) return false;
        this.progression.money -= amount;
        this._progressVersion++;
        return true;
      },
    };
  }

  /** Arrested: fined, released at the Warden substation, wanted level cleared. */
  private bust(): void {
    const v = this.playerVehicle;
    if (v) {
      v.driver = 'none';
      this.player.vehicleId = null;
    }
    const lost = Math.floor(this.progression.money * 0.2);
    this.progression.money -= lost;
    this._progressVersion++;
    const station = this.layout.buildings.find((b) => b.name === 'Warden Substation 14');
    if (station) {
      this.player.x = this.player.prevX = station.entrance.tx + 0.5;
      this.player.y = this.player.prevY = station.entrance.ty + 0.5;
    }
    this.player.vx = this.player.vy = 0;
    clearWanted(this.law, { events: this.events, vehicles: this.vehicles });
    this.changeReputation('wardens', -5);
    this.emit({ type: 'busted', lostMoney: lost });
    this.emit({
      type: 'message',
      speaker: 'Sergeant Pell',
      pages: [`Name? ${this.player.name}. Uh-huh. That'll be ${lost}₵ in "processing fees". Don't let me see you again tonight.`],
    });
  }

  get playerVehicle(): VehicleState | null {
    const id = this.player.vehicleId;
    return id ? (this.vehicles.find((v) => v.id === id) ?? null) : null;
  }

  /** Nearest enterable vehicle within reach of the player on foot. */
  nearbyVehicle(): VehicleState | null {
    let best: VehicleState | null = null;
    let bestD = 1.9;
    for (const v of this.vehicles) {
      if (v.wreckedTick !== null || v.driver === 'police') continue;
      const d = Math.hypot(v.x - this.player.x, v.y - this.player.y);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  private toggleVehicle(): void {
    const p = this.player;
    if (p.conversationWith) return;
    const current = this.playerVehicle;
    if (current) {
      if (Math.abs(current.speed) > 3) return;
      const f = { x: Math.cos(current.heading), y: Math.sin(current.heading) };
      const side = vehicleClass(current).width / 2 + 0.45;
      for (const s of [-1, 1]) {
        const x = current.x + f.y * side * s;
        const y = current.y - f.x * side * s;
        if (!this.layout.map.isSolid(Math.floor(x), Math.floor(y))) {
          p.x = p.prevX = x;
          p.y = p.prevY = y;
          break;
        }
      }
      current.driver = 'none';
      p.vehicleId = null;
      p.vx = p.vy = 0;
      this.emit({ type: 'vehicle.exited', vehicleId: current.id });
      return;
    }
    const v = this.nearbyVehicle();
    if (!v) return;
    let how: 'own' | 'stolen' | 'carjacked' = 'own';
    if (v.driver === 'ai') {
      how = 'carjacked';
      this.reportCrime('carjacking', v.x, v.y, 3);
      this.emit({ type: 'notice', text: 'The driver scrambles out, screaming for the Wardens.' });
    } else if (!v.stolen) {
      how = 'stolen';
      this.reportCrime('vehicle-theft', v.x, v.y, 1);
    }
    v.driver = 'player';
    v.ai = null;
    v.stolen = true;
    p.vehicleId = v.id;
    p.running = false;
    this.emit({ type: 'vehicle.entered', vehicleId: v.id, how });
  }

  private updateDriving(input: PlayerInput, vctx: VehicleContext): void {
    const v = this.playerVehicle;
    const p = this.player;
    if (!v) {
      p.vehicleId = null;
      return;
    }
    drivePlayer(v, { throttle: -input.moveY, steer: input.moveX, handbrake: input.run }, vctx);
    p.prevX = p.x;
    p.prevY = p.y;
    p.x = v.x;
    p.y = v.y;
    p.heading = v.heading;
    p.speed = Math.abs(v.speed);
    p.running = false;
    if (v.wreckedTick !== null) {
      // Bail out of a wreck.
      this.toggleVehicleForce(v);
    }
  }

  private toggleVehicleForce(v: VehicleState): void {
    const before = v.speed;
    v.speed = 0;
    this.toggleVehicle();
    v.speed = before;
    if (this.player.vehicleId) {
      this.player.vehicleId = null;
      v.driver = 'none';
    }
  }

  private updateVehicles(vctx: VehicleContext): void {
    if (this._tick % 30 === 0) manageTraffic(this.vehicles, vctx, this.player);
    for (const v of this.vehicles) {
      if (v.driver === 'player') continue;
      if (v.driver === 'ai' || v.driver === 'police') driveAi(v, this.vehicles, vctx);
      else coast(v, vctx);
    }
    resolveVehicleContacts(this.vehicles, vctx);
    updateWrecks(this.vehicles, vctx);
  }

  /** Keep people and Wildlings out of car bodies; fast player cars knock them flying. */
  private resolveVehicleActorContacts(ctx: NpcContext): void {
    const p = this.player;
    for (const v of this.vehicles) {
      const speed = Math.hypot(v.vx, v.vy);
      for (const c of bodyCircles(v)) {
        if (!p.vehicleId) pushOut(p, c, PLAYER_HALF_EXTENT, this.layout);
        for (const npc of this.npcs) {
          if (!npc.present || npc.indoors) continue;
          if (pushOut(npc, c, NPC_HALF_EXTENT, this.layout) && speed > 1.5 && v.driver === 'player' && this._tick >= npc.shoveCooldownUntilTick) {
            onShoved(npc, this.npcs, ctx);
            remember(npc.memory, { kind: 'hit-by-car', salience: 1, important: false, secondhand: false, at: this.now });
            this.reportCrime('hit-pedestrian', npc.x, npc.y, 2);
            const faction = ARCHETYPE_FACTION[npc.archetypeId];
            if (faction) this.changeReputation(faction, -6);
          }
        }
        for (const w of this.wildlings) {
          if (pushOut(w, c, 0.25, this.layout) && speed > 1.5) w.calmUntilTick = this._tick + TICK_RATE * 3;
        }
      }
    }
  }

  /** Record a crime. Witnesses and the wanted level are handled by the law system. */
  reportCrime(kind: import('./core/events').CrimeKind, x: number, y: number, severity: number): void {
    const witnessed = onCrime(this.law, this.lawContext(), kind, x, y, severity);
    if (severity >= 1) this.witnessMemory(x, y, 'witnessed-crime', Math.min(1, 0.3 + severity * 0.15), 9);
    if (witnessed && severity >= 1) this.changeReputation('wardens', -Math.round(severity * 2));
  }

  private advanceClock(): void {
    const before = this.hour;
    const next = this._minutes + DT * GAME_MINUTES_PER_SECOND;
    if (next >= 1440) this._day++;
    this._minutes = next % 1440;
    const after = this.hour;
    if (after !== before) {
      this.events.push({ type: 'clock.hour', hour: after });
      this.strategyHour();
      this.missionHour();
      for (const npc of this.npcs) decayMemories(npc.memory);
      recoverDemand(this.market);
      this._progressVersion++;
    }
  }

  // ---------------------------------------------------------------------------
  // City graph: districts and travel

  private loadDistrict(id: string): void {
    this.content = getDistrictContent(id);
    let layout = this.layoutCache.get(id);
    if (!layout) {
      layout = generateDistrict(this.content.district, this.seed);
      this.layoutCache.set(id, layout);
    }
    this.layout = layout;
    const map = layout.map;
    this.pedPathfinder = new Pathfinder({ width: map.width, height: map.height, passable: (tx, ty) => map.isPedestrianWalkable(tx, ty) });
    this.creaturePathfinder = new Pathfinder({ width: map.width, height: map.height, passable: (tx, ty) => !map.isSolid(tx, ty) });
    this.roads = new RoadNetwork(layout);
  }

  layoutOf(id: string): DistrictLayout {
    if (id === this.layout.id) return this.layout;
    let layout = this.layoutCache.get(id);
    if (!layout) {
      layout = generateDistrict(getDistrictContent(id).district, this.seed);
      this.layoutCache.set(id, layout);
    }
    return layout;
  }

  get districtId(): string {
    return this.layout.id;
  }

  /** Is a district reachable yet? Downtown opens once Last Run is done. */
  isUnlocked(id: string): boolean {
    if (id === 'slums') return true;
    return this.progression.missions.some((m) => m.id === 'last-run' && m.status === 'completed');
  }

  /** World position of the exit from the current district toward `to`, if any. */
  exitToward(to: string): { x: number; y: number } | null {
    const exit = this.layout.exits.find((e) => e.to === to);
    const band = exit && this.layout.streets.find((st) => st.axis === 'horizontal' && st.name === exit.street);
    if (!exit || !band) return null;
    return { x: exit.side === 'east' ? this.layout.map.width - 1.5 : 1.5, y: band.from + 2.5 };
  }

  /** Which district an NPC currently lives in (active or away). */
  npcDistrict(id: string): string | null {
    if (this.npcs.some((n) => n.id === id)) return this.layout.id;
    for (const [d, state] of Object.entries(this.away)) if (state.npcs.some((n) => n.id === id)) return d;
    return null;
  }

  private findNpcAnywhere(id: string): NpcState | undefined {
    return this.npcs.find((n) => n.id === id) ?? Object.values(this.away).flatMap((a) => a.npcs).find((n) => n.id === id);
  }

  private checkDistrictExit(): void {
    const p = this.player;
    if (this._tick % 5 !== 0 || this._battle || p.conversationWith) return;
    for (const exit of this.layout.exits) {
      const band = this.layout.streets.find((st) => st.axis === 'horizontal' && st.name === exit.street);
      if (!band || p.y < band.from || p.y > band.to + 1) continue;
      const atEdge = exit.side === 'east' ? p.x > this.layout.map.width - 1.2 : p.x < 1.2;
      if (!atEdge) continue;
      if (!this.isUnlocked(exit.to)) {
        if (this._tick >= this.encounterCooldownUntilTick) {
          this.emit({ type: 'notice', text: 'A Warden checkpoint blocks the bridge. "Residents only tonight."' });
          this.encounterCooldownUntilTick = this._tick + TICK_RATE * 3;
        }
        const v = this.playerVehicle;
        const push = exit.side === 'east' ? -1.5 : 1.5;
        if (v) {
          v.x += push;
          v.vx = v.vy = v.speed = 0;
        }
        p.x += push;
        return;
      }
      this.travelTo(exit.to, exit.street);
      return;
    }
  }

  /** Move the player (and their car) into another district; the old one is parked. */
  travelTo(to: string, street: string): void {
    const from = this.layout.id;
    const car = this.playerVehicle;
    if (car) this.vehicles.splice(this.vehicles.indexOf(car), 1);
    this.law.officers = [];
    this.law.officersDeployed = [];
    this.away[from] = {
      npcs: this.npcs.filter((n) => !n.transient),
      wildlings: this.wildlings.filter((w) => w.questTag),
      vehicles: this.vehicles.filter((v) => v.driver !== 'ai' && v.driver !== 'police'),
      territory: this.territory,
    };
    this.loadDistrict(to);
    const saved = this.away[to];
    delete this.away[to];
    if (saved) {
      this.npcs = saved.npcs;
      this.wildlings = saved.wildlings;
      this.vehicles = saved.vehicles;
      this.territory = saved.territory;
    } else {
      this.npcs = this.spawnNpcs();
      this.wildlings = [];
      this.vehicles = parkedVehiclesFromLayout(this.layout);
      this.territory = newTerritory(this.layout);
    }
    this.assignAgents();
    // Arrive at the matching exit on the other side.
    const back = this.layout.exits.find((e) => e.to === from) ?? this.layout.exits[0];
    const band = back && this.layout.streets.find((st) => st.axis === 'horizontal' && st.name === (back.street ?? street));
    const east = back?.side === 'east';
    const x = east ? this.layout.map.width - 3 : 3;
    const y = band ? band.from + (east ? 1.5 : 3.5) : this.layout.playerSpawn.y;
    const p = this.player;
    p.x = p.prevX = x;
    p.y = p.prevY = y;
    p.heading = east ? Math.PI : 0;
    if (car) {
      car.x = car.prevX = x;
      car.y = car.prevY = y;
      car.heading = p.heading;
      this.vehicles.push(car);
    }
    this.encounterCooldownUntilTick = this._tick + TICK_RATE * 3;
    this._progressVersion++;
    this.emit({ type: 'district.entered', districtId: to, name: this.layout.name });
  }

  get absHour(): number {
    return this._day * 24 + this.hour;
  }

  private missionGenContext(): MissionGenContext {
    return {
      layout: this.layout,
      npcs: this.npcs,
      progression: this.progression,
      territory: this.territory,
      factions: this.factionAgents,
      rng: this.rng,
      now: this.now,
      hour: this.hour,
      player: this.player,
      locationOf: (x, y) => describeLocation(this.layout, x, y),
    };
  }

  private nextMissionId = () => `gen-${this.progression.missionSeq++}`;

  /** Hourly: NPCs with needs post requests; stale offers expire; the archive stays small. */
  private missionHour(): void {
    const p = this.progression;
    if (!p.missions.some((m) => m.id === 'last-run' && m.status === 'completed')) return;
    const offered = p.generated.filter((m) => m.giver && p.board.includes(m.id));
    if (offered.length < 2 && this.rng.chance(0.35)) {
      const def = generateNpcRequest(this.missionGenContext(), this.nextMissionId);
      if (def) {
        p.generated.push(def);
        p.board.push(def.id);
        this._progressVersion++;
      }
    }
    // Forget offers nobody took and old finished jobs.
    const known = new Set(p.missions.map((m) => m.id));
    p.generated = p.generated.filter((m) => p.board.includes(m.id) || known.has(m.id));
  }

  /** The Courier Co-op job board (refreshed daily). */
  private openJobBoard(): void {
    const p = this.progression;
    if (p.boardDay !== this._day || !p.generated.some((m) => !m.giver && p.board.includes(m.id))) {
      p.board = p.board.filter((id) => p.generated.find((m) => m.id === id)?.giver);
      for (const def of generateBoard(this.missionGenContext(), this.nextMissionId)) {
        p.generated.push(def);
        p.board.push(def.id);
      }
      p.boardDay = this._day;
      this._progressVersion++;
    }
    this.emit({ type: 'board.opened' });
  }

  /** NPCs who currently have a job for the player (for the "!" marker). */
  npcsWithOffers(): string[] {
    const p = this.progression;
    return p.generated.filter((m) => m.giver && p.board.includes(m.id)).map((m) => m.giver!);
  }

  /** Hourly world simulation: weather and events, then each faction plans and acts. */
  private strategyHour(): void {
    worldHour(this.world, this.absHour, this.rng, this.events);
    const world = {
      blackout: eventActive(this.world, 'blackout'),
      recallDrive: eventActive(this.world, 'recall-drive'),
      procession: eventActive(this.world, 'saints-procession'),
      hour: this.hour,
      absHour: this.absHour,
    };
    const slumsActive = this.layout.id === 'slums';
    const slumsLayout = this.layoutOf('slums');
    const slumsTerritory = slumsActive ? this.territory : (this.away.slums?.territory ?? newTerritory(slumsLayout));
    if (!slumsActive && this.away.slums) this.away.slums.territory = slumsTerritory;
    for (const f of this.factionAgents) {
      factionTick(f, {
        layout: slumsLayout,
        territory: slumsTerritory,
        reputation: this.progression.reputation,
        events: this.events,
        world,
        // Crews only take to the streets where the player can see them; elsewhere operations run abstractly.
        spawnCrew: (faction, blockId, count) => (slumsActive ? this.spawnCrew(faction, blockId, count) : []),
        crewDisrupted: (ids) =>
          ids.some((id) => this.npcs.find((n) => n.id === id)?.memory.some((m) => (m.kind === 'shoved' || m.kind === 'hit-by-car') && !m.secondhand)),
        dismissCrew: (ids) => this.dismissCrew(ids),
      });
    }
    // Factions notice blocks that changed hands since last hour (including the player's doing).
    for (const [blockId, controller] of Object.entries(slumsTerritory.controllers)) {
      const prev = this.lastControllers[blockId] ?? null;
      if (prev !== controller) noteTerritoryChange(this.factionAgents, prev, this.absHour);
    }
    this.lastControllers = { ...slumsTerritory.controllers };
  }

  private spawnCrew(faction: 'saints' | 'halcyon', blockId: string, count: number): string[] {
    const block = this.layout.blocks.find((b) => b.id === blockId);
    if (!block) return [];
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      let tile: { tx: number; ty: number } | null = null;
      for (let k = 0; k < 12 && !tile; k++) {
        const tx = block.x + this.rng.int(0, block.w - 1);
        const ty = this.rng.chance(0.5) ? block.y : block.y + block.h - 1;
        if (this.layout.map.isPedestrianWalkable(tx, ty)) tile = { tx, ty };
      }
      if (!tile) continue;
      const npc = this.spawnCitizen(tile.tx + 0.5, tile.ty + 0.5, false);
      npc.id = `crew-${npc.id}`;
      npc.archetypeId = faction === 'halcyon' ? 'aegis-agent' : 'gutter-saint';
      npc.name = faction === 'halcyon' ? 'Halcyon Outreach Agent' : 'Saints Runner';
      npc.appearance = faction === 'halcyon' ? { ...npc.appearance, top: 0xe8ecf4, bottom: 0x2b2f3a } : { ...npc.appearance, top: 0x9b2335, bottom: 0x2b2b3a };
      npc.agent = { ...npc.agent!, patrolBlock: blockId, activity: null };
      ids.push(npc.id);
    }
    return ids;
  }

  private dismissCrew(ids: string[]): void {
    for (const id of ids) {
      const npc = this.npcs.find((n) => n.id === id);
      if (!npc) continue;
      if (Math.hypot(npc.x - this.player.x, npc.y - this.player.y) > 16) npc.present = false;
      else if (npc.agent) {
        npc.agent.patrolBlock = null;
        npc.archetypeId = 'citizen'; // walks off home and disappears
        npc.agent.activity = null;
      }
    }
  }

  get day(): number {
    return this._day;
  }

  /** Change the player's standing with a faction (clamped to -100..100). */
  changeReputation(faction: string, delta: number): void {
    const rep = this.progression.reputation;
    const before = rep[faction] ?? 0;
    const after = Math.max(-100, Math.min(100, before + delta));
    if (after === before) return;
    rep[faction] = after;
    this._progressVersion++;
    this.emit({ type: 'reputation.changed', faction, delta: after - before, value: after });
  }

  /** Current shop price, including territory and reputation effects. */
  shopPrice(shopId: string, itemId: string): number {
    const shop = SHOPS[shopId];
    if (!shop) return 0;
    return priceOf(itemId, shop.name, { day: this._day, territory: this.territory, layout: this.layout, reputation: this.progression.reputation });
  }

  salePrice(w: WildlingInstance): number {
    return wildlingSalePrice(w, this.market);
  }

  /** Faction controlling the block the player is in, if any. */
  controllerAtPlayer(): string | null {
    const b = blockOf(this.layout, this.player.x, this.player.y);
    return b ? (this.territory.controllers[b.id] ?? null) : null;
  }

  private sellWildling(from: 'party' | 'storage', index: number): void {
    const p = this.progression;
    const pawn = this.layout.buildings.find((b) => b.name === 'Paper Moon Pawn');
    if (this._battle || !pawn || Math.hypot(this.player.x - (pawn.entrance.tx + 0.5), this.player.y - (pawn.entrance.ty + 0.5)) > 3) return;
    const list = from === 'party' ? p.party : p.storage;
    const w = list[index];
    if (!w || w.speciesId === 'glitchling') return;
    if (from === 'party' && p.party.filter((x) => x.hp > 0).length <= 1 && w.hp > 0) {
      this.emit({ type: 'notice', text: "You can't sell your last healthy Wildling." });
      return;
    }
    const price = this.salePrice(w);
    list.splice(index, 1);
    p.money += price;
    this.market.demand[w.speciesId] = Math.max(0.3, (this.market.demand[w.speciesId] ?? 1) - 0.2);
    this._progressVersion++;
    this.emit({ type: 'notice', text: `Sold ${displayName(w)} for ${price}\u20b5. The Saints won't like this.` });
    this.changeReputation('saints', -4);
    for (const n of this.npcs) {
      if (n.archetypeId === 'gutter-saint') remember(n.memory, { kind: 'sold-wildling', salience: 0.5, important: false, secondhand: true, at: this.now });
    }
  }

  private updatePlayer(input: PlayerInput): void {
    const p = this.player;
    p.prevX = p.x;
    p.prevY = p.y;
    const locked = p.conversationWith !== null;
    const dir = locked ? { x: 0, y: 0 } : clampMagnitude(input.moveX, input.moveY);
    const magnitude = Math.hypot(dir.x, dir.y);
    p.running = !locked && input.run && magnitude > 0.1;
    const maxSpeed = p.running ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
    const targetVx = dir.x * maxSpeed;
    const targetVy = dir.y * maxSpeed;
    const maxDelta = PLAYER_ACCEL * DT;
    p.vx += Math.max(-maxDelta, Math.min(maxDelta, targetVx - p.vx));
    p.vy += Math.max(-maxDelta, Math.min(maxDelta, targetVy - p.vy));

    const res = moveAndCollide(this.layout.map, p.x, p.y, PLAYER_HALF_EXTENT, p.vx * DT, p.vy * DT);
    if (res.blockedX) p.vx = 0;
    if (res.blockedY) p.vy = 0;
    p.speed = Math.hypot(res.x - p.x, res.y - p.y) / DT;
    p.x = res.x;
    p.y = res.y;
    if (magnitude > 0.1) p.heading = turnToward(p.heading, Math.atan2(dir.y, dir.x), TURN_RATE * DT);
  }

  /** Keep NPCs out of the player and detect sprint collisions ("shoves"). */
  private resolveContacts(ctx: NpcContext): void {
    const p = this.player;
    const minDist = PLAYER_HALF_EXTENT + NPC_HALF_EXTENT;
    for (const npc of this.npcs) {
      if (!npc.present || npc.indoors) continue;
      let dx = npc.x - p.x;
      let dy = npc.y - p.y;
      let dist = Math.hypot(dx, dy);
      if (dist >= minDist) continue;
      if (dist < 1e-6) {
        dx = Math.cos(p.heading);
        dy = Math.sin(p.heading);
        dist = 1;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - Math.min(dist, minDist);
      const shove =
        p.running && p.speed > PLAYER_WALK_SPEED * 1.15 && this._tick >= npc.shoveCooldownUntilTick && npc.mode !== 'talking';
      if (npc.stationary && !shove) {
        // Stationary NPCs hold their ground: push the player instead.
        const res = moveAndCollide(this.layout.map, p.x, p.y, PLAYER_HALF_EXTENT, -nx * overlap, -ny * overlap);
        p.x = res.x;
        p.y = res.y;
        continue;
      }
      const push = overlap + (shove ? 0.35 : 0);
      const res = moveAndCollide(this.layout.map, npc.x, npc.y, NPC_HALF_EXTENT, nx * push, ny * push);
      npc.x = res.x;
      npc.y = res.y;
      if (shove) {
        onShoved(npc, this.npcs, ctx);
        this.reportCrime('assault', npc.x, npc.y, 0.5);
        const faction = ARCHETYPE_FACTION[npc.archetypeId];
        if (faction) this.changeReputation(faction, -3);
        if (faction && npc.id.startsWith('crew-')) trigger(this, 'disrupt', faction);
      }
    }
  }

  private updateFocus(): void {
    const p = this.player;
    const fx = Math.cos(p.heading);
    const fy = Math.sin(p.heading);
    let best: Focus | null = null;
    let bestScore = Infinity;
    for (const npc of this.npcs) {
      if (!npc.present || npc.indoors || npc.mode === 'fleeing') continue;
      const dx = npc.x - p.x;
      const dy = npc.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > INTERACT_RANGE) continue;
      const dot = d > 1e-6 ? (dx * fx + dy * fy) / d : 1;
      if (dot < -0.3) continue;
      const score = d - dot * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = { kind: 'npc', id: npc.id, label: npc.name };
      }
    }
    for (const b of this.layout.buildings) {
      const d = Math.hypot(b.entrance.tx + 0.5 - p.x, b.entrance.ty + 0.5 - p.y);
      if (d > ENTRANCE_RANGE) continue;
      const score = d + 0.3;
      if (score < bestScore) {
        bestScore = score;
        best = { kind: 'building', id: b.id, label: b.name };
      }
    }
    this._focus = best;
  }

  private interact(): void {
    const focus = this._focus;
    if (!focus || this.player.conversationWith) return;
    if (focus.kind === 'npc') {
      const npc = this.npcs.find((n) => n.id === focus.id);
      if (npc) this.talkTo(npc);
    } else {
      const b = this.layout.buildings.find((x) => x.id === focus.id);
      if (b) this.inspectBuilding(b);
    }
  }

  private talkTo(npc: NpcState): void {
    const p = this.progression;
    let pages: Conversation;
    if (isObjective(p, 'talk', npc.id)) {
      const obj = trigger(this, 'talk', npc.id);
      pages = obj?.pages ?? ['...'];
    } else if (offerFrom(p, npc.id)) {
      const def = offerFrom(p, npc.id)!;
      pages = def.offer ?? [def.summary];
      startMission(this, def);
    } else if (TRAINERS[npc.id] && !p.defeatedTrainers.includes(npc.id)) {
      const trainer = TRAINERS[npc.id]!;
      if (this.progression.party.some(isHealthy)) {
        pages = trainer.challenge;
        this.pendingEffects.push({ type: 'start-trainer-battle', npc: npc.id });
      } else {
        pages = ["Your Wildlings can barely stand. Heal up at the clinic, then come find me."];
      }
    } else if (TRAINERS[npc.id]) {
      pages = TRAINERS[npc.id]!.defeated;
    } else {
      pages = this.pickConversation(npc, this.archetype(npc.archetypeId));
    }
    npc.mode = 'talking';
    npc.path = [];
    npc.pathIndex = 0;
    this.player.conversationWith = npc.id;
    this.player.vx = 0;
    this.player.vy = 0;
    this.emit({ type: 'dialogue.opened', npcId: npc.id, speaker: npc.name, pages: pages.map((x) => this.personalise(x)) });
  }

  private inspectBuilding(b: Building): void {
    if (isObjective(this.progression, 'inspect', b.name)) {
      trigger(this, 'inspect', b.name);
      return;
    }
    if (b.name === 'Vesper Courier Co-op' && this.progression.missions.some((m) => m.id === 'last-run' && m.status === 'completed')) {
      this.openJobBoard();
      return;
    }
    if (b.service?.kind === 'clinic') {
      const fee = (this.progression.reputation.saints ?? 0) <= -20 ? 80 : 0;
      if (fee > 0 && this.progression.party.length > 0) {
        if (this.progression.money < fee) {
          this.emit({ type: 'message', speaker: b.name, pages: [`Needle folds her arms. "${fee}\u20b5. Saints\u2019 rules don\u2019t cover people who sell strays."`] });
          return;
        }
        this.progression.money -= fee;
        for (const w of this.progression.party) healFully(w, true);
        this._progressVersion++;
        this.emit({ type: 'message', speaker: b.name, pages: [`Needle patches up your Wildlings without a word and pockets the ${fee}\u20b5.`] });
        return;
      }
      for (const w of this.progression.party) healFully(w, true);
      this._progressVersion++;
      this.emit({
        type: 'message',
        speaker: b.name,
        pages: this.progression.party.length
          ? ['Needle patches up your Wildlings and checks their injuries. "All set. No charge — Saints’ rules."']
          : [b.description],
      });
      return;
    }
    if (b.service?.kind === 'shop') {
      this.emit({ type: 'shop.opened', shopId: b.service.shopId });
      return;
    }
    this.events.push({ type: 'building.inspected', buildingId: b.id, name: b.name, text: b.description });
  }

  private personalise(text: string): string {
    return text.replaceAll('{player}', this.player.name);
  }

  private pickConversation(npc: NpcState, archetype: NpcArchetype): Conversation {
    const d = archetype.dialogue;
    const rel = relationship(npc.memory);
    const top = strongest(npc.memory);
    remember(npc.memory, { kind: 'chatted', salience: 0.3, important: false, secondhand: false, at: this.now });
    if ((this._tick < npc.grudgeUntilTick || rel.affection < -0.3) && d.grudge.length > 0) {
      if (top?.secondhand && this.rng.chance(0.6)) return [`People say ${RUMOUR_TEXT[top.kind]}, {player}.`, ...this.rng.pick(d.grudge)];
      return this.rng.pick(d.grudge);
    }
    if (top?.secondhand && top.salience > 0.25 && this.rng.chance(0.5)) {
      const good = top.kind === 'helped' || top.kind === 'saw-battle-win';
      return [good ? `Word on the street is ${RUMOUR_TEXT[top.kind]}. Respect, {player}.` : `I heard ${RUMOUR_TEXT[top.kind]}. That true, {player}?`];
    }
    if (top?.kind === 'helped' && !top.secondhand) return [`{player}! I still owe you for that. Anything you need, you ask.`];
    const faction = ARCHETYPE_FACTION[archetype.id];
    if (faction && archetype.factionDialogue) {
      const tier = repTier(this.progression.reputation[faction] ?? 0);
      if ((tier === 'Trusted' || tier === 'Family') && archetype.factionDialogue.friendly.length) return this.rng.pick(archetype.factionDialogue.friendly);
      if ((tier === 'Distrusted' || tier === 'Hunted') && archetype.factionDialogue.hostile.length) return this.rng.pick(archetype.factionDialogue.hostile);
    }
    if (this.isNight && d.night.length > 0 && this.rng.chance(0.5)) return this.rng.pick(d.night);
    return this.rng.pick(d.greeting);
  }

  private maybeAmbientBark(ctx: NpcContext): void {
    if (this._tick < this.ambientBarkTick) return;
    this.ambientBarkTick = this._tick + TICK_RATE;
    const p = this.player;
    const candidates = this.npcs.filter(
      (n) =>
        n.present &&
        !n.indoors &&
        (n.mode === 'idle' || n.mode === 'walking') &&
        this._tick >= n.nextBarkTick &&
        Math.hypot(n.x - p.x, n.y - p.y) < 6,
    );
    if (candidates.length === 0 || !this.rng.chance(0.3)) return;
    ambientBark(this.rng.pick(candidates), this.isNight, ctx);
    this.ambientBarkTick = this._tick + TICK_RATE * this.rng.int(4, 8);
  }
}


function pushOut(a: { x: number; y: number }, c: { x: number; y: number; r: number }, half: number, layout: DistrictLayout): boolean {
  const dx = a.x - c.x;
  const dy = a.y - c.y;
  const dist = Math.hypot(dx, dy);
  const min = c.r + half;
  if (dist >= min) return false;
  const nx = dist > 1e-6 ? dx / dist : 1;
  const ny = dist > 1e-6 ? dy / dist : 0;
  const res = moveAndCollide(layout.map, a.x, a.y, half, nx * (min - dist), ny * (min - dist));
  a.x = res.x;
  a.y = res.y;
  return true;
}
