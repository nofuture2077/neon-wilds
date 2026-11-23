import { DT, TICK_RATE } from '../constants';
import type { EventQueue } from '../core/events';
import type { Rng } from '../core/rng';
import type { DistrictLayout } from './district';
import { type Band, DIR_ANGLE, DIR_VEC, type Dir, LEFT_OF, OPPOSITE, RIGHT_OF, type RoadNetwork, isDrivable, laneCoord } from './roads';

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
  dir: Dir;
  /** Waypoints while turning through an intersection. */
  route: { x: number; y: number }[];
  nextDir: Dir | null;
  blockedTime: number;
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
  const { roads, rng, layout } = ctx;
  for (let attempt = 0; attempt < 10; attempt++) {
    const vertical = rng.chance(0.5);
    const bands = vertical ? roads.vbands : roads.hbands;
    const band = rng.pick(bands);
    const dir: Dir = vertical ? (rng.chance(0.5) ? 'N' : 'S') : rng.chance(0.5) ? 'E' : 'W';
    const along = vertical ? rng.range(1, layout.map.height - 1) : rng.range(1, layout.map.width - 1);
    const lane = laneCoord(band, dir);
    const x = vertical ? lane : along;
    const y = vertical ? along : lane;
    const d = Math.hypot(x - player.x, y - player.y);
    if (d < SPAWN_MIN || d > SPAWN_MAX) continue;
    if (roads.intersectionAt(x, y)) continue;
    if (!onRoadLane(ctx, x, y)) continue;
    if (list.some((o) => Math.hypot(o.x - x, o.y - y) < 4)) continue;
    const classId: VehicleClassId = rng.chance(0.15) ? 'van' : rng.chance(0.5) ? 'sedan' : 'compact';
    const v = createVehicle(ctx.nextId(), classId, rng.int(0, 5), x, y, DIR_ANGLE[dir], 'ai', ctx.tick);
    v.ai = { dir, route: [], nextDir: null, blockedTime: 0 };
    v.speed = 3;
    list.push(v);
    return;
  }
}

function onRoadLane(ctx: VehicleContext, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return !ctx.layout.map.isSolid(tx, ty) && isDrivable(ctx.layout.map.get(tx, ty));
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
    return;
  }
  const cruise = pursuing ? c.maxSpeed : Math.min(c.maxSpeed, 4.6);
  let target = cruise;

  if (ai.route.length === 0) {
    const next = ctx.roads.nextIntersection(v.x, v.y, ai.dir);
    if (next) {
      if (next.distance < 0.2) {
        ai.nextDir = pursuing ? chooseExitToward(next.node.exits, ai.dir, v, ctx.pursuit!) : chooseExit(next.node.exits, ai.dir, ctx.rng);
        ai.route = ctx.roads.turnPath(next.node, ai.dir, ai.nextDir);
      } else {
        if (!ctx.roads.isGreen(next.node, ai.dir, ctx.tick) && !pursuing) {
          target = Math.min(target, Math.max(0, (next.distance - 0.3) * 1.6));
        }
        target = Math.min(target, 2.6 + next.distance * 0.8);
      }
    }
  } else {
    target = Math.min(target, pursuing ? 5 : 2.6);
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

  // Steering: follow the turn route, else hold the lane centre.
  let tx: number;
  let ty: number;
  const node = ai.route[0];
  if (node) {
    tx = node.x;
    ty = node.y;
    if (Math.hypot(tx - v.x, ty - v.y) < 0.35) {
      ai.route.shift();
      if (ai.route.length === 0 && ai.nextDir) {
        ai.dir = ai.nextDir;
        ai.nextDir = null;
      }
    }
  } else {
    const d = DIR_VEC[ai.dir];
    const band = ai.dir === 'N' || ai.dir === 'S' ? ctx.roads.vbandAt(v.x) : ctx.roads.hbandAt(v.y);
    const lane = band ? laneCoord(band as Band, ai.dir) : ai.dir === 'N' || ai.dir === 'S' ? v.x : v.y;
    tx = ai.dir === 'N' || ai.dir === 'S' ? lane : v.x + d.x * 2;
    ty = ai.dir === 'N' || ai.dir === 'S' ? v.y + d.y * 2 : lane;
  }
  const want = Math.atan2(ty - v.y, tx - v.x);
  let delta = want - v.heading;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const maxTurn = c.turnRate * 1.4 * DT;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, delta)) / DT;
  v.vx = Math.cos(v.heading) * v.speed;
  v.vy = Math.sin(v.heading) * v.speed;
  const impact = integrate(v, ctx, v.speed > 0.05 ? turn : 0);
  if (impact > 2) damageVehicle(v, (impact - 2) * 5, ctx);
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
  if (v.ai) {
    // Re-align lane state with the nearest road axis for when the chase ends.
    v.ai.route = [];
    v.ai.dir = Math.abs(Math.cos(v.heading)) > Math.abs(Math.sin(v.heading)) ? (Math.cos(v.heading) > 0 ? 'E' : 'W') : Math.sin(v.heading) > 0 ? 'S' : 'N';
  }
}

/** Greedy route choice: take the exit that points most toward the target. */
function chooseExitToward(exits: Record<Dir, boolean>, dir: Dir, v: VehicleState, target: { x: number; y: number }): Dir {
  const tx = target.x - v.x;
  const ty = target.y - v.y;
  let best: Dir = OPPOSITE[dir];
  let bestScore = -Infinity;
  for (const d of [dir, RIGHT_OF[dir], LEFT_OF[dir]] as Dir[]) {
    if (!exits[d]) continue;
    const score = DIR_VEC[d].x * tx + DIR_VEC[d].y * ty;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function chooseExit(exits: Record<Dir, boolean>, dir: Dir, rng: Rng): Dir {
  const options: Array<[Dir, number]> = [];
  if (exits[dir]) options.push([dir, 3]);
  if (exits[RIGHT_OF[dir]]) options.push([RIGHT_OF[dir], 1.5]);
  if (exits[LEFT_OF[dir]]) options.push([LEFT_OF[dir], 1]);
  if (options.length === 0) return OPPOSITE[dir];
  const total = options.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * total;
  for (const [d, w] of options) if ((r -= w) <= 0) return d;
  return options[0]![0];
}

/** Separate overlapping vehicles and apply crash damage. */
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
