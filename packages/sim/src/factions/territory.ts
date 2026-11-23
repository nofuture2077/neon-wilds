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


export function blockOf(layout: DistrictLayout, x: number, y: number): CityBlock | null {
  let best: CityBlock | null = null;
  let bestD = 4;
  for (const b of layout.blocks) {
    const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
    const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

export function controllerOf(inf: Record<string, number>): string | null {
  const entries = Object.entries(inf).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [top, second] = entries;
  if (!top || top[1] < 50) return null;
  if (second && top[1] - second[1] < 10) return null;
  return top[0];
}

export function newTerritory(layout: DistrictLayout): TerritoryState {
  if (layout.id === 'downtown') {
    // Downtown is Halcyon's: their stewardship is near total.
    const t: TerritoryState = { influence: {}, controllers: {} };
    for (const b of layout.blocks) {
      t.influence[b.id] = { saints: 5, halcyon: 92 };
      t.controllers[b.id] = 'halcyon';
    }
    return t;
  }
  const kiosk = layout.buildings.find((b) => b.name === 'Halcyon Outreach Kiosk');
  const kioskBlock = kiosk ? blockOf(layout, kiosk.x + kiosk.w / 2, kiosk.y + kiosk.h / 2) : null;
  const t: TerritoryState = { influence: {}, controllers: {} };
  for (const b of layout.blocks) {
    t.influence[b.id] = b.id === kioskBlock?.id ? { saints: 30, halcyon: 65 } : { saints: 70, halcyon: 10 };
    t.controllers[b.id] = controllerOf(t.influence[b.id]!);
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
