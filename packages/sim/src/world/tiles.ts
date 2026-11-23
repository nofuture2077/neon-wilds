/**
 * Ground tile kinds. The numeric values are part of the save format and the
 * renderer's tileset contract — append new kinds, never renumber.
 */
export const Tile = {
  Void: 0,
  Road: 1,
  RoadLineH: 2,
  RoadLineV: 3,
  CrosswalkH: 4, // crossing runs west-east (spans a north-south road)
  CrosswalkV: 5, // crossing runs north-south (spans a west-east road)
  Sidewalk: 6,
  Alley: 7,
  Grass: 8,
  Plaza: 9,
  Water: 10,
  Building: 11,
  Tree: 12,
} as const;

export type TileKind = (typeof Tile)[keyof typeof Tile];

interface TileInfo {
  /** Blocks movement of characters. */
  solid: boolean;
  /** Pedestrian AI may route through this tile. The player may walk on any non-solid tile. */
  pedestrian: boolean;
  /** Vehicles may drive here (used from Milestone 3). */
  drivable: boolean;
}

const INFO: Record<TileKind, TileInfo> = {
  [Tile.Void]: { solid: true, pedestrian: false, drivable: false },
  [Tile.Road]: { solid: false, pedestrian: false, drivable: true },
  [Tile.RoadLineH]: { solid: false, pedestrian: false, drivable: true },
  [Tile.RoadLineV]: { solid: false, pedestrian: false, drivable: true },
  [Tile.CrosswalkH]: { solid: false, pedestrian: true, drivable: true },
  [Tile.CrosswalkV]: { solid: false, pedestrian: true, drivable: true },
  [Tile.Sidewalk]: { solid: false, pedestrian: true, drivable: false },
  [Tile.Alley]: { solid: false, pedestrian: true, drivable: false },
  [Tile.Grass]: { solid: false, pedestrian: true, drivable: false },
  [Tile.Plaza]: { solid: false, pedestrian: true, drivable: false },
  [Tile.Water]: { solid: true, pedestrian: false, drivable: false },
  [Tile.Building]: { solid: true, pedestrian: false, drivable: false },
  [Tile.Tree]: { solid: true, pedestrian: false, drivable: false },
};

export function tileInfo(kind: TileKind): TileInfo {
  return INFO[kind];
}

export function isRoadKind(kind: TileKind): boolean {
  return kind === Tile.Road || kind === Tile.RoadLineH || kind === Tile.RoadLineV;
}
