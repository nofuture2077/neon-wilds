import { describe, expect, it } from 'vitest';
import { SLUMS, Tile, generateDistrict, tileInfo, type TileMap } from '../src';

function floodPedestrian(map: TileMap, sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(map.width * map.height);
  const stack = [[sx, sy] as const];
  seen[sy * map.width + sx] = 1;
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.isPedestrianWalkable(nx, ny) || seen[ny * map.width + nx]) continue;
      seen[ny * map.width + nx] = 1;
      stack.push([nx, ny]);
    }
  }
  return seen;
}

describe('generateDistrict', () => {
  for (const seed of [1, 2, 1337, 0xdeadbeef]) {
    describe(`seed ${seed}`, () => {
      const layout = generateDistrict(SLUMS, seed);
      const { map } = layout;

      it('spawns the player on a free tile', () => {
        expect(map.isSolid(Math.floor(layout.playerSpawn.x), Math.floor(layout.playerSpawn.y))).toBe(false);
      });

      it('connects every pedestrian tile into one network', () => {
        const sx = Math.floor(layout.playerSpawn.x);
        const sy = Math.floor(layout.playerSpawn.y);
        const seen = floodPedestrian(map, sx, sy);
        for (let y = 0; y < map.height; y++) {
          for (let x = 0; x < map.width; x++) {
            if (map.isPedestrianWalkable(x, y)) expect(seen[y * map.width + x], `tile ${x},${y}`).toBe(1);
          }
        }
      });

      it('gives every building a reachable entrance and a door on its facade', () => {
        expect(layout.buildings.length).toBeGreaterThan(20);
        for (const b of layout.buildings) {
          expect(map.get(b.door.tx, b.door.ty)).toBe(Tile.Building);
          expect(map.isPedestrianWalkable(b.entrance.tx, b.entrance.ty), b.name).toBe(true);
          expect(b.name.length).toBeGreaterThan(0);
        }
      });

      it('places every named landmark exactly once', () => {
        for (const template of SLUMS.namedBuildings) {
          expect(layout.buildings.filter((b) => b.name === template.name)).toHaveLength(1);
        }
      });

      it('keeps solid props off pedestrian crosswalks', () => {
        for (const p of layout.props.filter((p) => p.solid)) {
          for (let y = p.y; y < p.y + p.h; y++) {
            for (let x = p.x; x < p.x + p.w; x++) {
              const t = map.get(x, y);
              expect(t === Tile.CrosswalkH || t === Tile.CrosswalkV).toBe(false);
              expect(tileInfo(t).solid).toBe(false);
            }
          }
        }
      });
    });
  }

  it('is deterministic for a given seed', () => {
    const a = generateDistrict(SLUMS, 99);
    const b = generateDistrict(SLUMS, 99);
    expect(Array.from(a.map.tiles)).toEqual(Array.from(b.map.tiles));
    expect(a.buildings).toEqual(b.buildings);
    expect(a.props).toEqual(b.props);
  });
});

describe('street generation v2 (organic grid)', () => {
  const drivable = (t: number) => t === Tile.Road || t === Tile.RoadLineH || t === Tile.RoadLineV || t === Tile.CrosswalkH || t === Tile.CrosswalkV;

  it('keeps every road tile in one connected network', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { map } = generateDistrict(SLUMS, seed);
      let start = -1;
      let total = 0;
      for (let i = 0; i < map.tiles.length; i++) {
        if (drivable(map.tiles[i]!)) {
          total++;
          if (start < 0) start = i;
        }
      }
      const seen = new Uint8Array(map.tiles.length);
      const stack = [start];
      seen[start] = 1;
      let count = 0;
      while (stack.length) {
        const i = stack.pop()!;
        count++;
        const x = i % map.width;
        const y = Math.floor(i / map.width);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (!map.inBounds(nx, ny)) continue;
          const ni = ny * map.width + nx;
          if (!seen[ni] && drivable(map.tiles[ni]!)) {
            seen[ni] = 1;
            stack.push(ni);
          }
        }
      }
      expect(count, `seed ${seed}`).toBe(total);
    }
  });

  it('varies layouts between seeds (different sizes and merged superblocks)', () => {
    const sizes = new Set<string>();
    for (const seed of [11, 12, 13, 14, 15]) {
      const l = generateDistrict(SLUMS, seed);
      sizes.add(`${l.map.width}x${l.map.height}`);
    }
    expect(sizes.size).toBeGreaterThan(1);
  });
});
