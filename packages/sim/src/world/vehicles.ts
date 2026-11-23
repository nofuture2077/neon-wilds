import { DT, TICK_RATE } from '../constants';
import type { EventQueue } from '../core/events';
import type { Rng } from '../core/rng';
import type { DistrictLayout } from './district';
import { type RoadNetwork, STOP_DISTANCE } from './roads';

export type VehicleClassId = 'compact' | 'sedan' | 'van' | 'cruiser';

export interface VehicleClass {
  id: VehicleClassId;
  name: string;
  /** Tiles/second. */
  maxSpeed: number;
  accel: number;
  brake: number;
  /** Radians/second at full steering and speed. */
  turnRate: number;
  /** Lateral grip (higher = less sliding). */
  grip: number;
  length: number;
  width: number;
  hp: number;
  mass: number;
}

export const VEHICLE_CLASSES: Record<VehicleClassId, VehicleClass> = {
  compact: { id: 'compact', name: 'Kettle hatchback', maxSpeed: 8.5, accel: 6.5, brake: 13, turnRate: 3.4, grip: 7, length: 1.7, width: 0.86, hp: 80, mass: 1 },
  sedan: { id: 'sedan', name: 'Vesper Civic', maxSpeed: 9.5, accel: 6, brake: 12, turnRate: 3.0, grip: 6.5, length: 1.8, width: 0.9, hp: 100, mass: 1.2 },
  van: { id: 'van', name: 'Courier van', maxSpeed: 7.5, accel: 4.2, brake: 10, turnRate: 2.4, grip: 6, length: 2.1, width: 1.0, hp: 140, mass: 1.8 },
  cruiser: { id: 'cruiser', name: 'Warden cruiser', maxSpeed: 10.5, accel: 7.5, brake: 14, turnRate: 3.2, grip: 7.5, length: 1.85, width: 0.9, hp: 130, mass: 1.4 },
};

export type DriverKind = 'none' | 'player' | 'ai' | 'police';

export interface VehicleAi {
  /** Road-graph edge the car drives on, its direction, and arc length from node a. */
  edge: number;
  forward: boolean;
  s: number;
  /** Waypoints while crossing a junction (or turning around). */
  route: { x: number; y: number }[];
  next: { edge: number; forward: boolean } | null;
  blockedTime: number;
  /** Left the lanes to chase someone; snaps back to the nearest lane afterwards. */
  offroad?: boolean;
}

export interface VehicleState {
  id: string;
  classId: VehicleClassId;
  variant: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  heading: number;
  vx: number;
  vy: number;
  /** Signed forward speed, tiles/second. */
  speed: number;
  hp: number;
  driver: DriverKind;
  ai: VehicleAi | null;
  /** Taken without the owner's consent; also marks player-used cars to keep them from despawning. */
  stolen: boolean;
  wreckedTick: number | null;
  exploded: boolean;
  braking: boolean;
  spawnTick: number;
}

export interface VehicleContext {
  layout: DistrictLayout;
  roads: RoadNetwork;
  rng: Rng;
  events: EventQueue;
  tick: number;
  /** Obstacles AI drivers yield to: pedestrians, the player on foot, Wildlings. */
  obstacles: { x: number; y: number }[];
  /** Where pursuing police cars are heading (the player's last known position), if anywhere. */
  pursuit: { x: number; y: number } | null;
  /** The car the player is driving; pursuing police ram it instead of braking for it. */
  playerVehicleId: string | null;
  /** Blackout: traffic signals are dead, junctions become a free-for-all. */
  signalsOff?: boolean;
  nextId(): string;
}

export interface DriveInput {
  throttle: number;
  steer: number;
  handbrake: boolean;
}

const TRAFFIC_TARGET = 12;
const SPAWN_MIN = 20;
const SPAWN_MAX = 38;
const DESPAWN = 52;

export function vehicleClass(v: VehicleState): VehicleClass {
  return VEHICLE_CLASSES[v.classId];
}

export function createVehicle(
  id: string,
  classId: VehicleClassId,
  variant: number,
  x: number,
  y: number,
  heading: number,
  driver: DriverKind,
  tick: number,
): VehicleState {
  return {
    id,
    classId,
    variant,
    x,
    y,
    prevX: x,
    prevY: y,
    heading,
    vx: 0,
    vy: 0,
    speed: 0,
    hp: VEHICLE_CLASSES[classId].hp,
    driver,
    ai: null,
    stolen: false,
    wreckedTick: null,
    exploded: false,
    braking: false,
    spawnTick: tick,
  };
}

/** Parked cars from the generated layout become real, stealable vehicles. */
export function parkedVehiclesFromLayout(layout: DistrictLayout): VehicleState[] {
  return layout.props
    .filter((p) => p.kind === 'parked-car')
    .map((p) => {
      const heading = { north: -Math.PI / 2, south: Math.PI / 2, east: 0, west: Math.PI }[p.facing];
      const classId: VehicleClassId = p.variant % 5 === 0 ? 'van' : p.variant % 2 === 0 ? 'sedan' : 'compact';
      return createVehicle(`parked-${p.id}`, classId, p.variant, p.x + p.w / 2, p.y + p.h / 2, heading, 'none', 0);
    });
}

// ---------------------------------------------------------------------------
// Geometry

export function forward(v: VehicleState): { x: number; y: number } {
  return { x: Math.cos(v.heading), y: Math.sin(v.heading) };
}

/** Two circles approximating the body, used for vehicle/vehicle and vehicle/actor contacts. */
export function bodyCircles(v: VehicleState): { x: number; y: number; r: number }[] {
  const c = vehicleClass(v);
  const f = forward(v);
  const off = c.length / 4;
  const r = c.width / 2 + 0.04;
  return [
    { x: v.x + f.x * off, y: v.y + f.y * off, r },
    { x: v.x - f.x * off, y: v.y - f.y * off, r },
  ];
}

function hitsWorld(layout: DistrictLayout, v: VehicleState, x: number, y: number, heading: number): boolean {
  const c = vehicleClass(v);
  const fx = Math.cos(heading);
  const fy = Math.sin(heading);
  const hl = c.length / 2 - 0.05;
  const hw = c.width / 2 - 0.05;
  for (const [a, b] of [
    [hl, hw],
    [hl, -hw],
    [-hl, hw],
    [-hl, -hw],
    [hl, 0],
    [-hl, 0],
    [0, hw],
    [0, -hw],
  ] as const) {
    const px = x + fx * a - fy * b;
    const py = y + fy * a + fx * b;
    if (layout.map.isSolid(Math.floor(px), Math.floor(py))) return true;
  }
  return false;
}

/** Apply damage; returns true if this hit wrecked the vehicle. */
export function damageVehicle(v: VehicleState, amount: number, ctx: Pick<VehicleContext, 'events' | 'tick'>): boolean {
  if (v.wreckedTick !== null || amount <= 0) return false;
  v.hp = Math.max(0, v.hp - amount);
  if (v.hp === 0) {
    v.wreckedTick = ctx.tick;
    v.speed = 0;
    v.vx = 0;
    v.vy = 0;
    ctx.events.push({ type: 'vehicle.wrecked', vehicleId: v.id });
    return true;
  }
  return false;
}

/** Move with collision against buildings; returns impact speed if it hit something. */
function integrate(v: VehicleState, ctx: VehicleContext, turn: number): number {
  const nx = v.x + v.vx * DT;
  const ny = v.y + v.vy * DT;
  const nh = v.heading + turn * DT;
  if (!hitsWorld(ctx.layout, v, nx, ny, nh)) {
    v.x = nx;
    v.y = ny;
    v.heading = nh;
    return 0;
  }
  // Try sliding along one axis before giving up.
  if (!hitsWorld(ctx.layout, v, nx, v.y, nh)) {
    const impact = Math.abs(v.vy);
    v.x = nx;
    v.heading = nh;
    v.vy *= -0.2;
    v.speed = v.vx * Math.cos(v.heading) + v.vy * Math.sin(v.heading);
    return impact;
  }
  if (!hitsWorld(ctx.layout, v, v.x, ny, nh)) {
    const impact = Math.abs(v.vx);
    v.y = ny;
    v.heading = nh;
    v.vx *= -0.2;
    v.speed = v.vx * Math.cos(v.heading) + v.vy * Math.sin(v.heading);
    return impact;
  }
  const impact = Math.hypot(v.vx, v.vy);
  v.vx *= -0.3;
  v.vy *= -0.3;
  v.speed *= -0.3;
  return impact;
}

// ---------------------------------------------------------------------------
// Player driving: arcade physics with lateral slip (handbrake drifts).

export function drivePlayer(v: VehicleState, input: DriveInput, ctx: VehicleContext): void {
  const c = vehicleClass(v);
  v.prevX = v.x;
  v.prevY = v.y;
  if (v.wreckedTick !== null) {
    v.vx = v.vy = v.speed = 0;
    return;
  }
  const fx = Math.cos(v.heading);
  const fy = Math.sin(v.heading);
  let fwd = v.vx * fx + v.vy * fy;
  let lat = -v.vx * fy + v.vy * fx;

  v.braking = false;
  if (input.throttle > 0.05) {
    fwd += (fwd < 0 ? c.brake : c.accel) * input.throttle * DT;
  } else if (input.throttle < -0.05) {
    if (fwd > 0.2) {
      fwd -= c.brake * -input.throttle * DT;
      v.braking = true;
    } else fwd -= c.accel * 0.6 * -input.throttle * DT;
  } else {
    fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 2.2 * DT);
  }
  if (input.handbrake) {
    fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 5 * DT);
    v.braking = true;
  }
  fwd = Math.max(-c.maxSpeed * 0.4, Math.min(c.maxSpeed, fwd));
  const grip = input.handbrake ? 1.2 : c.grip;
  lat *= Math.max(0, 1 - grip * DT);

  const speedFactor = Math.min(1, Math.abs(fwd) / 3);
  const turn = input.steer * c.turnRate * speedFactor * Math.sign(fwd || 1) * (input.handbrake ? 1.35 : 1);

  v.vx = fx * fwd - fy * lat;
  v.vy = fy * fwd + fx * lat;
  v.speed = fwd;
  const impact = integrate(v, ctx, turn);
  if (impact > 2) {
    damageVehicle(v, (impact - 2.5) * 3.5, ctx);
    ctx.events.push({ type: 'vehicle.crash', vehicleId: v.id, impact });
  }
}

// ---------------------------------------------------------------------------
// AI traffic

export function manageTraffic(list: VehicleState[], ctx: VehicleContext, player: { x: number; y: number }): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const v = list[i]!;
    if (v.driver === 'player' || v.stolen) continue;
    const d = Math.hypot(v.x - player.x, v.y - player.y);
    const ageOk = ctx.tick - v.spawnTick > TICK_RATE * 10;
    if ((v.driver === 'ai' && d > DESPAWN && ageOk) || (v.exploded && d > 30)) list.splice(i, 1);
  }
  const traffic = list.filter((v) => v.driver === 'ai').length;
  if (traffic >= TRAFFIC_TARGET) return;
  spawnTrafficCar(list, ctx, player);
}

function spawnTrafficCar(list: VehicleState[], ctx: VehicleContext, player: { x: number; y: number }): void {
  for (let attempt = 0; attempt < 3; attempt++) {
    const spot = ctx.roads.laneNear(ctx.rng, player.x, player.y, SPAWN_MIN, SPAWN_MAX);
    if (!spot) return;
    const pose = ctx.roads.lane(spot.edge, spot.s, spot.forward);
    if (list.some((o) => Math.hypot(o.x - pose.x, o.y - pose.y) < 4)) continue;
    const classId: VehicleClassId = ctx.rng.chance(0.15) ? 'van' : ctx.rng.chance(0.5) ? 'sedan' : 'compact';
    const v = createVehicle(ctx.nextId(), classId, ctx.rng.int(0, 5), pose.x, pose.y, pose.heading, 'ai', ctx.tick);
    v.ai = { edge: spot.edge, forward: spot.forward, s: spot.s, route: [], next: null, blockedTime: 0 };
    v.speed = 3;
    list.push(v);
    return;
  }
}

/** Put an AI car back on the nearest lane (after a chase or being shoved off the road). */
export function snapToLane(v: VehicleState, ctx: Pick<VehicleContext, 'roads'>): void {
  const near = ctx.roads.nearest(v.x, v.y);
  if (!near || !v.ai) return;
  const tangent = ctx.roads.centre(near.edge, near.s);
  const forward = Math.cos(v.heading) * tangent.tx + Math.sin(v.heading) * tangent.ty >= 0;
  v.ai.edge = near.edge;
  v.ai.forward = forward;
  v.ai.s = near.s;
  v.ai.route = [];
  v.ai.next = null;
}

/** Distance to the nearest thing ahead that this AI car must not hit, or Infinity. */
function clearanceAhead(v: VehicleState, all: readonly VehicleState[], ctx: VehicleContext, ramPlayer = false): number {
  const f = forward(v);
  const c = vehicleClass(v);
  let best = Infinity;
  for (const o of all) {
    if (o === v || (ramPlayer && o.id === ctx.playerVehicleId)) continue;
    const rx = o.x - v.x;
    const ry = o.y - v.y;
    if (Math.abs(rx) > 5 || Math.abs(ry) > 5) continue;
    const fwd = rx * f.x + ry * f.y;
    const lat = Math.abs(-rx * f.y + ry * f.x);
    const reach = (c.length + vehicleClass(o).length) / 2;
    if (fwd > 0 && lat < 0.95) best = Math.min(best, fwd - reach);
  }
  for (const o of ctx.obstacles) {
    const rx = o.x - v.x;
    const ry = o.y - v.y;
    if (Math.abs(rx) > 4 || Math.abs(ry) > 4) continue;
    const fwd = rx * f.x + ry * f.y;
    const lat = Math.abs(-rx * f.y + ry * f.x);
    if (fwd > 0 && lat < 0.8) best = Math.min(best, fwd - c.length / 2 - 0.3);
  }
  return best;
}

/**
 * AI driving on the road graph: follow the lane along the edge, stop for
 * red lights and obstacles, then cross the junction on a curve into the
 * chosen next edge. Pursuing police leave the lanes when close.
 */
export function driveAi(v: VehicleState, all: readonly VehicleState[], ctx: VehicleContext): void {
  v.prevX = v.x;
  v.prevY = v.y;
  const ai = v.ai;
  const c = vehicleClass(v);
  if (!ai || v.wreckedTick !== null) {
    coast(v, ctx);
    return;
  }
  const pursuing = v.driver === 'police' && ctx.pursuit !== null;
  if (pursuing && Math.hypot(ctx.pursuit!.x - v.x, ctx.pursuit!.y - v.y) < 12) {
    chase(v, all, ctx, ctx.pursuit!);
    ai.offroad = true;
    return;
  }
  if (ai.offroad) {
    ai.offroad = false;
    snapToLane(v, ctx);
  }

  const roads = ctx.roads;
  const len = roads.edgeLength(ai.edge);
  let target = pursuing ? c.maxSpeed : Math.min(c.maxSpeed, 4.6);

  if (ai.route.length === 0) {
    const remaining = ai.forward ? len - STOP_DISTANCE - ai.s : ai.s - STOP_DISTANCE;
    const node = roads.aheadNode(ai.edge, ai.forward);
    if (remaining <= 0.15) {
      // Enter the junction: pick the next edge and build a curved crossing.
      const next = roads.chooseNext(node.id, ai.edge, ctx.rng, pursuing ? ctx.pursuit! : undefined);
      const nextLen = roads.edgeLength(next.edge);
      const startS = next.forward ? Math.min(STOP_DISTANCE, nextLen / 2) : Math.max(nextLen - STOP_DISTANCE, nextLen / 2);
      const from = { x: v.x, y: v.y };
      const to = roads.lane(next.edge, startS, next.forward);
      const steps = 6;
      ai.route = [];
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const d = t * t;
        ai.route.push({ x: a * from.x + b * node.x + d * to.x, y: a * from.y + b * node.y + d * to.y });
      }
      ai.next = { edge: next.edge, forward: next.forward };
      ai.s = startS;
    } else {
      if (!pursuing && !ctx.signalsOff && roads.isSignal(node) && remaining < 3.5 && !roads.isGreen(node.id, ai.edge, ctx.tick)) {
        target = Math.min(target, Math.max(0, (remaining - 0.2) * 1.6));
      }
      target = Math.min(target, 2.8 + remaining * 0.7);
    }
  } else {
    target = Math.min(target, pursuing ? 5 : 2.8);
  }

  const clear = clearanceAhead(v, all, ctx);
  if (clear < 2.5) target = Math.min(target, Math.max(0, (clear - 0.4) * 2));
  if (target < 0.1 && clear < 2.5) {
    ai.blockedTime += DT;
    if (ai.blockedTime > 2.5 && ai.blockedTime - DT <= 2.5) ctx.events.push({ type: 'vehicle.honk', vehicleId: v.id });
  } else ai.blockedTime = 0;

  const accel = target > v.speed ? c.accel : c.brake;
  v.braking = target < v.speed - 0.3;
  v.speed += Math.max(-accel * DT, Math.min(accel * DT, target - v.speed));
  v.speed = Math.max(0, v.speed);
  const step = v.speed * DT;

  if (ai.route.length > 0) {
    // Junction crossing: steer along the curve's waypoints.
    let remainingStep = step;
    while (remainingStep > 0 && ai.route.length > 0) {
      const p = ai.route[0]!;
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const d = Math.hypot(dx, dy);
      if (d <= remainingStep) {
        v.x = p.x;
        v.y = p.y;
        remainingStep -= d;
        ai.route.shift();
        if (d > 1e-4) v.heading = Math.atan2(dy, dx);
      } else {
        v.x += (dx / d) * remainingStep;
        v.y += (dy / d) * remainingStep;
        v.heading = Math.atan2(dy, dx);
        remainingStep = 0;
      }
    }
    if (ai.route.length === 0 && ai.next) {
      ai.edge = ai.next.edge;
      ai.forward = ai.next.forward;
      ai.next = null;
    }
  } else {
    ai.s += ai.forward ? step : -step;
    const pose = roads.lane(ai.edge, ai.s, ai.forward);
    v.x = pose.x;
    v.y = pose.y;
    v.heading = turnTowardAngle(v.heading, pose.heading, 6 * DT);
  }
  v.vx = Math.cos(v.heading) * v.speed;
  v.vy = Math.sin(v.heading) * v.speed;
}

function turnTowardAngle(current: number, target: number, maxStep: number): number {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) <= maxStep ? target : current + Math.sign(d) * maxStep;
}

/** Driverless or wrecked cars roll to a stop. */
export function coast(v: VehicleState, ctx: VehicleContext): void {
  v.prevX = v.x;
  v.prevY = v.y;
  v.braking = false;
  if (Math.abs(v.vx) + Math.abs(v.vy) < 0.01) {
    v.vx = v.vy = v.speed = 0;
    return;
  }
  const decay = Math.max(0, 1 - 3 * DT);
  v.vx *= decay;
  v.vy *= decay;
  v.speed *= decay;
  integrate(v, ctx, 0);
}

/** Off-lane pursuit: steer straight at the target, ramming the player's car. */
function chase(v: VehicleState, all: readonly VehicleState[], ctx: VehicleContext, target: { x: number; y: number }): void {
  const c = vehicleClass(v);
  const dx = target.x - v.x;
  const dy = target.y - v.y;
  const d = Math.hypot(dx, dy);
  let want = Math.min(c.maxSpeed, 1.5 + d * 1.1);
  if (!ctx.playerVehicleId && d < 3) want = 0; // stop next to a suspect on foot; an officer gets out
  const clear = clearanceAhead(v, all, ctx, true);
  if (clear < 1.5) want = Math.min(want, Math.max(0, clear * 2));
  const accel = want > v.speed ? c.accel : c.brake;
  v.braking = want < v.speed - 0.3;
  v.speed += Math.max(-accel * DT, Math.min(accel * DT, want - v.speed));
  v.speed = Math.max(0, v.speed);
  let delta = Math.atan2(dy, dx) - v.heading;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const maxTurn = c.turnRate * 1.5 * DT;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, delta)) / DT;
  v.vx = Math.cos(v.heading) * v.speed;
  v.vy = Math.sin(v.heading) * v.speed;
  const impact = integrate(v, ctx, v.speed > 0.05 ? turn : 0);
  if (impact > 2.5) damageVehicle(v, (impact - 2.5) * 3, ctx);
}

export function resolveVehicleContacts(list: VehicleState[], ctx: VehicleContext): void {
  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]!;
      if (Math.abs(a.x - b.x) > 3 || Math.abs(a.y - b.y) > 3) continue;
      for (const ca of bodyCircles(a)) {
        for (const cb of bodyCircles(b)) {
          const dx = cb.x - ca.x;
          const dy = cb.y - ca.y;
          const dist = Math.hypot(dx, dy);
          const min = ca.r + cb.r;
          if (dist >= min || dist < 1e-6) continue;
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = min - dist;
          const ma = vehicleClass(a).mass * (a.driver === 'none' ? 2 : 1);
          const mb = vehicleClass(b).mass * (b.driver === 'none' ? 2 : 1);
          const pa = mb / (ma + mb);
          const pb = ma / (ma + mb);
          if (!hitsWorld(ctx.layout, a, a.x - nx * overlap * pa, a.y - ny * overlap * pa, a.heading)) {
            a.x -= nx * overlap * pa;
            a.y -= ny * overlap * pa;
          }
          if (!hitsWorld(ctx.layout, b, b.x + nx * overlap * pb, b.y + ny * overlap * pb, b.heading)) {
            b.x += nx * overlap * pb;
            b.y += ny * overlap * pb;
          }
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0) {
            // Exchange momentum along the normal (inelastic).
            const impulse = rel * 0.8;
            a.vx -= nx * impulse * pa;
            a.vy -= ny * impulse * pa;
            b.vx += nx * impulse * pb;
            b.vy += ny * impulse * pb;
            a.speed = a.vx * Math.cos(a.heading) + a.vy * Math.sin(a.heading);
            b.speed = b.vx * Math.cos(b.heading) + b.vy * Math.sin(b.heading);
            if (rel > 2) {
              damageVehicle(a, (rel - 2) * 5, ctx);
              damageVehicle(b, (rel - 2) * 5, ctx);
              ctx.events.push({ type: 'vehicle.crash', vehicleId: a.driver === 'player' ? a.id : b.id, impact: rel });
            }
          }
        }
      }
    }
  }
}

/** Wrecks burn for a few seconds, then explode once. */
export function updateWrecks(list: VehicleState[], ctx: VehicleContext): void {
  for (const v of list) {
    if (v.wreckedTick !== null && !v.exploded && ctx.tick - v.wreckedTick > TICK_RATE * 4) {
      v.exploded = true;
      ctx.events.push({ type: 'vehicle.exploded', vehicleId: v.id, x: v.x, y: v.y });
    }
  }
}
