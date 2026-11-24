import { describe, expect, it } from 'vitest';
import { DISTRICTS, Tile, VESPER, generateCity, regionOf, type TileMap } from '../src';

function flood(map: TileMap, start: number, ok: (x: number, y: number) => boolean): Uint8Array {
  const seen = new Uint8Array(map.width * map.height);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % map.width;
    const y = (i - x) / map.width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny) || !ok(nx, ny)) continue;
      const ni = ny * map.width + nx;
      if (seen[ni]) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}

const drivable = (t: number) => t === Tile.Road || t === Tile.CrosswalkH || t === Tile.CrosswalkV;

describe('city generator (world gen v4)', () => {
  for (const seed of [1, 2, 1337]) {
    describe(`seed ${seed}`, () => {
      const city = generateCity(VESPER, seed);
      const { map } = city;

      it('has a connected, orthogonal but irregular street network', () => {
        const start = map.tiles.findIndex((t) => drivable(t));
        const seen = flood(map, start, (x, y) => drivable(map.get(x, y)));
        for (let i = 0; i < map.tiles.length; i++) if (drivable(map.tiles[i]!)) expect(seen[i], `road tile ${i}`).toBe(1);
        expect(city.graph.edges.length).toBeGreaterThan(60);
        // Every street is axis-aligned...
        for (const e of city.graph.edges) {
          const a = e.points[0]!;
          const b = e.points[e.points.length - 1]!;
          expect(a.x === b.x || a.y === b.y, `edge ${e.id}`).toBe(true);
        }
        // ...but not a regular grid: mostly T-junctions, some dead ends, and blocks of many sizes.
        const deg = (k: number) => city.graph.nodes.filter((n) => n.edges.length === k).length;
        expect(deg(3)).toBeGreaterThan(deg(4) * 3);
        expect(deg(1)).toBeGreaterThan(2);
        const lots = city.blocks.filter((b) => b.kind === 'lots');
        expect(new Set(lots.map((b) => `${b.w}x${b.h}`)).size).toBeGreaterThan(lots.length * 0.7);
        expect(city.graph.edges.some((e) => e.avenue)).toBe(true);
        expect(map.tiles.some((t) => t === Tile.Alley)).toBe(true);
      });

      it('connects every pedestrian tile into one network', () => {
        const start = city.pedestrianSpawns[0]!;
        const seen = flood(map, start.ty * map.width + start.tx, (x, y) => map.isPedestrianWalkable(x, y));
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
          if (map.isPedestrianWalkable(x, y)) expect(seen[y * map.width + x], `tile ${x},${y}`).toBe(1);
        }
      });

      it('places every named building of every district exactly once, with a reachable entrance', () => {
        for (const d of Object.values(DISTRICTS)) {
          for (const t of d.district.namedBuildings) {
            const found = city.buildings.filter((b) => b.name === t.name);
            expect(found, t.name).toHaveLength(1);
            expect(map.isPedestrianWalkable(found[0]!.entrance.tx, found[0]!.entrance.ty), t.name).toBe(true);
            expect(found[0]!.region).toBe(d.district.id);
          }
        }
      });

      it('has a landmark, parks and varied buildings in every region', () => {
        for (const r of VESPER.regions) {
          expect(city.buildings.filter((b) => b.region === r.id && b.landmark), r.id).toHaveLength(1);
        }
        expect(city.blocks.filter((b) => b.kind === 'park').length).toBeGreaterThanOrEqual(3);
        const sizes = new Set(city.buildings.map((b) => `${b.w}x${b.h}`));
        expect(sizes.size).toBeGreaterThan(15);
        expect(map.tiles.some((t) => t === Tile.Water)).toBe(true);
      });

      it('assigns regions so each district has its own area', () => {
        for (const r of VESPER.regions) {
          const at = regionOf(city, r.anchor.x * map.width, r.anchor.y * map.height);
          expect(at.id).toBe(r.id);
        }
      });
    });
  }

  it('is deterministic per seed', () => {
    const a = generateCity(VESPER, 9);
    const b = generateCity(VESPER, 9);
    expect(Array.from(a.map.tiles)).toEqual(Array.from(b.map.tiles));
    expect(a.buildings).toEqual(b.buildings);
  });
});
