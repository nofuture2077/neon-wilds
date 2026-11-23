import { useGameStore } from './state/gameStore';

/**
 * Development-only shortcut: `/?quickstart&seed=42&time=22:00` skips the menus.
 * Stripped from production builds by the `import.meta.env.DEV` guard.
 */
export function applyDevQuickstart(): void {
  if (!import.meta.env.DEV) return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has('quickstart')) return;
  const [h, m] = (params.get('time') ?? '').split(':').map(Number);
  const startMinutes =
    params.has('time') && h !== undefined && Number.isFinite(h) ? h * 60 + (m !== undefined && Number.isFinite(m) ? m : 0) : undefined;
  useGameStore.getState().startSession({ kind: 'new', setup: {
    playerName: params.get('name') ?? 'Ash',
    seed: Number(params.get('seed') ?? 1337) >>> 0,
    appearance: { skin: 0xe0ac69, hair: 0x111111, top: 0x00e5ff, bottom: 0x222233 },
    ...(startMinutes !== undefined ? { startMinutes } : {}),
  } });
}
