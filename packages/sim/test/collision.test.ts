import { describe, expect, it } from 'vitest';
import { TileMap, Tile, moveAndCollide, overlapsSolid } from '../src';

function room(): TileMap {
  const map = new TileMap(10, 10);
  map.fillRect(0, 0, 10, 10, Tile.Sidewalk);
  map.set(5, 5, Tile.Building);
  map.rebuildCollision();
  return map;
}

describe('moveAndCollide', () => {
  it('stops flush against a solid tile', () => {
    const map = room();
    const res = moveAndCollide(map, 4.0, 5.5, 0.3, 0.9, 0);
    expect(res.blockedX).toBe(true);
    expect(res.x).toBeCloseTo(5 - 0.3, 3);
    expect(overlapsSolid(map, res.x, res.y, 0.3)).toBe(false);
  });

  it('slides along walls on the free axis', () => {
    const map = room();
    const res = moveAndCollide(map, 4.6, 5.5, 0.3, 0.5, 0.5);
    expect(res.blockedX).toBe(true);
    expect(res.blockedY).toBe(false);
    expect(res.y).toBeCloseTo(6.0, 5);
  });

  it('treats the map boundary as solid', () => {
    const map = room();
    const res = moveAndCollide(map, 0.5, 0.5, 0.3, -2, -2);
    expect(res.x).toBeGreaterThanOrEqual(0.3);
    expect(res.y).toBeGreaterThanOrEqual(0.3);
  });

  it('does not tunnel through a wall with a large displacement', () => {
    const map = room();
    const res = moveAndCollide(map, 3.5, 5.5, 0.3, 4, 0);
    expect(res.x).toBeLessThan(5);
  });
});
