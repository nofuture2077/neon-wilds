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
  /** Footprint in tiles. */
  x: number;
  y: number;
  w: number;
  h: number;
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
}

export type PropKind = 'parked-car' | 'street-lamp' | 'bench' | 'dumpster';

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
}

export interface DistrictLayout {
  id: string;
  name: string;
  map: TileMap;
  buildings: Building[];
  props: Prop[];
  streets: Street[];
  playerSpawn: { x: number; y: number };
  pedestrianSpawns: { tx: number; ty: number }[];
}
