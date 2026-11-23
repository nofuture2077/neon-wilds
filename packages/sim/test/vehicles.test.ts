import { describe, expect, it } from 'vitest';
import { NO_INPUT, RoadNetwork, SLUMS, Simulation, TICK_RATE, generateDistrict, isDrivable, type SimEvent } from '../src';

const APPEARANCE = { skin: 1, hair: 2, top: 3, bottom: 4 };
const newSim = (seed = 21) => Simulation.create({ seed, playerName: 'Ash', appearance: APPEARANCE });

describe('road network', () => {
  const layout = generateDistrict(SLUMS, 4);
  const roads = new RoadNetwork(layout);

  it('finds intersections whose exits lead onto drivable road', () => {
    expect(roads.intersections.length).toBeGreaterThan(10);
    for (const n of roads.intersections) {
      const exits = Object.values(n.exits).filter(Boolean).length;
      expect(exits).toBeGreaterThanOrEqual(2);
    }
  });

  it('builds turn paths that end in the exit lane', () => {
    const node = roads.intersections.find((n) => n.exits.S && n.exits.W && n.exits.N)!;
    const path = roads.turnPath(node, 'S', 'W');
    const end = path.at(-1)!;
    expect(end.y).toBeCloseTo(node.h.from + 1.5);
    expect(end.x).toBeCloseTo(node.x0);
  });

  it('alternates signal phases between the two axes', () => {
    const node = roads.intersections.find((n) => n.signal)!;
    let nsGreen = 0;
    let ewGreen = 0;
    for (let t = 0; t < TICK_RATE * 30; t += 10) {
      const ns = roads.isGreen(node, 'N', t);
      const ew = roads.isGreen(node, 'E', t);
      expect(ns && ew).toBe(false);
      if (ns) nsGreen++;
      if (ew) ewGreen++;
    }
    expect(nsGreen).toBeGreaterThan(0);
    expect(ewGreen).toBeGreaterThan(0);
  });
});

describe('traffic', () => {
  it('spawns AI cars that drive along roads without entering buildings', () => {
    const sim = newSim();
    const moved = new Map<string, number>();
    for (let i = 0; i < TICK_RATE * 40; i++) {
      sim.step(NO_INPUT);
      sim.drainEvents();
      for (const v of sim.vehicles) {
        expect(sim.layout.map.isSolid(Math.floor(v.x), Math.floor(v.y)), `${v.id} in a wall`).toBe(false);
        if (v.driver === 'ai') moved.set(v.id, (moved.get(v.id) ?? 0) + Math.hypot(v.x - v.prevX, v.y - v.prevY));
      }
    }
    const ai = sim.vehicles.filter((v) => v.driver === 'ai');
    expect(ai.length).toBeGreaterThan(5);
    for (const v of ai) expect(isDrivable(sim.layout.map.get(Math.floor(v.x), Math.floor(v.y))) || v.wreckedTick !== null).toBe(true);
    expect([...moved.values()].filter((d) => d > 10).length).toBeGreaterThan(3);
  });
});

describe('player driving', () => {
  function enterNearestParked(sim: Simulation) {
    const car = sim.vehicles.find((v) => v.driver === 'none')!;
    sim.player.x = car.x;
    sim.player.y = car.y + 1.2;
    sim.step({ ...NO_INPUT, action: true });
    return { car, events: sim.drainEvents() };
  }

  it('stealing a parked car is a crime, and the car drives and stays out of buildings', () => {
    const sim = newSim();
    const { car, events } = enterNearestParked(sim);
    expect(sim.player.vehicleId).toBe(car.id);
    expect(events.some((e) => e.type === 'crime' && e.kind === 'vehicle-theft')).toBe(true);
    expect(events).toContainEqual({ type: 'vehicle.entered', vehicleId: car.id, how: 'stolen' });

    const start = { x: car.x, y: car.y };
    const all: SimEvent[] = [];
    for (let i = 0; i < TICK_RATE * 6; i++) {
      sim.step({ moveX: i % 120 < 60 ? 0.6 : -0.4, moveY: -1, run: false, interact: false });
      all.push(...sim.drainEvents());
      expect(sim.layout.map.isSolid(Math.floor(car.x), Math.floor(car.y))).toBe(false);
      expect(sim.player.x).toBe(car.x);
    }
    expect(Math.hypot(car.x - start.x, car.y - start.y)).toBeGreaterThan(3);

    // Stop and get out.
    for (let i = 0; i < TICK_RATE * 3; i++) sim.step({ moveX: 0, moveY: 1, run: true, interact: false });
    sim.step({ ...NO_INPUT, action: true });
    expect(sim.player.vehicleId).toBeNull();
    expect(sim.layout.map.isSolid(Math.floor(sim.player.x), Math.floor(sim.player.y))).toBe(false);
  });

  it('crashing hard damages the car', () => {
    const sim = newSim(22);
    const { car } = enterNearestParked(sim);
    const hp = car.hp;
    for (let i = 0; i < TICK_RATE * 12; i++) sim.step({ moveX: 0, moveY: -1, run: false, interact: false });
    sim.drainEvents();
    expect(car.hp).toBeLessThan(hp);
  });

  it('round-trips vehicles through snapshots deterministically', () => {
    const sim = newSim(23);
    enterNearestParked(sim);
    for (let i = 0; i < 200; i++) sim.step({ moveX: 0.3, moveY: -1, run: false, interact: false });
    const copy = Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot())));
    for (let i = 0; i < 200; i++) {
      sim.step({ moveX: -0.2, moveY: -1, run: false, interact: false });
      copy.step({ moveX: -0.2, moveY: -1, run: false, interact: false });
    }
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(sim.snapshot()));
  });
});
