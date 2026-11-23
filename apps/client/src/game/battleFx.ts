import type { BattleLog } from '@neon-wilds/sim';

/**
 * Tiny pub/sub that lets the battle presentation (React store) drive Phaser
 * animations in lockstep with the text, without either knowing the other.
 */
type Listener = (entry: BattleLog) => void;
const listeners = new Set<Listener>();

export function onBattleFx(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitBattleFx(entry: BattleLog): void {
  for (const l of listeners) l(entry);
}
