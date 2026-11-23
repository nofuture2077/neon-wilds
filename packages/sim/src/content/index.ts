import type { DistrictDefinition } from '../world/district';
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
};

export function getDistrictContent(id: string): DistrictContent {
  const content = DISTRICTS[id];
  if (!content) throw new Error(`Unknown district "${id}"`);
  return content;
}
