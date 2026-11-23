import { ELEMENT_COLORS, type ElementType, type StatusKind } from '@neon-wilds/sim';
import { css } from '../game/assets/canvas';
import { buildCreatureSheet } from '../game/assets/creatures';

const imageCache = new Map<string, string>();

/** Data URL of a species' first battle-sprite frame (cached). Shares art with the game. */
export function creatureImage(speciesId: string): string {
  let url = imageCache.get(speciesId);
  if (!url) {
    const sheet = buildCreatureSheet(speciesId, 48);
    const frame = document.createElement('canvas');
    frame.width = 48;
    frame.height = 48;
    frame.getContext('2d')?.drawImage(sheet.canvas, 0, 0, 48, 48, 0, 0, 48, 48);
    url = frame.toDataURL();
    imageCache.set(speciesId, url);
  }
  return url;
}

export function CreatureIcon({ speciesId, size = 48, silhouette = false, flip = false }: { speciesId: string; size?: number; silhouette?: boolean; flip?: boolean }) {
  return (
    <img
      src={creatureImage(speciesId)}
      width={size}
      height={size}
      alt=""
      style={{
        imageRendering: 'pixelated',
        filter: silhouette ? 'brightness(0) opacity(0.5)' : undefined,
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
    />
  );
}

export function TypeBadge({ type }: { type: ElementType }) {
  return (
    <span
      className="inline-block px-1.5 font-pixel text-[8px] uppercase leading-4 text-black"
      style={{ background: css(ELEMENT_COLORS[type]) }}
    >
      {type}
    </span>
  );
}

const STATUS_SHORT: Record<StatusKind, string> = {
  shorted: 'SHR',
  scorched: 'BRN',
  soaked: 'WET',
  rooted: 'RTD',
  poisoned: 'PSN',
  rusted: 'RST',
  spooked: 'SPK',
  dazed: 'DZD',
};

export function StatusBadge({ status }: { status: StatusKind | null }) {
  if (!status) return null;
  return <span className="bg-neon-pink px-1 font-pixel text-[8px] leading-4 text-black">{STATUS_SHORT[status]}</span>;
}

export function HpBar({ hp, max, wide = false }: { hp: number; max: number; wide?: boolean }) {
  const pct = Math.max(0, Math.min(1, hp / Math.max(1, max)));
  const color = pct > 0.5 ? '#4fffb0' : pct > 0.2 ? '#ffd23f' : '#ff4f5e';
  return (
    <div className={`h-2 ${wide ? 'w-full' : 'w-32'} border border-black bg-night-950`}>
      <div className="h-full transition-[width] duration-500" style={{ width: `${pct * 100}%`, background: color }} />
    </div>
  );
}

export function XpBar({ xp, start, next }: { xp: number; start: number; next: number }) {
  const pct = Math.max(0, Math.min(1, (xp - start) / Math.max(1, next - start)));
  return (
    <div className="h-1 w-full bg-night-950">
      <div className="h-full bg-neon-cyan" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}
