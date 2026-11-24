import { useSyncExternalStore } from 'react';

/**
 * Player settings (accessibility and controls), kept in localStorage. Pure
 * presentation: nothing here reaches the simulation or the save file.
 */
export type GameAction = 'up' | 'down' | 'left' | 'right' | 'run' | 'interact' | 'vehicle' | 'pause';

export const ACTION_LABELS: Record<GameAction, string> = {
  up: 'Move up',
  down: 'Move down',
  left: 'Move left',
  right: 'Move right',
  run: 'Run / handbrake',
  interact: 'Talk / interact',
  vehicle: 'Enter / exit vehicle',
  pause: 'Pause menu',
};

/** Primary key per action (rebindable). */
export const DEFAULT_BINDINGS: Record<GameAction, string> = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  run: 'ShiftLeft',
  interact: 'KeyE',
  vehicle: 'KeyF',
  pause: 'Escape',
};

/** Keys that always work in addition to the binding (arrows, Enter/Space, right Shift). */
export const FIXED_KEYS: Partial<Record<GameAction, string[]>> = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  run: ['ShiftRight'],
  interact: ['Space', 'Enter', 'NumpadEnter'],
};

export type TextSize = 'normal' | 'large' | 'huge';

export interface Settings {
  bindings: Record<GameAction, string>;
  textSize: TextSize;
  /** Swap the red/green-dependent UI colours for a blue/orange palette. */
  colourBlind: boolean;
  /** No screen flashes and no flickering lights. */
  reduceFlashing: boolean;
  screenShake: boolean;
}

const KEY = 'neon-wilds-settings';
const DEFAULTS: Settings = { bindings: { ...DEFAULT_BINDINGS }, textSize: 'normal', colourBlind: false, reduceFlashing: false, screenShake: true };

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    if (!raw) return { ...DEFAULTS, bindings: { ...DEFAULT_BINDINGS } };
    return { ...DEFAULTS, ...raw, bindings: { ...DEFAULT_BINDINGS, ...(raw.bindings ?? {}) } };
  } catch {
    return { ...DEFAULTS, bindings: { ...DEFAULT_BINDINGS } };
  }
}

let current: Settings = load();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch, bindings: { ...current.bindings, ...(patch.bindings ?? {}) } };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // storage unavailable: settings last for this session only
  }
  applyDocumentSettings();
  for (const l of listeners) l();
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/** Rebind an action; a key already used by another action is swapped onto it. */
export function rebind(action: GameAction, code: string): void {
  const bindings = { ...current.bindings };
  const clash = (Object.keys(bindings) as GameAction[]).find((a) => a !== action && bindings[a] === code);
  if (clash) bindings[clash] = bindings[action];
  bindings[action] = code;
  updateSettings({ bindings });
}

export function keysFor(action: GameAction): string[] {
  return [current.bindings[action], ...(FIXED_KEYS[action] ?? [])];
}

/** Human-readable key name for a KeyboardEvent.code. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code] ?? code;
  return { ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ControlLeft: 'Ctrl', Escape: 'Esc', Space: 'Space', Enter: 'Enter', Tab: 'Tab' }[code] ?? code;
}

/** Text size and palette live on <html> as CSS hooks. */
export function applyDocumentSettings(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.fontSize = { normal: '100%', large: '115%', huge: '130%' }[current.textSize];
  root.dataset.palette = current.colourBlind ? 'cb' : 'default';
}

/** HP bar colours: green/yellow/red, or blue/yellow/orange in the colour-blind palette. */
export function hpColour(fraction: number): string {
  const cb = current.colourBlind;
  if (fraction > 0.5) return cb ? '#3fa9ff' : '#4fffb0';
  if (fraction > 0.2) return '#ffd23f';
  return cb ? '#ff8a00' : '#ff4f5e';
}
