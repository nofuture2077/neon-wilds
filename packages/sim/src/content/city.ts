import type { CityDefinition, RegionDefinition } from '../world/cityGen';
import { DOWNTOWN } from './downtown';
import { HARBOR } from './harbor';
import { INDUSTRIAL } from './industrial';
import { OLDTOWN } from './oldtown';
import { OUTSKIRTS } from './outskirts';
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
  width: 290,
  height: 190,
  spawnRegion: 'slums',
  regions: [
    region(INDUSTRIAL, { anchor: { x: 0.2, y: 0.7 }, blockSize: [24, 42], regularity: 0.5, merges: 0.15, superblocks: 0.2, deadEnds: 0.35, alleys: 0.15, setbacks: 0.45, terraces: 0.15, wildChance: 0.08, buildingW: [7, 12], buildingH: [6, 9], parkChance: 0.04 }, 'The Furnace Pits'),
    region(SLUMS, { anchor: { x: 0.46, y: 0.58 }, blockSize: [16, 27], regularity: 0.05, merges: 0.2, superblocks: 0.08, deadEnds: 0.45, alleys: 0.55, setbacks: 0.2, terraces: 0.55, wildChance: 0.06, buildingW: [3, 6], buildingH: [3, 5], parkChance: 0.1 }, 'Vesper Courier Co-op'),
    region(DOWNTOWN, { anchor: { x: 0.68, y: 0.27 }, blockSize: [19, 30], regularity: 0.7, merges: 0.08, superblocks: 0.15, deadEnds: 0.05, alleys: 0.35, setbacks: 0.12, terraces: 0.7, wildChance: 0, buildingW: [6, 10], buildingH: [5, 8], parkChance: 0.05 }, 'Lumen Spire'),
    region(OLDTOWN, { anchor: { x: 0.34, y: 0.2 }, blockSize: [15, 25], regularity: 0.05, superblocks: 0.12, deadEnds: 0.4, alleys: 0.6, setbacks: 0.1, terraces: 0.75, wildChance: 0.07, merges: 0.25, buildingW: [4, 7], buildingH: [4, 6], parkChance: 0.08 }, 'Cathedral of Saint Verity'),
    region(OUTSKIRTS, { anchor: { x: 0.08, y: 0.3 }, blockSize: [22, 38], regularity: 0.1, superblocks: 0.15, deadEnds: 0.6, alleys: 0, setbacks: 0.6, terraces: 0, wildChance: 0.3, merges: 0.3, buildingW: [4, 7], buildingH: [3, 5], parkChance: 0 }, 'Marsh Lighthouse'),
    region(HARBOR, { anchor: { x: 0.83, y: 0.68 }, blockSize: [18, 32], regularity: 0.3, merges: 0.15, superblocks: 0.1, deadEnds: 0.35, alleys: 0.3, setbacks: 0.25, terraces: 0.35, wildChance: 0.03, buildingW: [5, 8], buildingH: [4, 6], parkChance: 0.04 }, 'Night Market'),
  ],
};
