import type { Appearance, BattleLog, BattleView, FactionView, MapView, ProgressView, ShopView, SimCommand, SimSnapshot, StatusKind } from '@neon-wilds/sim';
import { create } from 'zustand';
import { emitBattleFx } from '../game/battleFx';

export type Screen = 'menu' | 'create' | 'game';

export interface NewGameSetup {
  playerName: string;
  appearance: Appearance;
  seed: number;
  /** Optional start time (minutes after midnight); dev/testing hook. */
  startMinutes?: number;
}

/** What the game host should boot: a fresh game or a loaded save. */
export type Session = { kind: 'new'; setup: NewGameSetup } | { kind: 'load'; snapshot: SimSnapshot; slot: string };

export type DialogueSource = { kind: 'npc'; npcId: string } | { kind: 'sign'; buildingId: string } | { kind: 'message' };

export interface DialogueState {
  source: DialogueSource;
  speaker: string;
  pages: string[];
  page: number;
}

export interface HudState {
  district: string;
  location: string;
  clock: string;
  isNight: boolean;
  prompt: string | null;
  promptKey: string;
  speed: number | null;
  vehicleHealth: number | null;
  stars: number;
  seen: boolean;
  /** Faction controlling the player's block, if any. */
  turf: string | null;
  weather: string;
  worldEvent: string | null;
}

/** Read-only queries into the running simulation, provided by the game host. */
export interface GameQueries {
  shop(shopId: string): ShopView | null;
  factions(): FactionView[];
  map(): MapView;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'mission' | 'reward' | 'warning';
}

export interface ShownCreature {
  name: string;
  speciesId: string;
  level: number;
  hp: number;
  maxHp: number;
  status: StatusKind | null;
}

export type BattleMenu = 'main' | 'skills' | 'snares' | 'items' | 'party';

/** Presentation state for a battle: the log is played back one message at a time. */
export interface BattleUiState {
  id: string;
  view: BattleView;
  player: ShownCreature;
  enemy: ShownCreature;
  queue: BattleLog[];
  message: string | null;
  menu: BattleMenu;
  outcome: 'win' | 'lose' | 'fled' | 'captured' | null;
  /** Item chosen in the bag, waiting for a party target. */
  pendingItem: string | null;
}

export type PauseTab = 'party' | 'bag' | 'index' | 'map' | 'journal' | 'factions' | 'save' | 'options';

interface GameStore {
  screen: Screen;
  session: Session | null;
  /** Bumped on every new session so the game host remounts cleanly. */
  sessionId: number;
  paused: boolean;
  pauseTab: PauseTab;
  hud: HudState;
  dialogue: DialogueState | null;
  dialogueQueue: Omit<DialogueState, 'page'>[];
  toasts: Toast[];
  progress: ProgressView | null;
  battle: BattleUiState | null;
  shopId: string | null;
  /** Set by the game host; UI intents travel to the simulation through here. */
  commandSink: ((cmd: SimCommand) => void) | null;
  /** Set by the game host; returns a consistent snapshot for saving, or null if saving is not allowed now. */
  snapshotSource: (() => { snapshot: SimSnapshot; location: string } | null) | null;
  queries: GameQueries | null;
  musicVolume: number;

  goTo(screen: Screen): void;
  startSession(session: Session): void;
  quitToMenu(): void;
  setPaused(paused: boolean): void;
  setPauseTab(tab: PauseTab): void;
  setHud(hud: HudState): void;
  openDialogue(d: Omit<DialogueState, 'page'>): void;
  /** Next page, next queued dialogue, or close. Returns the closed dialogue if the last one closed. */
  advanceDialogue(): DialogueState | null;
  pushToast(text: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
  setProgress(p: ProgressView): void;
  setShop(shopId: string | null): void;
  command(cmd: SimCommand): void;

  battleStart(id: string, intro: string, view: BattleView): void;
  battleLog(entries: BattleLog[], view: BattleView | null): void;
  battleAdvance(): void;
  battleMenu(menu: BattleMenu): void;
  battleChooseItem(itemId: string | null): void;
}

const EMPTY_HUD: HudState = { district: '', location: '', clock: '', isNight: false, prompt: null, promptKey: 'E', speed: null, vehicleHealth: null, stars: 0, seen: false, turf: null, weather: 'clear', worldEvent: null };
let toastSeq = 1;

function shown(view: BattleView, side: 'player' | 'enemy', index = view.activeIndex): ShownCreature {
  const w = side === 'enemy' ? view.enemy : view.party[index];
  if (!w) return { name: '?', speciesId: 'glitchling', level: 1, hp: 0, maxHp: 1, status: null };
  return { name: w.name, speciesId: w.speciesId, level: w.level, hp: w.hp, maxHp: w.maxHp, status: w.status };
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'menu',
  session: null,
  sessionId: 0,
  paused: false,
  pauseTab: 'party',
  hud: EMPTY_HUD,
  dialogue: null,
  dialogueQueue: [],
  toasts: [],
  progress: null,
  battle: null,
  shopId: null,
  commandSink: null,
  snapshotSource: null,
  queries: null,
  musicVolume: 0.6,

  goTo: (screen) => set({ screen }),
  startSession: (session) =>
    set((s) => ({
      session,
      screen: 'game',
      sessionId: s.sessionId + 1,
      paused: false,
      dialogue: null,
      dialogueQueue: [],
      toasts: [],
      battle: null,
      shopId: null,
      progress: null,
      hud: EMPTY_HUD,
    })),
  quitToMenu: () => set({ screen: 'menu', paused: false, dialogue: null, dialogueQueue: [], battle: null, shopId: null, commandSink: null, snapshotSource: null, queries: null }),
  setPaused: (paused) => set({ paused }),
  setPauseTab: (pauseTab) => set({ pauseTab }),
  setHud: (hud) => {
    const prev = get().hud;
    if (
      prev.district === hud.district &&
      prev.location === hud.location &&
      prev.clock === hud.clock &&
      prev.isNight === hud.isNight &&
      prev.prompt === hud.prompt &&
      prev.promptKey === hud.promptKey &&
      prev.speed === hud.speed &&
      prev.vehicleHealth === hud.vehicleHealth &&
      prev.stars === hud.stars &&
      prev.seen === hud.seen &&
      prev.turf === hud.turf &&
      prev.weather === hud.weather &&
      prev.worldEvent === hud.worldEvent
    ) {
      return;
    }
    set({ hud });
  },
  openDialogue: (d) => {
    if (get().dialogue) set((s) => ({ dialogueQueue: [...s.dialogueQueue, d] }));
    else set({ dialogue: { ...d, page: 0 } });
  },
  advanceDialogue: () => {
    const d = get().dialogue;
    if (!d) return null;
    if (d.page < d.pages.length - 1) {
      set({ dialogue: { ...d, page: d.page + 1 } });
      return null;
    }
    const [next, ...rest] = get().dialogueQueue;
    if (next) {
      set({ dialogue: { ...next, page: 0 }, dialogueQueue: rest });
      return null;
    }
    set({ dialogue: null });
    return d;
  },
  pushToast: (text, tone = 'info') => set((s) => ({ toasts: [...s.toasts.slice(-4), { id: toastSeq++, text, tone }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setProgress: (progress) => set({ progress }),
  setShop: (shopId) => set({ shopId }),
  command: (cmd) => get().commandSink?.(cmd),

  battleStart: (id, intro, view) =>
    set({
      battle: {
        id,
        view,
        player: shown(view, 'player'),
        enemy: shown(view, 'enemy'),
        queue: [],
        message: intro,
        menu: 'main',
        outcome: null,
        pendingItem: null,
      },
    }),
  battleLog: (entries, view) => {
    const b = get().battle;
    if (!b) return;
    set({ battle: { ...b, view: view ?? b.view, queue: [...b.queue, ...entries], menu: 'main', pendingItem: null } });
    if (!b.message) pump(set, get);
  },
  battleAdvance: () => {
    const b = get().battle;
    if (!b) return;
    if (b.message) {
      set({ battle: { ...b, message: null } });
      pump(set, get);
      return;
    }
    if (b.queue.length === 0 && b.outcome) set({ battle: null });
  },
  battleMenu: (menu) => {
    const b = get().battle;
    if (b) set({ battle: { ...b, menu, pendingItem: null } });
  },
  battleChooseItem: (itemId) => {
    const b = get().battle;
    if (b) set({ battle: { ...b, pendingItem: itemId, menu: itemId ? 'party' : 'items' } });
  },
}));

/** Apply log entries until the next text message (or the queue runs dry). */
function pump(set: (p: Partial<GameStore>) => void, get: () => GameStore): void {
  let b = get().battle;
  if (!b) return;
  const queue = [...b.queue];
  let { player, enemy, outcome, message } = b;
  while (queue.length > 0 && !message) {
    const e = queue.shift()!;
    emitBattleFx(e);
    switch (e.t) {
      case 'text':
        message = e.text;
        break;
      case 'damage':
      case 'heal':
        if (e.side === 'player') player = { ...player, hp: e.hp, maxHp: e.max };
        else enemy = { ...enemy, hp: e.hp, maxHp: e.max };
        break;
      case 'status':
        if (e.side === 'player') player = { ...player, status: e.status };
        else enemy = { ...enemy, status: e.status };
        break;
      case 'switch':
        if (e.side === 'player') player = shown(b.view, 'player', e.index);
        else enemy = shown(b.view, 'enemy');
        break;
      case 'levelup': {
        const w = b.view.party.find((x) => x.uid === e.uid);
        if (w && w.speciesId === player.speciesId) player = { ...player, level: e.level };
        break;
      }
      case 'evolve': {
        const w = b.view.party.find((x) => x.uid === e.uid);
        if (w && player.speciesId === e.from) player = { ...player, speciesId: e.to, name: w.name, maxHp: w.maxHp, hp: w.hp };
        break;
      }
      case 'end':
        outcome = e.outcome;
        break;
      default:
        break;
    }
  }
  b = get().battle;
  if (!b) return;
  set({ battle: { ...b, queue, player, enemy, outcome, message } });
}
