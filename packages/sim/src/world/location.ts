import type { DistrictLayout } from './district';

/**
 * Human-readable location for the HUD: the building you're at, the street
 * you're on, or "A & B" at a junction. Streets are named road-graph edges.
 */
export function describeLocation(layout: DistrictLayout, x: number, y: number): string {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const building = layout.buildings.find((b) => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h);
  if (building) return building.name;
  const { nodes, edges } = layout.graph;
  for (const n of nodes) {
    if (Math.hypot(n.x - x, n.y - y) > 5.5) continue;
    const names = [...new Set(n.edges.map((e) => edges[e]!.name).filter(Boolean))];
    if (names.length >= 2) return `${names[0]} & ${names[1]}`;
  }
  let best = '';
  let bestD = Infinity;
  for (const e of edges) {
    for (let k = 0; k < e.points.length; k += 2) {
      const p = e.points[k]!;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e.name;
      }
    }
  }
  return best || layout.name;
}
