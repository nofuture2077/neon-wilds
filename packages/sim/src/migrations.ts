import { newLawState } from './law/law';
import { newProgression } from './progression';
import { SNAPSHOT_VERSION, type SimSnapshot } from './state';

type AnySnapshot = { version: number } & Record<string, unknown>;

/**
 * Save-format migrations. Each step upgrades exactly one version and is a
 * pure function, so old saves keep loading forever. Add a step whenever
 * `SNAPSHOT_VERSION` increases, and a fixture test for it.
 */
const STEPS: Record<number, (s: AnySnapshot) => AnySnapshot> = {
  // v1 (Milestone 1) → v2 (Milestone 2): creatures, missions, battles.
  1: (s) => ({
    ...s,
    version: 2,
    npcs: (s.npcs as Record<string, unknown>[]).map((n) => ({ ...n, present: true, stationary: false })),
    wildlings: [],
    battle: null,
    progression: newProgression(),
    pendingEffects: [],
    encounterCooldownUntilTick: 0,
    nextEntityId: 1,
  }),
  // v2 (Milestone 2) → v3 (Milestone 3): vehicles.
  2: (s) => ({
    ...s,
    version: 3,
    player: { ...(s.player as Record<string, unknown>), vehicleId: null },
    vehicles: null,
  }),
  // v3 → v4: police and wanted levels.
  3: (s) => ({ ...s, version: 4, law: newLawState() }),
};

export function migrateSnapshot(raw: unknown): SimSnapshot {
  if (!raw || typeof raw !== 'object' || typeof (raw as AnySnapshot).version !== 'number') {
    throw new Error('Not a NEON WILDS snapshot');
  }
  let s = raw as AnySnapshot;
  if (s.version > SNAPSHOT_VERSION) throw new Error(`Snapshot version ${s.version} is newer than this game (${SNAPSHOT_VERSION})`);
  while (s.version < SNAPSHOT_VERSION) {
    const step = STEPS[s.version];
    if (!step) throw new Error(`No migration from snapshot version ${s.version}`);
    s = step(s);
  }
  return s as unknown as SimSnapshot;
}
