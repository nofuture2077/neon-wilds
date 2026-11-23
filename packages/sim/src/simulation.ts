import { ambientBark, onShoved, updateNpc, type NpcContext } from './ai/npcBrain';
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
import { getDistrictContent, type DistrictContent } from './content';
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
import { checkAutoStart, isObjective, offerFrom, startMission, trigger, type MissionHost } from './missions/runtime';
import type { Effect } from './missions/types';
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
  readonly layout: DistrictLayout;
  private readonly content: DistrictContent;
  private readonly archetypes: Map<string, NpcArchetype>;
  private readonly pedPathfinder: Pathfinder;
  private readonly creaturePathfinder: Pathfinder;
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
  readonly npcs: NpcState[];
  readonly wildlings: WildlingEntity[];
  readonly progression: ProgressionState;
  private _battle: BattleState | null;

  private constructor(private readonly seed: number, districtId: string, snapshot: SimSnapshot | null, config: NewGameConfig | null) {
    this.content = getDistrictContent(districtId);
    this.layout = generateDistrict(this.content.district, seed);
    this.archetypes = new Map(this.content.archetypes.map((a) => [a.id, a]));
    const map = this.layout.map;
    this.pedPathfinder = new Pathfinder({
      width: map.width,
      height: map.height,
      passable: (tx, ty) => map.isPedestrianWalkable(tx, ty),
    });
    this.creaturePathfinder = new Pathfinder({
      width: map.width,
      height: map.height,
      passable: (tx, ty) => !map.isSolid(tx, ty),
    });

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
      };
      this.npcs = this.spawnNpcs();
      this.wildlings = [];
      this._battle = null;
      this.progression = newProgression();
      this.pendingEffects = [];
      this.encounterCooldownUntilTick = 0;
      this.nextEntityId = 1;
      checkAutoStart(this);
    } else {
      throw new Error('Simulation requires a snapshot or a config');
    }
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
    this.updatePlayer(input);

    const ctx = this.npcContext();
    for (const npc of this.npcs) updateNpc(npc, ctx);
    const wctx = this.wildlingContext(ctx.pathBudget);
    if (this._tick % 30 === 0) manageSpawns(this.wildlings, wctx);
    updateWildlings(this.wildlings, wctx);

    this.resolveContacts(ctx);
    this.checkEncounters();
    this.updateFocus();
    if (input.interact) this.interact();
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
        const npc = this.npcs.find((n) => n.id === effect.npc);
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
    const cost = item.price * qty;
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
      } satisfies NpcState;
    });
  }

  private archetype(id: string): NpcArchetype {
    const a = this.archetypes.get(id);
    if (!a) throw new Error(`Unknown NPC archetype "${id}"`);
    return a;
  }

  private npcContext(): NpcContext {
    return {
      layout: this.layout,
      rng: this.rng,
      events: this.events,
      pathfinder: this.pedPathfinder,
      tick: this._tick,
      player: this.player,
      archetype: (id) => this.archetype(id),
      pathBudget: { remaining: PATH_BUDGET_PER_TICK },
    };
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

  private advanceClock(): void {
    const before = this.hour;
    this._minutes = (this._minutes + DT * GAME_MINUTES_PER_SECOND) % 1440;
    const after = this.hour;
    if (after !== before) this.events.push({ type: 'clock.hour', hour: after });
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
      if (!npc.present) continue;
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
      if (shove) onShoved(npc, this.npcs, ctx);
    }
  }

  private updateFocus(): void {
    const p = this.player;
    const fx = Math.cos(p.heading);
    const fy = Math.sin(p.heading);
    let best: Focus | null = null;
    let bestScore = Infinity;
    for (const npc of this.npcs) {
      if (!npc.present || npc.mode === 'fleeing') continue;
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
    if (b.service?.kind === 'clinic') {
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
    if (this._tick < npc.grudgeUntilTick && d.grudge.length > 0) return this.rng.pick(d.grudge);
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
        (n.mode === 'idle' || n.mode === 'walking') &&
        this._tick >= n.nextBarkTick &&
        Math.hypot(n.x - p.x, n.y - p.y) < 6,
    );
    if (candidates.length === 0 || !this.rng.chance(0.3)) return;
    ambientBark(this.rng.pick(candidates), this.isNight, ctx);
    this.ambientBarkTick = this._tick + TICK_RATE * this.rng.int(4, 8);
  }
}

