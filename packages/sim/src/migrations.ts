import { newLawState } from './law/law';
import { newWorldState } from './world/director';
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
  // v4 → v5: factions, territory and the economy.
  4: (s) => {
    const progression = s.progression as Record<string, unknown>;
    return {
      ...s,
      version: 5,
      day: 0,
      territory: null,
      market: { demand: {} },
      progression: { ...progression, reputation: newProgression().reputation },
    };
  },
  // v5 → v6: routines, memory, indoor state, crowd pedestrians. Agents are re-created on load.
  5: (s) => ({
    ...s,
    version: 6,
    npcs: (s.npcs as Record<string, unknown>[]).map((n) => ({ ...n, agent: null, indoors: null, transient: false, memory: [] })),
  }),
  // v6 → v7: faction GOAP agents and the world director.
  6: (s) => ({ ...s, version: 7, factions: null, world: newWorldState() }),
  // v7 → v8: procedural missions.
  7: (s) => ({
    ...s,
    version: 8,
    progression: { ...(s.progression as Record<string, unknown>), generated: [], board: [], missionSeq: 1, boardDay: -1 },
  }),
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
