import type { DistrictLayout, RegionInfo } from './district';

const FALLBACK: RegionInfo = { id: 'slums', name: 'The Slums', style: 'slums' };

/** District region at a world position. */
export function regionOf(layout: DistrictLayout, x: number, y: number): RegionInfo {
  const { width, height } = layout.map;
  const tx = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const ty = Math.max(0, Math.min(height - 1, Math.floor(y)));
  return layout.regions[layout.regionMap[ty * width + tx] ?? 0] ?? FALLBACK;
}
