import type { DistrictLayout } from './district';

/** Human-readable location for the HUD, e.g. "Rook Avenue" or "Cinder Row & Rook Avenue". */
export function describeLocation(layout: DistrictLayout, x: number, y: number): string {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const vertical = layout.streets.filter((s) => s.axis === 'vertical');
  const horizontal = layout.streets.filter((s) => s.axis === 'horizontal');
  const onV = vertical.find((s) => tx >= s.from && tx <= s.to);
  const onH = horizontal.find((s) => ty >= s.from && ty <= s.to);
  if (onV && onH) return `${onH.name} & ${onV.name}`;
  if (onV) return onV.name;
  if (onH) return onH.name;

  const building = layout.buildings.find((b) => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h);
  if (building) return building.name;

  let nearest = '';
  let best = Infinity;
  for (const s of layout.streets) {
    const c = (s.from + s.to + 1) / 2;
    const d = Math.abs((s.axis === 'vertical' ? x : y) - c);
    if (d < best) {
      best = d;
      nearest = s.name;
    }
  }
  return nearest;
}
