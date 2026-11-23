/** Render layer order for the world scene. */
export const Depth = {
  ground: 0,
  groundProps: 5,
  shadows: 8,
  buildingShadow: 9,
  actors: 20,
  buildings: 30,
  canopy: 40,
  darkness: 100,
  glow: 110,
  focus: 120,
  barks: 130,
} as const;
