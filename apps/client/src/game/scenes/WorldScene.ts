import Phaser from 'phaser';
import {
  DT,
  NO_INPUT,
  SHOPS,
  Simulation,
  TILE_SIZE,
  battleView,
  boardView,
  describeLocation,
  factionsView,
  getSpecies,
  mapView,
  objectiveMarkers,
  progressView,
  relationship,
  shopView,
  vehicleClass,
  type PlayerInput,
  type SimEvent,
} from '@neon-wilds/sim';
import { type Session, useGameStore } from '../../state/gameStore';
import { writeSave } from '../../services/saves';
import { appearanceKey, buildCharacterSheet, CHARACTER_FRAME } from '../assets/characters';
import { TEXTURES, addCanvasTexture } from '../assets/manifest';
import { InputMapper } from '../input/InputMapper';
import { ActorView } from '../render/ActorView';
import { BarkLayer } from '../render/BarkLayer';
import { type ExitGate, renderCity } from '../render/CityRenderer';
import { Depth } from '../render/depth';
import { Lighting, darknessAt } from '../render/lighting';
import { WildlingViews } from '../render/WildlingViews';
import { SignalViews, VehicleViews } from '../render/VehicleViews';
import { TerritoryViews } from '../render/TerritoryViews';
import { WeatherViews } from '../render/WeatherViews';

/** Max simulation catch-up per frame (prevents a spiral of death after a tab stall). */
const MAX_FRAME_SECONDS = 0.25;
const HUD_INTERVAL_MS = 100;
const AUTOSAVE_INTERVAL_MS = 3 * 60 * 1000;

/**
 * Hosts the deterministic simulation inside Phaser's game loop and renders it.
 * Fixed-step simulation, variable-rate rendering with interpolation.
 */
export class WorldScene extends Phaser.Scene {
  private sim!: Simulation;
  private controls!: InputMapper;
  private lighting!: Lighting;
  private barks!: BarkLayer;
  private wildlingViews!: WildlingViews;
  private vehicleViews!: VehicleViews;
  private signals!: SignalViews;
  private territoryViews!: TerritoryViews;
  private weatherViews!: WeatherViews;
  private cameraTarget!: Phaser.GameObjects.Zone;
  private baseZoom = 3;
  private pendingAction = false;
  private focusMarker!: Phaser.GameObjects.Image;
  private player!: ActorView;
  private readonly npcViews = new Map<string, ActorView>();
  private readonly officerViews = new Map<string, ActorView>();
  private accumulator = 0;
  private pendingInteract = false;
  private hudElapsed = HUD_INTERVAL_MS;
  private lastProgressVersion = -1;
  private sinceAutosave = 0;
  private autosaveRequested = false;
  private unsubscribers: Array<() => void> = [];

  constructor() {
    super('world');
  }

  create(session: Session): void {
    // A district change restarts this scene with the running simulation (the city is rebuilt around it).
    const live = this.registry.get('liveSim') as Simulation | undefined;
    this.registry.remove('liveSim');
    this.npcViews.clear();
    this.officerViews.clear();
    this.offerMarkers.clear();
    this.objectiveMarker = null;
    this.objective = null;
    this.debugText = null;
    this.accumulator = 0;
    this.lastProgressVersion = -1;
    this.sim =
      live ??
      (session.kind === 'load'
        ? Simulation.fromSnapshot(session.snapshot)
        : Simulation.create({
            seed: session.setup.seed,
            playerName: session.setup.playerName,
            appearance: session.setup.appearance,
            ...(session.setup.startMinutes !== undefined ? { startMinutes: session.setup.startMinutes } : {}),
          }));
    if (live) this.cameras.main.fadeIn(400, 7, 7, 15);
    const layout = this.sim.layout;

    this.lighting = new Lighting(this);
    this.gates = [];
    renderCity(this, layout, this.lighting, this.gates);

    this.player = new ActorView(this, this.characterTexture(this.sim.player.appearance));
    for (const npc of this.sim.npcs) {
      this.npcViews.set(npc.id, new ActorView(this, this.characterTexture(npc.appearance)));
    }
    const textRes = () => this.cameras.main.zoom * window.devicePixelRatio;
    this.wildlingViews = new WildlingViews(this, textRes);
    this.vehicleViews = new VehicleViews(this);
    this.signals = new SignalViews(this, this.sim.roads);
    this.territoryViews = new TerritoryViews(this, this.sim.layout);
    this.weatherViews = new WeatherViews(this);
    this.focusMarker = this.add.image(0, 0, TEXTURES.focus).setDepth(Depth.focus).setVisible(false);
    this.barks = new BarkLayer(this, textRes);
    this.controls = new InputMapper(this);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, layout.map.width * TILE_SIZE, layout.map.height * TILE_SIZE);
    cam.setBackgroundColor('#07070f');
    this.player.sync(this.sim.player, 1, 0);
    this.cameraTarget = this.add.zone(this.player.sprite.x, this.player.sprite.y, 1, 1);
    cam.startFollow(this.cameraTarget, true, 0.12, 0.12);
    this.applyZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    const store = useGameStore.getState();
    useGameStore.setState({
      commandSink: (cmd) => this.sim.enqueue(cmd),
      snapshotSource: () => (this.canSave() ? { snapshot: this.sim.snapshot(), location: this.sim.locationLabel() } : null),
      queries: {
        shop: (id) => shopView(this.sim, id),
        factions: () => factionsView(this.sim),
        map: () => mapView(this.sim),
        board: () => boardView(this.sim),
      },
    });
    if (session.kind === 'load') store.pushToast(`Loaded ${session.slot === 'auto' ? 'autosave' : 'save'}.`, 'info');

    this.unsubscribers.push(
      // Closing the last dialogue releases the player and runs deferred effects (e.g. a trainer battle).
      useGameStore.subscribe((state, prev) => {
        if (prev.dialogue && !state.dialogue) this.sim.enqueue({ type: 'endDialogue' });
        if (prev.battle && !state.battle && this.scene.isActive('battle')) this.scene.stop('battle');
      }),
    );
    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-F3', () => this.toggleDebug());
      // Debug handle for the browser console and end-to-end smoke tests. Not present in production builds.
      (window as unknown as { __NEON_WILDS__?: unknown }).__NEON_WILDS__ = { sim: this.sim, scene: this };
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown());
  }

  override update(_time: number, deltaMs: number): void {
    const store = useGameStore.getState();
    const frame = this.controls.read();

    if (frame.pause) {
      if (store.boardOpen) useGameStore.setState({ boardOpen: false });
      else if (store.shopId) store.setShop(null);
      else if (!store.dialogue && !store.battle) store.setPaused(!store.paused);
    }
    if (store.paused) return;

    let input: PlayerInput = NO_INPUT;
    if (store.ending) {
      // The epilogue screen owns input.
    } else if (store.battle) {
      if (frame.confirm) store.battleAdvance();
    } else if (store.dialogue) {
      if (frame.confirm) store.advanceDialogue();
    } else if (!store.shopId && !store.boardOpen) {
      this.pendingInteract ||= frame.confirm;
      this.pendingAction ||= frame.action;
      input = { moveX: frame.moveX, moveY: frame.moveY, run: frame.run, interact: false, action: false };
    }

    this.accumulator += Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
    while (this.accumulator >= DT) {
      this.sim.step({ ...input, interact: this.pendingInteract, action: this.pendingAction });
      this.pendingInteract = false;
      this.pendingAction = false;
      this.accumulator -= DT;
      for (const event of this.sim.drainEvents()) this.handleEvent(event);
    }

    if (this.sim.progressVersion !== this.lastProgressVersion) {
      this.lastProgressVersion = this.sim.progressVersion;
      store.setProgress(progressView(this.sim));
    }

    this.render(this.accumulator / DT, deltaMs / 1000);
    this.hudElapsed += deltaMs;
    if (this.hudElapsed >= HUD_INTERVAL_MS) {
      this.hudElapsed = 0;
      this.pushHud();
    }
    this.sinceAutosave += deltaMs;
    if ((this.sinceAutosave >= AUTOSAVE_INTERVAL_MS || this.autosaveRequested) && this.canSave()) this.autosave();
  }

  private canSave(): boolean {
    const s = useGameStore.getState();
    return !this.sim.battle && !s.battle && !s.dialogue && !s.boardOpen && !this.sim.player.conversationWith;
  }

  private autosave(): void {
    this.sinceAutosave = 0;
    this.autosaveRequested = false;
    writeSave('auto', this.sim.snapshot(), this.sim.locationLabel())
      .then(() => useGameStore.getState().pushToast('Autosaved.', 'info'))
      .catch(() => useGameStore.getState().pushToast('Autosave failed — storage unavailable.', 'warning'));
  }

  private render(alpha: number, deltaSeconds: number): void {
    this.player.sync(this.sim.player, alpha, deltaSeconds);
    const driving = this.sim.playerVehicle;
    this.player.setVisible(!driving);
    const darkness = darknessAt(this.sim.minutes);
    this.vehicleViews.sync(this.sim.vehicles, alpha, deltaSeconds * 1000, darkness, this.time.now);
    this.signals.update(this.sim.tick, this.sim.world.event?.id === 'blackout');
    this.syncOfferMarkers();
    this.syncObjectiveMarker();
    for (const g of this.gates) g.rect.setVisible(!this.sim.isUnlocked(g.to));
    this.territoryViews.update(this.sim.territory.controllers, darkness);
    this.syncOfficers(alpha, deltaSeconds);

    // Camera: look ahead of a moving car and zoom out with speed (GTA 2 style).
    const cam = this.cameras.main;
    if (driving) {
      const pos = this.vehicleViews.positionOf(driving.id) ?? { x: this.player.sprite.x, y: this.player.sprite.y };
      this.cameraTarget.setPosition(pos.x + driving.vx * 10, pos.y + driving.vy * 10);
      const speed01 = Math.min(1, Math.abs(driving.speed) / 9);
      const target = this.baseZoom - speed01 * 1.1;
      cam.setZoom(Phaser.Math.Linear(cam.zoom, target, 0.03));
    } else {
      this.cameraTarget.setPosition(this.player.sprite.x, this.player.sprite.y);
      if (Math.abs(cam.zoom - this.baseZoom) > 0.01) cam.setZoom(Phaser.Math.Linear(cam.zoom, this.baseZoom, 0.08));
      else cam.setZoom(this.baseZoom);
    }
    const seen = new Set<string>();
    for (const npc of this.sim.npcs) {
      seen.add(npc.id);
      let view = this.npcViews.get(npc.id);
      if (!view) {
        view = new ActorView(this, this.characterTexture(npc.appearance));
        this.npcViews.set(npc.id, view);
      }
      const visible = npc.present && !npc.indoors;
      view.setVisible(visible);
      if (visible) view.sync(npc, alpha, deltaSeconds);
    }
    for (const [id, view] of this.npcViews) {
      if (seen.has(id)) continue;
      view.destroy();
      this.npcViews.delete(id);
    }
    if (this.debugText) this.renderDebug();
    this.wildlingViews.sync(this.sim.wildlings, alpha, deltaSeconds, this.time.now);

    const weather = this.sim.world.weather;
    const gloom = weather === 'storm' ? 0.18 : weather === 'rain' ? 0.1 : weather === 'drizzle' ? 0.04 : 0;
    this.lighting.update(darkness, this.time.now, gloom, this.sim.world.event?.id === 'blackout');
    this.weatherViews.update(weather, deltaSeconds * 1000, this.time.now);
    this.barks.update((id) => {
      const view = id === 'player' ? this.player : this.npcViews.get(id);
      const v = view ?? this.officerViews.get(id);
      return v ? { x: v.sprite.x, y: v.sprite.y } : this.vehicleViews.positionOf(id);
    });

    const focus = this.sim.focus;
    const bob = Math.sin(this.time.now / 160) * 1.5;
    if (focus?.kind === 'npc') {
      const view = this.npcViews.get(focus.id);
      if (view) this.focusMarker.setPosition(view.sprite.x, view.sprite.y - 12 + bob).setVisible(true);
    } else if (focus?.kind === 'building') {
      const b = this.sim.layout.buildings.find((x) => x.id === focus.id);
      if (b) this.focusMarker.setPosition((b.door.tx + 0.5) * TILE_SIZE, (b.door.ty + 0.5) * TILE_SIZE + bob).setVisible(true);
    } else {
      this.focusMarker.setVisible(false);
    }
  }

  private handleEvent(event: SimEvent): void {
    const store = useGameStore.getState();
    switch (event.type) {
      case 'dialogue.opened':
        store.openDialogue({ source: { kind: 'npc', npcId: event.npcId }, speaker: event.speaker, pages: event.pages });
        break;
      case 'building.inspected':
        store.openDialogue({ source: { kind: 'sign', buildingId: event.buildingId }, speaker: event.name, pages: [event.text] });
        break;
      case 'message':
        store.openDialogue({ source: { kind: 'message' }, speaker: event.speaker, pages: event.pages, ...(event.choices ? { choices: event.choices } : {}) });
        break;
      case 'game.ending':
        useGameStore.setState({ ending: { title: event.title, slides: event.slides, index: -1 } });
        this.autosaveRequested = true;
        break;
      case 'bark':
        this.barks.show(event.actorId, event.text, event.emote);
        break;
      case 'npc.shoved':
        this.cameras.main.shake(90, 0.004);
        break;
      case 'vehicle.crash':
        if (event.vehicleId === this.sim.player.vehicleId) this.cameras.main.shake(120, Math.min(0.02, event.impact * 0.0025));
        break;
      case 'vehicle.honk':
        this.barks.show(event.vehicleId, 'HONK!', 'anger');
        break;
      case 'vehicle.entered':
        if (event.how === 'carjacked') store.pushToast('Carjacked! That will not go unnoticed.', 'warning');
        else if (event.how === 'stolen') store.pushToast('You hot-wired the car.', 'warning');
        break;
      case 'vehicle.exploded': {
        this.cameras.main.shake(300, 0.012);
        this.cameras.main.flash(180, 255, 160, 60);
        break;
      }
      case 'district.entered': {
        store.pushToast(`Entering ${event.name}`, 'mission');
        this.registry.set('liveSim', this.sim);
        this.time.delayedCall(0, () => this.scene.restart(this.scene.settings.data));
        break;
      }
      case 'wanted.changed':
        if (event.stars > 0) {
          store.pushToast(`Wanted: ${'\u2605'.repeat(event.stars)}`, 'warning');
          this.cameras.main.flash(120, 60, 90, 255);
        }
        break;
      case 'territory.changed': {
        const b = this.sim.layout.blocks.find((x) => x.id === event.blockId);
        const where = b ? describeLocation(this.sim.layout, b.x + b.w / 2, b.y + b.h / 2) : 'the Slums';
        const name = event.controller === 'halcyon' ? 'Halcyon' : event.controller === 'saints' ? 'The Gutter Saints' : null;
        store.pushToast(name ? `${name} took control near ${where}.` : `The blocks near ${where} are contested.`, 'mission');
        break;
      }
      case 'world.event':
        if (event.status === 'started') {
          store.pushToast(`${event.title}!`, 'mission');
          if (!this.sim.playerVehicle && !store.battle) store.openDialogue({ source: { kind: 'message' }, speaker: event.title, pages: [event.text] });
        } else store.pushToast(`${event.title} is over.`, 'info');
        break;
      case 'weather.changed':
        store.pushToast(event.weather === 'clear' ? 'The rain stops.' : event.weather === 'drizzle' ? 'A drizzle starts.' : event.weather === 'rain' ? 'Rain pours down.' : 'A storm rolls in over the harbour.', 'info');
        break;
      case 'faction.operation': {
        if (event.status === 'completed' || !event.blockId) break;
        const b = this.sim.layout.blocks.find((x) => x.id === event.blockId);
        const where = b ? describeLocation(this.sim.layout, b.x + b.w / 2, b.y + b.h / 2) : 'the Slums';
        const who = event.faction === 'halcyon' ? 'Halcyon' : 'The Saints';
        const what: Record<string, string> = {
          scout: 'scouting',
          outreach: 'putting up posters',
          raid: 'raiding',
          rally: 'rallying',
          'strip-posters': 'tearing down Halcyon posters',
        };
        store.pushToast(
          event.status === 'disrupted' ? `You broke up ${who}'s crew near ${where}.` : `${who} ${what[event.action] ?? event.action} near ${where}.`,
          event.status === 'disrupted' ? 'reward' : 'mission',
        );
        break;
      }
      case 'reputation.changed':
        if (Math.abs(event.delta) >= 3) {
          const names: Record<string, string> = { saints: 'Gutter Saints', halcyon: 'Halcyon', compact: 'Tidewater Compact', choir: 'Verdant Choir', 'iron-chain': 'Iron Chain', wardens: 'Wardens' };
          store.pushToast(`${names[event.faction] ?? event.faction} ${event.delta > 0 ? '+' : ''}${event.delta}`, event.delta > 0 ? 'reward' : 'warning');
        }
        break;
      case 'busted':
        store.pushToast(`BUSTED! Fined ${event.lostMoney}\u20b5.`, 'warning');
        break;
      case 'respray':
        store.pushToast(`Fresh paint. The Wardens lost you (-${event.cost}\u20b5).`, 'reward');
        break;
      case 'crime':
        if (event.witnessed && event.severity >= 1) this.barks.show('player', '!', 'alarm');
        break;
      case 'vehicle.wrecked':
        if (event.vehicleId === this.sim.player.vehicleId) store.pushToast('The car is wrecked — get clear!', 'warning');
        break;
      case 'notice':
        store.pushToast(event.text, 'info');
        break;
      case 'mission.started':
        store.pushToast(`New mission: ${event.title}`, 'mission');
        break;
      case 'mission.updated':
        store.pushToast(event.objective, 'mission');
        break;
      case 'mission.completed':
        store.pushToast(`Mission complete: ${event.title}`, 'reward');
        this.autosaveRequested = true;
        break;
      case 'wildling.received':
        store.pushToast(
          `${getSpecies(event.speciesId).name} ${event.destination === 'party' ? 'joined your party!' : 'was sent to the Saints’ coop storage.'}`,
          'reward',
        );
        break;
      case 'blackout':
        store.pushToast(`You blacked out and lost ${event.lostMoney}₵.`, 'warning');
        break;
      case 'board.opened':
        useGameStore.setState({ boardOpen: true });
        break;
      case 'mission.failed':
        store.pushToast(`Mission failed: ${event.title}`, 'warning');
        break;
      case 'shop.opened':
        if (SHOPS[event.shopId]) store.setShop(event.shopId);
        break;
      case 'battle.started': {
        const view = battleView(this.sim);
        if (!view) break;
        store.battleStart(event.battleId, event.intro, view);
        this.pendingInteract = false;
        this.scene.launch('battle');
        this.scene.bringToTop('battle');
        break;
      }
      case 'battle.log':
        store.battleLog(event.entries, battleView(this.sim));
        break;
      default:
        break;
    }
  }

  private readonly offerMarkers = new Map<string, Phaser.GameObjects.Text>();
  private gates: ExitGate[] = [];
  private objectiveMarker: Phaser.GameObjects.Container | null = null;
  private objective: { x: number; y: number; label: string; where: string } | null = null;

  /** Bouncing yellow waypoint over the current objective (in world space, so it never lags). */
  private syncObjectiveMarker(): void {
    if (this.sim.tick % 15 === 0 || !this.objective) this.objective = objectiveMarkers(this.sim)[0] ?? null;
    const o = this.objective;
    if (!this.objectiveMarker) {
      const glow = this.add.image(0, 0, TEXTURES.glow).setTint(0xfff275).setScale(0.5).setBlendMode(Phaser.BlendModes.ADD);
      const arrow = this.add.image(0, 0, TEXTURES.focus).setScale(1.6).setTint(0xfff275);
      this.objectiveMarker = this.add.container(0, 0, [glow, arrow]).setDepth(Depth.focus + 1);
    }
    if (!o) {
      this.objectiveMarker.setVisible(false);
      return;
    }
    const bob = Math.sin(this.time.now / 200) * 2.5;
    this.objectiveMarker.setVisible(true).setPosition(o.x * TILE_SIZE, o.y * TILE_SIZE - 16 + bob);
  }

  private waypointHud(): { onScreen: boolean; x: number; y: number; angle: number; meters: number; where: string } | null {
    const o = this.objective;
    if (!o) return null;
    const cam = this.cameras.main;
    const sx = (o.x * TILE_SIZE - cam.worldView.x) * cam.zoom;
    const sy = (o.y * TILE_SIZE - cam.worldView.y) * cam.zoom;
    const w = this.scale.width;
    const h = this.scale.height;
    const onScreen = sx > 40 && sx < w - 40 && sy > 60 && sy < h - 60;
    const meters = Math.round(Math.hypot(o.x - this.sim.player.x, o.y - this.sim.player.y) * 2);
    return { onScreen, x: Math.round(sx), y: Math.round(sy), angle: Math.round(Math.atan2(sy - h / 2, sx - w / 2) * 100) / 100, meters: Math.round(meters / 5) * 5, where: o.where };
  }

  /** Yellow "!" over NPCs who have a job for the player. */
  private syncOfferMarkers(): void {
    const ids = new Set(this.sim.npcsWithOffers());
    for (const id of ids) {
      const view = this.npcViews.get(id);
      const npc = this.sim.npcs.find((n) => n.id === id);
      if (!view || !npc || npc.indoors) continue;
      let m = this.offerMarkers.get(id);
      if (!m) {
        m = this.add
          .text(0, 0, '!', { fontFamily: 'VT323, monospace', fontSize: '12px', color: '#fff275', stroke: '#000', strokeThickness: 3, resolution: this.cameras.main.zoom * 2 })
          .setOrigin(0.5, 1)
          .setDepth(Depth.focus);
        this.offerMarkers.set(id, m);
      }
      m.setPosition(view.sprite.x, view.sprite.y - 9 + Math.sin(this.time.now / 180) * 1.5).setVisible(true);
    }
    for (const [id, m] of this.offerMarkers) {
      if (ids.has(id) && !this.sim.npcs.find((n) => n.id === id)?.indoors) continue;
      m.destroy();
      this.offerMarkers.delete(id);
    }
  }

  // --- AI debug overlay (dev builds, F3) -------------------------------------
  private debugText: Phaser.GameObjects.Text[] | null = null;

  private toggleDebug(): void {
    if (this.debugText) {
      for (const t of this.debugText) t.destroy();
      this.debugText = null;
      return;
    }
    this.debugText = [];
  }

  private renderDebug(): void {
    const pool = this.debugText!;
    const near = this.sim.npcs
      .filter((n) => n.present && !n.indoors && Math.hypot(n.x - this.sim.player.x, n.y - this.sim.player.y) < 12)
      .slice(0, 16);
    while (pool.length < near.length) {
      pool.push(
        this.add
          .text(0, 0, '', { fontFamily: 'VT323, monospace', fontSize: '7px', color: '#9effc8', backgroundColor: '#000a', resolution: this.cameras.main.zoom * 2 })
          .setDepth(Depth.barks + 1)
          .setOrigin(0.5, 0),
      );
    }
    pool.forEach((t, i) => {
      const npc = near[i];
      if (!npc) {
        t.setVisible(false);
        return;
      }
      const view = this.npcViews.get(npc.id);
      const a = npc.agent;
      const rel = relationship(npc.memory);
      const lines = [
        `${npc.name} [${npc.mode}${a?.activity ? ':' + a.activity : ''}]`,
        a ? a.scores.map(([k, v]) => `${k} ${v}`).join(' | ') : '(scripted)',
        a ? `hun ${a.needs.hunger.toFixed(2)} fat ${a.needs.fatigue.toFixed(2)} soc ${a.needs.social.toFixed(2)}` : '',
        `trust ${rel.trust.toFixed(2)} fear ${rel.fear.toFixed(2)} aff ${rel.affection.toFixed(2)} · ${npc.memory.length} mem`,
      ].filter(Boolean);
      t.setText(lines.join('\n')).setVisible(true);
      if (view) t.setPosition(view.sprite.x, view.sprite.y + 8);
    });
  }

  private syncOfficers(alpha: number, deltaSeconds: number): void {
    const alive = new Set<string>();
    for (const o of this.sim.law.officers) {
      alive.add(o.id);
      let view = this.officerViews.get(o.id);
      if (!view) {
        view = new ActorView(this, this.characterTexture({ skin: 0xc68642, hair: 0x111111, top: 0x1f3b7a, bottom: 0x14203f }));
        this.officerViews.set(o.id, view);
      }
      view.sync(o, alpha, deltaSeconds);
    }
    for (const [id, view] of this.officerViews) {
      if (alive.has(id)) continue;
      view.destroy();
      this.officerViews.delete(id);
    }
  }

  private pushHud(): void {
    const sim = this.sim;
    const m = Math.floor(sim.minutes);
    const clock = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const focus = sim.focus;
    const driving = sim.playerVehicle;
    let prompt: string | null = null;
    let promptKey = 'E';
    if (driving) {
      if (Math.abs(driving.speed) < 3) {
        prompt = 'Get out';
        promptKey = 'F';
      }
    } else if (focus) {
      prompt = focus.kind === 'npc' ? `Talk to ${focus.label}` : `Visit ${focus.label}`;
    } else {
      const car = sim.nearbyVehicle();
      if (car) {
        prompt = car.driver === 'ai' ? 'Carjack' : car.stolen ? 'Get in' : 'Steal car';
        promptKey = 'F';
      }
    }
    useGameStore.getState().setHud({
      district: sim.districtName,
      location: sim.locationLabel(),
      clock,
      isNight: sim.isNight,
      prompt,
      promptKey,
      speed: driving ? Math.round(Math.abs(driving.speed) * 12) : null,
      vehicleHealth: driving ? Math.round((driving.hp / vehicleClass(driving).hp) * 100) : null,
      stars: sim.law.stars,
      seen: sim.law.seen,
      turf: sim.controllerAtPlayer(),
      weather: sim.world.weather,
      worldEvent: sim.world.event ? sim.world.event.id : null,
      waypoint: this.waypointHud(),
    });
  }

  private characterTexture(look: Parameters<typeof appearanceKey>[0]): string {
    const key = appearanceKey(look);
    if (!this.textures.exists(key)) addCanvasTexture(this, key, buildCharacterSheet(look), CHARACTER_FRAME, CHARACTER_FRAME);
    return key;
  }

  /** Integer zoom keeps pixels crisp; aim for roughly 16 tiles of vertical view. */
  private applyZoom(): void {
    this.baseZoom = Math.max(2, Math.min(6, Math.round(this.scale.height / (TILE_SIZE * 16))));
    this.cameras.main.setZoom(this.baseZoom);
  }

  private onResize(): void {
    this.applyZoom();
    this.lighting.resize();
  }

  private teardown(): void {
    for (const u of this.unsubscribers) u();
    this.unsubscribers = [];
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.barks?.clear();
  }
}
