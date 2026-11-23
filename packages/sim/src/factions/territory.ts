import { ITEMS } from '../content/items';
import { getSpecies } from '../content/wildlings';
import type { EventQueue } from '../core/events';
import type { WildlingInstance } from '../creatures/model';
import type { CityBlock, DistrictLayout } from '../world/district';

/**
 * Territory (per-block faction influence) and the economy. The strategy that
 * moves influence lives in strategy.ts (utility goals + GOAP operations).
 */
export interface TerritoryState {
  /** blockId → factionId → influence 0..100 */
  influence: Record<string, Record<string, number>>;
  controllers: Record<string, string | null>;
}

export interface MarketState {
  /** speciesId → black-market demand multiplier (0.3..1.2) */
  demand: Record<string, number>;
}


/** The block at (x, y), or the nearest one within a few tiles (from a sidewalk or road). */
export function blockOf(layout: DistrictLayout, x: number, y: number): CityBlock | null {
  const { width, height } = layout.map;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  for (let r = 0; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const id = layout.blockMap[ny * width + nx]!;
        if (id >= 0) return layout.blocks[id] ?? null;
      }
    }
  }
  return null;
}

export function controllerOf(inf: Record<string, number>): string | null {
  const entries = Object.entries(inf).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [top, second] = entries;
  if (!top || top[1] < 50) return null;
  if (second && top[1] - second[1] < 10) return null;
  return top[0];
}

/** Starting influence per block, by district region (WORLD.md §3). */
export function newTerritory(layout: DistrictLayout): TerritoryState {
  const t: TerritoryState = { influence: {}, controllers: {} };
  const outpost = (name: string) => {
    const b = layout.buildings.find((x) => x.name === name);
    return b ? blockOf(layout, b.x + b.w / 2, b.y + b.h / 2)?.id ?? null : null;
  };
  const kiosk = outpost('Halcyon Outreach Kiosk');
  const shipping = outpost('Halcyon Shipping');
  const lab = outpost('Halcyon Lab 7');
  for (const b of layout.blocks) {
    let inf: Record<string, number>;
    switch (b.region) {
      case 'downtown':
        inf = { saints: 5, halcyon: 92 };
        break;
      case 'harbor':
        inf = b.id === shipping ? { compact: 30, halcyon: 70 } : { compact: 85, halcyon: 10 };
        break;
      case 'industrial':
        inf = b.id === lab ? { 'iron-chain': 25, halcyon: 80 } : { 'iron-chain': 82, halcyon: 12 };
        break;
      default:
        inf = b.id === kiosk ? { saints: 30, halcyon: 65 } : { saints: 70, halcyon: 10 };
    }
    t.influence[b.id] = inf;
    t.controllers[b.id] = controllerOf(inf);
  }
  return t;
}

export function adjustInfluence(t: TerritoryState, blockId: string, faction: string, delta: number, events: EventQueue): void {
  const inf = t.influence[blockId];
  if (!inf) return;
  inf[faction] = Math.max(0, Math.min(100, (inf[faction] ?? 0) + delta));
  const next = controllerOf(inf);
  const prev = t.controllers[blockId] ?? null;
  if (next !== prev) {
    t.controllers[blockId] = next;
    events.push({ type: 'territory.changed', blockId, controller: next, previous: prev });
  }
}

export function recoverDemand(m: MarketState): void {
  for (const k of Object.keys(m.demand)) m.demand[k] = Math.min(1.2, (m.demand[k] ?? 1) + 0.04);
}

function hash(day: number, key: string): number {
  let h = 2166136261 ^ day;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  return (h >>> 0) / 4294967296;
}

export interface PriceContext {
  day: number;
  territory: TerritoryState;
  layout: DistrictLayout;
  reputation: Record<string, number>;
}

/** Shop price after the daily swing, the block's controller and the player's standing with it. */
export function priceOf(itemId: string, shopBuildingName: string, ctx: PriceContext): number {
  const item = ITEMS[itemId];
  if (!item) return 0;
  let price = item.price * (0.9 + 0.2 * hash(ctx.day, itemId));
  const shop = ctx.layout.buildings.find((b) => b.name === shopBuildingName);
  const block = shop ? blockOf(ctx.layout, shop.x + shop.w / 2, shop.y + shop.h / 2) : null;
  const controller = block ? ctx.territory.controllers[block.id] : null;
  if (controller === 'halcyon') price *= 1.15;
  if (controller === 'saints') price *= 0.95;
  const rep = controller ? (ctx.reputation[controller] ?? 0) : 0;
  if (rep >= 20) price *= 0.9;
  if (rep <= -20) price *= 1.2;
  return Math.max(1, Math.round(price / 5) * 5);
}

const RARITY_VALUE: Record<string, number> = { common: 90, uncommon: 260, rare: 700, legendary: 2000, unique: 0 };

export function wildlingSalePrice(w: WildlingInstance, market: MarketState): number {
  const s = getSpecies(w.speciesId);
  const base = RARITY_VALUE[s.rarity] ?? 0;
  const demand = market.demand[w.speciesId] ?? 1;
  return Math.round((base * (0.6 + w.level * 0.06) * demand) / 5) * 5;
}
