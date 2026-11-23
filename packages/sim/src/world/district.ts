import type { RoadGraph } from './cityGen';
import type { TileMap } from './tilemap';

export type Facing = 'north' | 'south' | 'east' | 'west';

export type BuildingKind = 'residential' | 'shop' | 'bar' | 'clinic' | 'workshop' | 'warehouse' | 'office';

export type BuildingService = { kind: 'clinic' } | { kind: 'shop'; shopId: string };

export interface BuildingTemplate {
  name: string;
  kind: BuildingKind;
  service?: BuildingService;
  /** Text shown when the player inspects the entrance. */
  description: string;
  /** Neon sign colour as 0xRRGGBB; omitted for unlit buildings. */
  neon?: number;
}

export interface Building {
  id: string;
  /**
   * Footprint in tiles, before rotation: the rectangle (x, y, w, h) is turned by
   * `angle` around its centre (x + w/2, y + h/2) so it lines up with its street.
   * x and y may be fractional. The tile map marks covered tiles as Building.
   */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation in radians, within ±45° (the art stays upright; `door.facing` is in the building's frame). */
  angle: number;
  name: string;
  kind: BuildingKind;
  description: string;
  neon: number | null;
  service: BuildingService | null;
  /** Visual style index; the renderer maps it to a roof palette. */
  style: number;
  /** Tile in the facade that holds the door. */
  door: { tx: number; ty: number; facing: Facing };
  /** Walkable tile directly outside the door. */
  entrance: { tx: number; ty: number };
  /** District region the building stands in. */
  region: string;
  /** The region's signature building (taller, spotlit). */
  landmark: boolean;
}

export type PropKind = 'parked-car' | 'street-lamp' | 'bench' | 'dumpster' | 'container';

export interface Prop {
  id: string;
  kind: PropKind;
  /** Footprint in tiles. */
  x: number;
  y: number;
  w: number;
  h: number;
  solid: boolean;
  /** Free-form visual variant (car colour, lamp type...). */
  variant: number;
  facing: Facing;
}

export interface Street {
  name: string;
  axis: 'horizontal' | 'vertical';
  /** First and last tile of the road band across its width. */
  from: number;
  to: number;
}

export interface DistrictDefinition {
  id: string;
  name: string;
  blocksX: number;
  blocksY: number;
  blockW: number;
  blockH: number;
  roadW: number;
  /** Block (bx, by) that becomes a park. */
  parkBlock: { bx: number; by: number };
  verticalStreets: string[];
  horizontalStreets: string[];
  namedBuildings: BuildingTemplate[];
  residentialNames: string[];
  /** Chance to merge neighbouring blocks into superblocks (0 = strict grid). */
  mergeChance?: number;
  /** Visual style hint for the renderer. */
  style?: 'slums' | 'downtown' | 'harbor' | 'industrial';
  /** The southern block row becomes quays, piers and open water. */
  waterfront?: boolean;
  /** Road connections to other districts at the map edge. */
  exits?: DistrictExit[];
}

export interface DistrictExit {
  to: string;
  side: 'east' | 'west';
  /** Horizontal street that continues into the other district. */
  street: string;
}

export interface CityBlock {
  id: string;
  /** Bounding box (blocks are irregular since world generation v3). */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'lots' | 'park' | 'square' | 'docks' | 'wild' | 'pocket';
  region: string;
  area: number;
}

export interface RegionInfo {
  id: string;
  name: string;
  style: 'slums' | 'downtown' | 'harbor' | 'industrial';
}

export interface DistrictLayout {
  id: string;
  name: string;
  /** Road graph (world generation v3); empty for legacy grid layouts. */
  graph: RoadGraph;
  /** Region index per tile (into `regions`). */
  regionMap: Uint8Array;
  /** Per tile: index into `blocks`, or -1 for roads and sidewalks. */
  blockMap: Int32Array;
  regions: RegionInfo[];
  style: 'slums' | 'downtown' | 'harbor' | 'industrial';
  exits: DistrictExit[];
  map: TileMap;
  blocks: CityBlock[];
  buildings: Building[];
  props: Prop[];
  streets: Street[];
  playerSpawn: { x: number; y: number };
  pedestrianSpawns: { tx: number; ty: number }[];
}

/** Whether a point (in tiles) lies inside a building's rotated footprint. */
export function buildingContains(b: Building, px: number, py: number, pad = 0): boolean {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const dx = px - cx;
  const dy = py - cy;
  const u = dx * c + dy * s;
  const v = -dx * s + dy * c;
  return Math.abs(u) <= b.w / 2 + pad && Math.abs(v) <= b.h / 2 + pad;
}
