import { FACTIONS, type RepTier, repTier } from './content/factions';
import { ITEMS, SHOPS } from './content/items';
import { SKILLS } from './content/skills';
import { SPECIES, getSpecies } from './content/wildlings';
import type { StatusKind, WildlingInstance } from './creatures/model';
import type { ElementType } from './creatures/types';
import { computeStats, displayName, maxHp, xpForLevel } from './creatures/wildling';
import { currentObjective, missionDef } from './missions/runtime';
import { describeLocation } from './world/location';
import type { Simulation } from './simulation';

/**
 * Read-only, UI-friendly projections of simulation state. The UI never needs
 * to understand internal structures; it renders these.
 */
export interface WildlingView {
  uid: string;
  name: string;
  speciesId: string;
  speciesName: string;
  types: ElementType[];
  level: number;
  hp: number;
  maxHp: number;
  status: StatusKind | null;
  xp: number;
  xpLevelStart: number;
  xpNextLevel: number;
  friendship: number;
  loyalty: number;
  injuries: number;
  stats: ReturnType<typeof computeStats>;
  skills: { id: string; name: string; type: ElementType; category: string; power: number; accuracy: number; description: string }[];
}

export function wildlingView(w: WildlingInstance): WildlingView {
  const s = getSpecies(w.speciesId);
  return {
    uid: w.uid,
    name: displayName(w),
    speciesId: w.speciesId,
    speciesName: s.name,
    types: s.types,
    level: w.level,
    hp: w.hp,
    maxHp: maxHp(w),
    status: w.status?.kind ?? null,
    xp: w.xp,
    xpLevelStart: xpForLevel(w.level),
    xpNextLevel: xpForLevel(w.level + 1),
    friendship: w.friendship,
    loyalty: w.loyalty,
    injuries: w.injuries,
    stats: computeStats(w),
    skills: w.skills.flatMap((id) => {
      const k = SKILLS[id];
      return k ? [{ id, name: k.name, type: k.type, category: k.category, power: k.power, accuracy: k.accuracy, description: k.description }] : [];
    }),
  };
}

export interface ProgressView {
  money: number;
  inventory: { id: string; name: string; qty: number; category: string; description: string }[];
  party: WildlingView[];
  storage: WildlingView[];
  index: { id: string; name: string; types: ElementType[]; seen: boolean; caught: boolean; lore: string }[];
  missions: { id: string; title: string; summary: string; status: 'active' | 'completed' | 'failed'; objective: string | null }[];
}

export function progressView(sim: Simulation): ProgressView {
  const p = sim.progression;
  return {
    money: p.money,
    inventory: Object.entries(p.inventory)
      .filter(([, q]) => q > 0)
      .map(([id, qty]) => ({ id, qty, name: ITEMS[id]?.name ?? id, category: ITEMS[id]?.category ?? 'key', description: ITEMS[id]?.description ?? '' })),
    party: p.party.map(wildlingView),
    storage: p.storage.map(wildlingView),
    index: Object.values(SPECIES).map((s) => ({
      id: s.id,
      name: s.name,
      types: s.types,
      seen: p.index.seen.includes(s.id),
      caught: p.index.caught.includes(s.id),
      lore: s.lore,
    })),
    missions: p.missions.map((rt) => {
      const def = missionDef(rt.id, p);
      return { id: rt.id, title: def.title, summary: def.summary, status: rt.status, objective: currentObjective(rt, p)?.text ?? null };
    }),
  };
}

export interface BattleView {
  id: string;
  kind: 'wild' | 'trainer';
  trainerName: string | null;
  terrain: string;
  night: boolean;
  phase: 'choose' | 'force-switch' | 'ended';
  activeIndex: number;
  party: WildlingView[];
  enemy: WildlingView;
  enemyPartySize: number;
  enemyRemaining: number;
  snares: { id: string; name: string; qty: number }[];
  medicine: { id: string; name: string; qty: number; description: string }[];
}

export function battleView(sim: Simulation): BattleView | null {
  const b = sim.battle;
  if (!b) return null;
  const inv = sim.progression.inventory;
  const enemy = b.enemy.party[b.enemy.active]!;
  const items = (cat: string) =>
    Object.entries(inv)
      .filter(([id, q]) => q > 0 && ITEMS[id]?.category === cat)
      .map(([id, qty]) => ({ id, qty, name: ITEMS[id]!.name, description: ITEMS[id]!.description }));
  return {
    id: b.id,
    kind: b.kind,
    trainerName: b.trainerName,
    terrain: b.env.terrain,
    night: b.env.night,
    phase: b.phase,
    activeIndex: b.player.active,
    party: sim.progression.party.map(wildlingView),
    enemy: wildlingView(enemy),
    enemyPartySize: b.enemy.party.length,
    enemyRemaining: b.enemy.party.filter((w) => w.hp > 0).length,
    snares: items('snare'),
    medicine: items('medicine'),
  };
}

// ---------------------------------------------------------------------------
// Shops, factions and the map

export interface ShopView {
  id: string;
  name: string;
  money: number;
  items: { id: string; name: string; description: string; price: number; owned: number }[];
  blackMarket: boolean;
  sellables: { from: 'party' | 'storage'; index: number; name: string; speciesId: string; level: number; price: number }[];
}

export function shopView(sim: Simulation, shopId: string): ShopView | null {
  const shop = SHOPS[shopId];
  if (!shop) return null;
  const p = sim.progression;
  const blackMarket = shopId === 'paper-moon';
  const sellable = (from: 'party' | 'storage') =>
    (from === 'party' ? p.party : p.storage).flatMap((w, index) =>
      w.speciesId === 'glitchling' ? [] : [{ from, index, name: displayName(w), speciesId: w.speciesId, level: w.level, price: sim.salePrice(w) }],
    );
  return {
    id: shopId,
    name: shop.name,
    money: p.money,
    items: shop.items.map((id) => ({
      id,
      name: ITEMS[id]?.name ?? id,
      description: ITEMS[id]?.description ?? '',
      price: sim.shopPrice(shopId, id),
      owned: p.inventory[id] ?? 0,
    })),
    blackMarket,
    sellables: blackMarket ? [...sellable('party'), ...sellable('storage')] : [],
  };
}

export interface FactionView {
  id: string;
  name: string;
  color: number;
  leader: string;
  motto: string;
  reputation: number;
  tier: RepTier;
  blocks: number;
}

export function factionsView(sim: Simulation): FactionView[] {
  const controllers = Object.values(sim.territory.controllers);
  return FACTIONS.map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    leader: f.leader,
    motto: f.motto,
    reputation: sim.progression.reputation[f.id] ?? 0,
    tier: repTier(sim.progression.reputation[f.id] ?? 0),
    blocks: controllers.filter((c) => c === f.id).length,
  }));
}

export interface MapView {
  width: number;
  height: number;
  tiles: Uint8Array;
  blocks: { x: number; y: number; w: number; h: number; controller: string | null }[];
  places: { x: number; y: number; name: string; kind: 'clinic' | 'shop' | 'landmark' }[];
  player: { x: number; y: number };
  markers: { x: number; y: number; label: string }[];
}

/** Where the player needs to go for each active objective (doors, NPCs, quest Wildlings). */
export function objectiveMarkers(sim: Simulation): { x: number; y: number; label: string; where: string }[] {
  const layout = sim.layout;
  const markers: { x: number; y: number; label: string; where: string }[] = [];
  const push = (x: number, y: number, label: string) => markers.push({ x, y, label, where: describeLocation(layout, x, y) });
  for (const rt of sim.progression.missions) {
    const obj = currentObjective(rt, sim.progression);
    if (!obj) continue;
    if (obj.kind === 'inspect') {
      const b = layout.buildings.find((x) => x.name === obj.target);
      if (b) push(b.entrance.tx + 0.5, b.entrance.ty + 0.5, obj.text);
    } else if (obj.kind === 'talk' || obj.kind === 'defeat') {
      const n = sim.npcs.find((x) => x.id === obj.target && x.present);
      if (n) {
        const b = n.indoors ? layout.buildings.find((x) => x.id === n.indoors) : null;
        if (b) push(b.entrance.tx + 0.5, b.entrance.ty + 0.5, `${obj.text} (inside)`);
        else push(n.x, n.y, obj.text);
      }
    } else if (obj.kind === 'resolve-tag') {
      const w = sim.wildlings.find((x) => x.questTag === obj.target);
      if (w) push(w.x, w.y, obj.text);
    } else if (obj.kind === 'disrupt') {
      const f = sim.factionAgents.find((x) => x.id === obj.target);
      const crew = f?.op?.crew.map((id) => sim.npcs.find((n) => n.id === id && n.present)).find(Boolean);
      if (crew) push(crew.x, crew.y, obj.text);
    }
  }
  return markers;
}

export function mapView(sim: Simulation): MapView {
  const layout = sim.layout;
  const markers = objectiveMarkers(sim);
  return {
    width: layout.map.width,
    height: layout.map.height,
    tiles: layout.map.tiles,
    blocks: layout.blocks.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, controller: sim.territory.controllers[b.id] ?? null })),
    places: layout.buildings
      .filter((b) => b.neon !== null)
      .map((b) => ({
        x: b.entrance.tx + 0.5,
        y: b.entrance.ty + 0.5,
        name: b.name,
        kind: b.service?.kind === 'clinic' ? 'clinic' : b.service?.kind === 'shop' ? 'shop' : 'landmark',
      })),
    player: { x: sim.player.x, y: sim.player.y },
    markers,
  };
}

export interface BoardView {
  jobs: { id: string; title: string; summary: string; reward: string; deadline: string | null }[];
}

/** Offers on the Courier Co-op job board. */
export function boardView(sim: Simulation): BoardView {
  const p = sim.progression;
  const clock = (abs: number) => {
    const m = Math.floor(abs % 1440);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  return {
    jobs: p.generated
      .filter((m) => !m.giver && p.board.includes(m.id))
      .map((m) => ({
        id: m.id,
        title: m.title,
        summary: m.summary,
        reward: m.generated?.reward ?? '',
        deadline: m.generated?.deadlineMinutes != null ? clock(m.generated.deadlineMinutes) : null,
      })),
  };
}
