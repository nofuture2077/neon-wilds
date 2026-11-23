import { describe, expect, it } from 'vitest';
import { NO_INPUT, RoadNetwork, Rng, Simulation, TICK_RATE, VESPER, generateCity, isDrivable, type SimEvent } from '../src';

const APPEARANCE = { skin: 1, hair: 2, top: 3, bottom: 4 };
const newSim = (seed = 21) => Simulation.create({ seed, playerName: 'Ash', appearance: APPEARANCE });

describe('road network', () => {
  const layout = generateCity(VESPER, 4);
  const roads = new RoadNetwork(layout);

  it('lanes sit on drivable road, on opposite sides for opposite directions', () => {
    for (const e of roads.edges.slice(0, 30)) {
      const len = roads.edgeLength(e.id);
      const s = len / 2;
      const fwd = roads.lane(e.id, s, true);
      const back = roads.lane(e.id, s, false);
      expect(isDrivable(layout.map.get(Math.floor(fwd.x), Math.floor(fwd.y))), `edge ${e.id}`).toBe(true);
      expect(Math.hypot(fwd.x - back.x, fwd.y - back.y)).toBeGreaterThan(2);
      expect(Math.abs(Math.cos(fwd.heading - back.heading) + 1)).toBeLessThan(0.05);
    }
  });

  it('never chooses a U-turn at a junction with other options', () => {
    const node = roads.nodes.find((n) => n.edges.length >= 3)!;
    for (let i = 0; i < 20; i++) {
      const next = roads.chooseNext(node.id, node.edges[0]!, new Rng(i));
      expect(next.edge).not.toBe(node.edges[0]);
    }
  });

  it('signals give conflicting approaches different phases', () => {
    const node = roads.nodes.find((n) => n.edges.length >= 3)!;
    let sawRed = false;
    let sawGreen = false;
    for (let t = 0; t < TICK_RATE * 30; t += 10) {
      const states = node.edges.map((e) => roads.signalState(node.id, e, t));
      if (states.includes('red')) sawRed = true;
      if (states.includes('green')) sawGreen = true;
      expect(states.every((s) => s === 'green')).toBe(false);
    }
    expect(sawRed && sawGreen).toBe(true);
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
    const onRoad = ai.filter((v) => isDrivable(sim.layout.map.get(Math.floor(v.x), Math.floor(v.y))));
    expect(onRoad.length).toBeGreaterThanOrEqual(ai.length - 1);
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

    // Take it out onto the longest road.
    const roads = new RoadNetwork(sim.layout);
    const longest = [...roads.edges].sort((a, b) => roads.edgeLength(b.id) - roads.edgeLength(a.id))[0]!;
    const pose = roads.lane(longest.id, 6, true);
    car.x = car.prevX = sim.player.x = pose.x;
    car.y = car.prevY = sim.player.y = pose.y;
    car.heading = pose.heading;
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
    // Line up with a building front across the street and floor it.
    const b = sim.layout.buildings.find((x) => x.w >= 5 && x.h >= 5)!;
    const dx = b.entrance.tx - b.door.tx;
    const dy = b.entrance.ty - b.door.ty;
    car.x = car.prevX = sim.player.x = b.entrance.tx + 0.5 + dx * 6;
    car.y = car.prevY = sim.player.y = b.entrance.ty + 0.5 + dy * 6;
    car.heading = Math.atan2(-dy, -dx);
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
