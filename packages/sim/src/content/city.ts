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
 * Vesper City as one seamless map (world generation v4). Each district is a
 * region with its own street grammar on a shared orthogonal plan: Industrial
 * big yards and brownfields, the Slums small crooked blocks full of dead ends
 * and alleys, Downtown a near-regular grid with plazas, the Harbor in between
 * and down to the docks.
 */
export const VESPER: CityDefinition = {
  id: 'vesper',
  name: 'Vesper City',
  width: 230,
  height: 170,
  spawnRegion: 'slums',
  regions: [
    region(INDUSTRIAL, { anchor: { x: 0.16, y: 0.45 }, blockSize: [24, 42], regularity: 0.5, merges: 0.15, superblocks: 0.2, deadEnds: 0.35, alleys: 0.15, setbacks: 0.45, terraces: 0.15, wildChance: 0.08, buildingW: [7, 12], buildingH: [6, 9], parkChance: 0.04 }, 'The Furnace Pits'),
    region(SLUMS, { anchor: { x: 0.4, y: 0.56 }, blockSize: [16, 27], regularity: 0.05, merges: 0.2, superblocks: 0.08, deadEnds: 0.45, alleys: 0.55, setbacks: 0.2, terraces: 0.55, wildChance: 0.06, buildingW: [3, 6], buildingH: [3, 5], parkChance: 0.1 }, 'Vesper Courier Co-op'),
    region(DOWNTOWN, { anchor: { x: 0.63, y: 0.32 }, blockSize: [19, 30], regularity: 0.7, merges: 0.08, superblocks: 0.15, deadEnds: 0.05, alleys: 0.35, setbacks: 0.12, terraces: 0.7, wildChance: 0, buildingW: [6, 10], buildingH: [5, 8], parkChance: 0.05 }, 'Lumen Spire'),
    region(HARBOR, { anchor: { x: 0.8, y: 0.66 }, blockSize: [18, 32], regularity: 0.3, merges: 0.15, superblocks: 0.1, deadEnds: 0.35, alleys: 0.3, setbacks: 0.25, terraces: 0.35, wildChance: 0.03, buildingW: [5, 8], buildingH: [4, 6], parkChance: 0.04 }, 'Night Market'),
  ],
};
