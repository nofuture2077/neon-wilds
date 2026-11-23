import { DT, TICK_RATE } from '../constants';
import type { CrimeKind, EventQueue } from '../core/events';
import type { Rng } from '../core/rng';
import { moveAndCollide } from '../physics/collision';
import type { NpcState, PlayerState } from '../state';
import type { Building, DistrictLayout } from '../world/district';
import type { Pathfinder } from '../world/pathfinding';
import { DIR_ANGLE, type Dir, type RoadNetwork, laneCoord } from '../world/roads';
import { type VehicleState, createVehicle } from '../world/vehicles';

/** Heat needed for each wanted star (index = stars). */
export const STAR_THRESHOLDS = [0, 20, 60, 120, 200, 320] as const;
const SIGHT_RADIUS = 11;
const LOSE_THEM_SECONDS = 8;
const DECAY_PER_SECOND = 6;
const OFFICER_SPEED = 4.3;
const OFFICER_HALF = 0.27;
const ARREST_SECONDS = 0.6;
const BOXED_IN_SECONDS = 2.5;
const RESPRAY_COST = 100;

export interface OfficerState {
  id: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  heading: number;
  speed: number;
  vehicleId: string | null;
  contactTime: number;
  path: { tx: number; ty: number }[];
  repathTick: number;
}

export interface PendingReport {
  dueTick: number;
  kind: CrimeKind;
  severity: number;
  x: number;
  y: number;
}

/** The Wardens' view of the player (GDD §8.3). Plain data; part of the save. */
export interface LawState {
  heat: number;
  stars: number;
  lastKnown: { x: number; y: number } | null;
  lastSeenTick: number;
  seen: boolean;
  reports: PendingReport[];
  officers: OfficerState[];
  boxedTime: number;
  officersDeployed: string[];
}

export function newLawState(): LawState {
  return {
    heat: 0,
    stars: 0,
    lastKnown: null,
    lastSeenTick: -1e9,
    seen: false,
    reports: [],
    officers: [],
    boxedTime: 0,
    officersDeployed: [],
  };
}

export interface LawContext {
  layout: DistrictLayout;
  roads: RoadNetwork;
  rng: Rng;
  events: EventQueue;
  tick: number;
  player: PlayerState;
  playerVehicle: VehicleState | null;
  npcs: readonly NpcState[];
  vehicles: VehicleState[];
  pathfinder: Pathfinder;
  /** Archetype id of an NPC (used to decide who calls the Wardens). */
  archetypeOf(npc: NpcState): { id: string; temperament: 'timid' | 'steady' | 'tough' };
  nextId(): string;
  /** Called when the player is arrested. */
  bust(): void;
  /** Try to charge money; returns false if the player can't pay. */
  charge(amount: number): boolean;
}

export function starsFor(heat: number): number {
  let s = 0;
  for (let i = 1; i < STAR_THRESHOLDS.length; i++) if (heat >= STAR_THRESHOLDS[i]!) s = i;
  return s;
}

function policeUnits(law: LawState, ctx: LawContext): { x: number; y: number }[] {
  const units: { x: number; y: number }[] = law.officers.map((o) => o);
  for (const v of ctx.vehicles) if (v.driver === 'police' && v.wreckedTick === null) units.push(v);
  return units;
}

function canPoliceSee(law: LawState, ctx: LawContext, x: number, y: number): boolean {
  return policeUnits(law, ctx).some((u) => Math.hypot(u.x - x, u.y - y) < SIGHT_RADIUS);
}

/** A crime happened. Police see it directly; civilians may phone it in after a delay. */
export function onCrime(law: LawState, ctx: LawContext, kind: CrimeKind, x: number, y: number, severity: number): boolean {
  if (canPoliceSee(law, ctx, x, y)) {
    addHeat(law, ctx, severity * 30);
    law.lastKnown = { x: ctx.player.x, y: ctx.player.y };
    law.lastSeenTick = ctx.tick;
    ctx.events.push({ type: 'crime', kind, x, y, severity, witnessed: true });
    return true;
  }
  let witnessed = false;
  if (severity >= 1) {
    for (const npc of ctx.npcs) {
      if (!npc.present || npc.indoors || Math.hypot(npc.x - x, npc.y - y) > 9) continue;
      const a = ctx.archetypeOf(npc);
      if (a.id === 'gutter-saint') continue; // the Saints don't talk to Wardens
      const chance = a.temperament === 'timid' ? 0.9 : a.temperament === 'steady' ? 0.7 : 0.4;
      if (!ctx.rng.chance(chance)) continue;
      witnessed = true;
      law.reports.push({ dueTick: ctx.tick + TICK_RATE * ctx.rng.range(4, 9), kind, severity, x, y });
      break; // one call is enough
    }
  }
  ctx.events.push({ type: 'crime', kind, x, y, severity, witnessed });
  return witnessed;
}

function addHeat(law: LawState, ctx: LawContext, amount: number): void {
  law.heat = Math.min(STAR_THRESHOLDS[5] + 40, law.heat + amount);
  syncStars(law, ctx);
}

function syncStars(law: LawState, ctx: LawContext): void {
  const stars = starsFor(law.heat);
  if (stars !== law.stars) {
    const lost = stars === 0 && law.stars > 0;
    law.stars = stars;
    ctx.events.push({ type: 'wanted.changed', stars });
    if (lost) ctx.events.push({ type: 'notice', text: 'You lost the Wardens.' });
  }
}

/** Clear the wanted level and stand down every unit. */
export function clearWanted(law: LawState, ctx: Pick<LawContext, 'events' | 'vehicles'>): void {
  law.heat = 0;
  law.reports = [];
  law.lastKnown = null;
  law.officers = [];
  law.officersDeployed = [];
  law.boxedTime = 0;
  for (const v of ctx.vehicles) if (v.driver === 'police') v.ai = v.ai ? { ...v.ai, route: [], nextDir: null } : v.ai;
  if (law.stars !== 0) {
    law.stars = 0;
    ctx.events.push({ type: 'wanted.changed', stars: 0 });
  }
}

export function updateLaw(law: LawState, ctx: LawContext): void {
  const p = ctx.player;

  for (const r of law.reports.splice(0)) {
    if (ctx.tick < r.dueTick) {
      law.reports.push(r);
      continue;
    }
    addHeat(law, ctx, r.severity * 20);
    law.lastKnown = { x: r.x, y: r.y };
    law.lastSeenTick = ctx.tick; // fresh information: the search starts now
    ctx.events.push({ type: 'notice', text: 'Someone called the Wardens on you.' });
  }

  law.seen = law.stars > 0 && canPoliceSee(law, ctx, p.x, p.y);
  if (law.seen) {
    law.lastKnown = { x: p.x, y: p.y };
    law.lastSeenTick = ctx.tick;
  } else if (law.stars > 0 && ctx.tick - law.lastSeenTick > TICK_RATE * LOSE_THEM_SECONDS) {
    law.heat = Math.max(0, law.heat - DECAY_PER_SECOND * DT);
    if (law.heat < STAR_THRESHOLDS[1]) law.heat = 0;
    syncStars(law, ctx);
  }

  if (ctx.tick % 30 === 0) managePolice(law, ctx);
  updateOfficers(law, ctx);
  checkBoxedIn(law, ctx);
  checkRespray(law, ctx);
}

/** Desired cruisers: one patrol always; pursuit units by wanted level. */
function managePolice(law: LawState, ctx: LawContext): void {
  const p = ctx.player;
  const cruisers = ctx.vehicles.filter((v) => v.driver === 'police' && v.wreckedTick === null);
  const desired = law.stars === 0 ? (ctx.layout.id === 'downtown' ? 2 : 1) : [0, 2, 3, 5, 6, 7][law.stars]!;
  // Stand down distant extra units once the heat is off.
  if (law.stars === 0) {
    for (const v of cruisers.slice(1)) {
      if (Math.hypot(v.x - p.x, v.y - p.y) > 25) {
        const i = ctx.vehicles.indexOf(v);
        if (i >= 0) ctx.vehicles.splice(i, 1);
      }
    }
  }
  if (cruisers.length >= desired) return;
  for (let attempt = 0; attempt < 8; attempt++) {
    const vertical = ctx.rng.chance(0.5);
    const band = ctx.rng.pick(vertical ? ctx.roads.vbands : ctx.roads.hbands);
    const dir: Dir = vertical ? (ctx.rng.chance(0.5) ? 'N' : 'S') : ctx.rng.chance(0.5) ? 'E' : 'W';
    const along = ctx.rng.range(2, (vertical ? ctx.layout.map.height : ctx.layout.map.width) - 2);
    const x = vertical ? laneCoord(band, dir) : along;
    const y = vertical ? along : laneCoord(band, dir);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < 16 || d > 34 || ctx.roads.intersectionAt(x, y)) continue;
    if (ctx.layout.map.isSolid(Math.floor(x), Math.floor(y))) continue;
    if (ctx.vehicles.some((o) => Math.hypot(o.x - x, o.y - y) < 4)) continue;
    const v = createVehicle(ctx.nextId(), 'cruiser', 0, x, y, DIR_ANGLE[dir], 'police', ctx.tick);
    v.ai = { dir, route: [], nextDir: null, blockedTime: 0 };
    v.speed = 4;
    ctx.vehicles.push(v);
    return;
  }
}

function updateOfficers(law: LawState, ctx: LawContext): void {
  const p = ctx.player;
  // Cruisers close to a player on foot let an officer out.
  if (law.stars > 0 && !ctx.playerVehicle) {
    for (const v of ctx.vehicles) {
      if (v.driver !== 'police' || law.officersDeployed.includes(v.id)) continue;
      if (Math.hypot(v.x - p.x, v.y - p.y) > 8 || Math.abs(v.speed) > 2.5) continue;
      law.officersDeployed.push(v.id);
      law.officers.push({
        id: `officer-${v.id}`,
        x: v.x,
        y: v.y,
        prevX: v.x,
        prevY: v.y,
        heading: 0,
        speed: 0,
        vehicleId: v.id,
        contactTime: 0,
        path: [],
        repathTick: 0,
      });
      ctx.events.push({ type: 'bark', actorId: `officer-${v.id}`, text: 'Wardens! Stay where you are!', emote: 'anger' });
    }
  }

  for (let i = law.officers.length - 1; i >= 0; i--) {
    const o = law.officers[i]!;
    o.prevX = o.x;
    o.prevY = o.y;
    o.speed = 0;
    if (law.stars === 0) {
      law.officers.splice(i, 1);
      continue;
    }
    const target = ctx.playerVehicle ?? p;
    const d = Math.hypot(target.x - o.x, target.y - o.y);
    if (d > 30) {
      law.officers.splice(i, 1);
      continue;
    }
    // Direct pursuit; fall back to A* when walls are in the way.
    let tx = target.x;
    let ty = target.y;
    if (o.path.length > 0) {
      const n = o.path[0]!;
      tx = n.tx + 0.5;
      ty = n.ty + 0.5;
      if (Math.hypot(tx - o.x, ty - o.y) < 0.3) o.path.shift();
    }
    const dx = tx - o.x;
    const dy = ty - o.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.05) {
      const step = Math.min(OFFICER_SPEED * DT, dist);
      const res = moveAndCollide(ctx.layout.map, o.x, o.y, OFFICER_HALF, (dx / dist) * step, (dy / dist) * step);
      const moved = Math.hypot(res.x - o.x, res.y - o.y);
      o.x = res.x;
      o.y = res.y;
      o.speed = moved / DT;
      o.heading = Math.atan2(dy, dx);
      if (moved < step * 0.3 && ctx.tick >= o.repathTick) {
        o.repathTick = ctx.tick + TICK_RATE;
        o.path =
          ctx.pathfinder.find({ tx: Math.floor(o.x), ty: Math.floor(o.y) }, { tx: Math.floor(target.x), ty: Math.floor(target.y) }, { maxExpanded: 1500 }) ?? [];
      }
    }
    // Arrest: sustained contact with a player on foot.
    if (!ctx.playerVehicle && Math.hypot(p.x - o.x, p.y - o.y) < 0.75) {
      o.contactTime += DT;
      if (o.contactTime >= ARREST_SECONDS) {
        ctx.bust();
        return;
      }
    } else {
      o.contactTime = Math.max(0, o.contactTime - DT);
    }
  }
}

/** A car that is stopped with a cruiser touching it is boxed in. */
function checkBoxedIn(law: LawState, ctx: LawContext): void {
  const v = ctx.playerVehicle;
  if (!v || law.stars === 0) {
    law.boxedTime = 0;
    return;
  }
  const touching = ctx.vehicles.some((o) => o.driver === 'police' && Math.hypot(o.x - v.x, o.y - v.y) < 2.4);
  if (touching && Math.abs(v.speed) < 0.6) {
    law.boxedTime += DT;
    if (law.boxedTime > BOXED_IN_SECONDS) ctx.bust();
  } else law.boxedTime = Math.max(0, law.boxedTime - DT * 2);
}

/** Drive into Rustbucket Garage while unseen: a respray wipes the wanted level. */
function checkRespray(law: LawState, ctx: LawContext): void {
  const v = ctx.playerVehicle;
  if (!v || law.stars === 0 || law.seen || ctx.tick % 10 !== 0) return;
  const garage = ctx.layout.buildings.find((b: Building) => b.name === 'Rustbucket Garage');
  if (!garage || Math.hypot(v.x - (garage.entrance.tx + 0.5), v.y - (garage.entrance.ty + 0.5)) > 2.2) return;
  if (!ctx.charge(RESPRAY_COST)) {
    ctx.events.push({ type: 'notice', text: `A respray costs ${RESPRAY_COST}₵. Come back with cash.` });
    return;
  }
  v.variant = (v.variant + 1 + ctx.rng.int(0, 4)) % 6;
  clearWanted(law, ctx);
  ctx.events.push({ type: 'respray', vehicleId: v.id, cost: RESPRAY_COST });
}

/** Steering target for pursuing police cars: the player's last known position. */
export function pursuitTarget(law: LawState): { x: number; y: number } | null {
  return law.stars > 0 ? law.lastKnown : null;
}
