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
