import type { CityDefinition, RegionDefinition } from '../world/cityGen';
import { DOWNTOWN } from './downtown';
import { HARBOR } from './harbor';
import { INDUSTRIAL } from './industrial';
import { SLUMS } from './slums';
import type { DistrictDefinition } from '../world/district';

const streets = (d: DistrictDefinition) => [...d.horizontalStreets, ...d.verticalStreets];

/** Put a district's landmark first: the generator gives the first named building the landmark plot. */
const landmarkFirst = (d: DistrictDefinition, landmark: string) => [
  ...d.namedBuildings.filter((b) => b.name === landmark),
  ...d.namedBuildings.filter((b) => b.name !== landmark),
];

const region = (d: DistrictDefinition, r: Omit<RegionDefinition, 'id' | 'name' | 'style' | 'namedBuildings' | 'residentialNames' | 'streetNames'>, landmark: string): RegionDefinition => ({
  id: d.id,
  name: d.name,
  style: (d.style ?? 'slums') as RegionDefinition['style'],
  namedBuildings: landmarkFirst(d, landmark),
  residentialNames: d.residentialNames,
  streetNames: streets(d),
  ...r,
});

/**
 * Vesper City as one seamless map (world generation v3). Each district is a
 * region with its own street grammar: Industrial wide and straight, the Slums
 * winding and tangled, Downtown a rotated near-grid, the Harbor following
 * the coast.
 */
export const VESPER: CityDefinition = {
  id: 'vesper',
  name: 'Vesper City',
  width: 230,
  height: 170,
  spawnRegion: 'slums',
  regions: [
    region(INDUSTRIAL, { anchor: { x: 0.16, y: 0.45 }, spacing: 30, jitter: 0.12, angle: 0.12, curviness: 0.15, loops: 0.35, buildingW: [7, 12], buildingH: [6, 9], parkChance: 0.04 }, 'The Furnace Pits'),
    region(SLUMS, { anchor: { x: 0.4, y: 0.56 }, spacing: 22, jitter: 0.3, angle: -0.35, curviness: 0.5, loops: 0.55, buildingW: [3, 6], buildingH: [3, 5], parkChance: 0.1 }, 'Vesper Courier Co-op'),
    region(DOWNTOWN, { anchor: { x: 0.63, y: 0.32 }, spacing: 26, jitter: 0.06, angle: 0.42, curviness: 0.04, loops: 0.9, buildingW: [6, 10], buildingH: [5, 8], parkChance: 0.07 }, 'Lumen Spire'),
    region(HARBOR, { anchor: { x: 0.8, y: 0.66 }, spacing: 24, jitter: 0.2, angle: 0.85, curviness: 0.3, loops: 0.5, buildingW: [5, 8], buildingH: [4, 6], parkChance: 0.04 }, 'Night Market'),
  ],
};
