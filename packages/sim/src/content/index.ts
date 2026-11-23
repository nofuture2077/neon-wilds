import type { DistrictDefinition } from '../world/district';
import { DOWNTOWN, DOWNTOWN_ARCHETYPES, DOWNTOWN_NPCS } from './downtown';
import { HARBOR, HARBOR_ARCHETYPES, HARBOR_NPCS } from './harbor';
import { SLUMS, SLUMS_ARCHETYPES, SLUMS_NPCS } from './slums';
import type { NpcArchetype, NpcDefinition } from './types';

/** Everything data-driven that a district needs to be simulated. */
export interface DistrictContent {
  district: DistrictDefinition;
  archetypes: NpcArchetype[];
  npcs: NpcDefinition[];
}

export const DISTRICTS: Record<string, DistrictContent> = {
  slums: { district: SLUMS, archetypes: SLUMS_ARCHETYPES, npcs: SLUMS_NPCS },
  downtown: { district: DOWNTOWN, archetypes: DOWNTOWN_ARCHETYPES, npcs: DOWNTOWN_NPCS },
  harbor: { district: HARBOR, archetypes: HARBOR_ARCHETYPES, npcs: HARBOR_NPCS },
};

/** Every NPC archetype across all districts (NPCs keep their archetype when the player travels). */
export function allArchetypes() {
  return Object.values(DISTRICTS).flatMap((d) => d.archetypes);
}

export function getDistrictContent(id: string): DistrictContent {
  const content = DISTRICTS[id];
  if (!content) throw new Error(`Unknown district "${id}"`);
  return content;
}
