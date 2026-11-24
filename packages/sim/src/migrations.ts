import { newLawState } from './law/law';
import { newWorldState } from './world/director';
import { newProgression } from './progression';
import { newStats } from './achievements';
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
  // v8 → v9: multi-district city.
  8: (s) => ({ ...s, version: 9, away: {} }),
  // v9 → v10: story choices.
  9: (s) => ({ ...s, version: 10, pendingChoice: null }),
  // v10 → v11: one seamless organic city replaces the district grids.
  10: (s) => rebuildWorld(s, 11),
  // v11 → v12: orthogonal street plan (world gen v4) and Old Town; the map changed under everyone's feet.
  11: (s) => rebuildWorld(s, 12),
  // v12 → v13: the Outskirts widen the map.
  12: (s) => rebuildWorld(s, 13),
  // v13 → v14: lifetime statistics.
  13: (s) => ({ ...s, version: 14, progression: { ...(s.progression as Record<string, unknown>), stats: newStats() } }),
};

/**
 * The city layout changed: progression, story, reputation and the clock carry over; the world
 * (positions, NPCs, cars, territory) is rebuilt around the player at the spawn point.
 */
function rebuildWorld(s: AnySnapshot, version: number): AnySnapshot {
  return {
    ...s,
    version,
    districtId: 'vesper',
    player: { ...(s.player as Record<string, unknown>), x: -1, y: -1, prevX: -1, prevY: -1, vehicleId: null, conversationWith: null },
    npcs: [],
    wildlings: [],
    vehicles: null,
    territory: null,
    factions: null,
    battle: null,
    pendingChoice: null,
    away: {},
    law: newLawState(),
  };
}

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
