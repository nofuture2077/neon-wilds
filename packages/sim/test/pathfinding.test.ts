import { describe, expect, it } from 'vitest';
import { Pathfinder, type PathGrid } from '../src';

function gridFrom(rows: string[]): PathGrid {
  return {
    width: rows[0]!.length,
    height: rows.length,
    passable: (x, y) => rows[y]?.[x] === '.',
  };
}

describe('Pathfinder', () => {
  it('finds a path around a wall', () => {
    const grid = gridFrom(['.....', '.###.', '.#...', '.#.#.', '...#.']);
    const path = new Pathfinder(grid).find({ tx: 0, ty: 0 }, { tx: 2, ty: 3 });
    expect(path).not.toBeNull();
    expect(path!.at(-1)).toEqual({ tx: 2, ty: 3 });
    for (const step of path!) expect(grid.passable(step.tx, step.ty)).toBe(true);
  });

  it('never cuts corners diagonally', () => {
    const grid = gridFrom(['.#', '..']);
    const path = new Pathfinder(grid).find({ tx: 0, ty: 0 }, { tx: 1, ty: 1 });
    expect(path).toEqual([
      { tx: 0, ty: 1 },
      { tx: 1, ty: 1 },
    ]);
  });

  it('returns null when the goal is unreachable', () => {
    const grid = gridFrom(['..#..', '..#..', '..#..']);
    expect(new Pathfinder(grid).find({ tx: 0, ty: 0 }, { tx: 4, ty: 2 })).toBeNull();
  });

  it('returns an empty path when already at the goal', () => {
    const grid = gridFrom(['...']);
    expect(new Pathfinder(grid).find({ tx: 1, ty: 0 }, { tx: 1, ty: 0 })).toEqual([]);
  });

  it('produces optimal (octile) length on open ground and is reusable', () => {
    const grid = gridFrom(Array.from({ length: 20 }, () => '.'.repeat(20)));
    const pf = new Pathfinder(grid);
    for (let i = 0; i < 3; i++) {
      const path = pf.find({ tx: 0, ty: 0 }, { tx: 10, ty: 4 });
      expect(path).toHaveLength(10);
    }
  });
});
