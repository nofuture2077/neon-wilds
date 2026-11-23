import Phaser from 'phaser';
import {
  DT,
  NO_INPUT,
  SHOPS,
  Simulation,
  TILE_SIZE,
  battleView,
  getSpecies,
  progressView,
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
import { renderCity } from '../render/CityRenderer';
import { Depth } from '../render/depth';
import { Lighting, darknessAt } from '../render/lighting';
import { WildlingViews } from '../render/WildlingViews';
import { SignalViews, VehicleViews } from '../render/VehicleViews';

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
  private cameraTarget!: Phaser.GameObjects.Zone;
  private baseZoom = 3;
  private pendingAction = false;
  private focusMarker!: Phaser.GameObjects.Image;
  private player!: ActorView;
  private readonly npcViews = new Map<string, ActorView>();
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
    this.sim =
      session.kind === 'load'
        ? Simulation.fromSnapshot(session.snapshot)
        : Simulation.create({
            seed: session.setup.seed,
            playerName: session.setup.playerName,
            appearance: session.setup.appearance,
            ...(session.setup.startMinutes !== undefined ? { startMinutes: session.setup.startMinutes } : {}),
          });
    const layout = this.sim.layout;

    this.lighting = new Lighting(this);
    renderCity(this, layout, this.lighting);

    this.player = new ActorView(this, this.characterTexture(this.sim.player.appearance));
    for (const npc of this.sim.npcs) {
      this.npcViews.set(npc.id, new ActorView(this, this.characterTexture(npc.appearance)));
    }
    const textRes = () => this.cameras.main.zoom * window.devicePixelRatio;
    this.wildlingViews = new WildlingViews(this, textRes);
    this.vehicleViews = new VehicleViews(this);
    this.signals = new SignalViews(this, this.sim.roads);
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
      if (store.shopId) store.setShop(null);
      else if (!store.dialogue && !store.battle) store.setPaused(!store.paused);
    }
    if (store.paused) return;

    let input: PlayerInput = NO_INPUT;
    if (store.battle) {
      if (frame.confirm) store.battleAdvance();
    } else if (store.dialogue) {
      if (frame.confirm) store.advanceDialogue();
    } else if (!store.shopId) {
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
    return !this.sim.battle && !s.battle && !s.dialogue && !this.sim.player.conversationWith;
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
    this.signals.update(this.sim.tick);

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
    for (const npc of this.sim.npcs) {
      const view = this.npcViews.get(npc.id);
      if (!view) continue;
      view.setVisible(npc.present);
      if (npc.present) view.sync(npc, alpha, deltaSeconds);
    }
    this.wildlingViews.sync(this.sim.wildlings, alpha, deltaSeconds, this.time.now);

    this.lighting.update(darkness, this.time.now);
    this.barks.update((id) => {
      const view = id === 'player' ? this.player : this.npcViews.get(id);
      return view ? { x: view.sprite.x, y: view.sprite.y } : this.vehicleViews.positionOf(id);
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
        store.openDialogue({ source: { kind: 'message' }, speaker: event.speaker, pages: event.pages });
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
