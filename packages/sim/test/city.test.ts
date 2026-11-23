import { describe, expect, it } from 'vitest';
import { NO_INPUT, Simulation, TICK_RATE, createVehicle, regionOf } from '../src';

const APPEARANCE = { skin: 1, hair: 2, top: 3, bottom: 4 };

describe('seamless city', () => {
  it('the player starts in the Slums and every district is part of one map', () => {
    const sim = Simulation.create({ seed: 61, playerName: 'Ash', appearance: APPEARANCE });
    expect(sim.districtId).toBe('slums');
    const regions = new Set(sim.npcs.map((n) => regionOf(sim.layout, n.x, n.y).id));
    for (const r of ['slums', 'downtown', 'harbor', 'industrial']) expect(regions, r).toContain(r);
  });

  it('walking across a region border changes the district without any loading', () => {
    const sim = Simulation.create({ seed: 62, playerName: 'Ash', appearance: APPEARANCE });
    const layout = sim.layout;
    sim.travelTo('downtown');
    sim.step(NO_INPUT);
    expect(sim.districtId).toBe('downtown');
    expect(sim.districtName).toBe('Neon Downtown');
    expect(sim.layout).toBe(layout); // same map, no reload
  });

  it('fast travel takes your car along', () => {
    const sim = Simulation.create({ seed: 63, playerName: 'Ash', appearance: APPEARANCE });
    const car = createVehicle('mine', 'compact', 1, sim.player.x, sim.player.y, 0, 'player', sim.tick);
    sim.vehicles.push(car);
    sim.player.vehicleId = car.id;
    sim.travelTo('harbor');
    expect(regionOf(sim.layout, car.x, car.y).id).toBe('harbor');
    expect(sim.player.x).toBe(car.x);
  });

  it('saves and restores deterministically', () => {
    const sim = Simulation.create({ seed: 64, playerName: 'Ash', appearance: APPEARANCE });
    for (let i = 0; i < TICK_RATE * 3; i++) sim.step(NO_INPUT);
    const copy = Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot())));
    for (let i = 0; i < 300; i++) {
      sim.step(NO_INPUT);
      copy.step(NO_INPUT);
    }
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(sim.snapshot()));
  });

  it('district Wildlings spawn in their own districts', () => {
    const sim = Simulation.create({ seed: 65, playerName: 'Ash', appearance: APPEARANCE });
    sim.progression.party.push({
      uid: 'g', speciesId: 'glitchling', nickname: null, level: 30, xp: 0,
      ivs: { hp: 1, attack: 1, defence: 1, focus: 1, resolve: 1, speed: 1 }, hp: 99, status: null,
      skills: ['static-nip'], heldItem: null, friendship: 70, loyalty: 100, injuries: 0, caughtTick: 0,
    });
    sim.travelTo('harbor');
    for (let i = 0; i < TICK_RATE * 15; i++) sim.step(NO_INPUT);
    const species = sim.wildlings.filter((w) => regionOf(sim.layout, w.x, w.y).id === 'harbor').map((w) => w.speciesId);
    expect(species.some((s) => ['brinekin', 'puddlefin', 'gutterjaw', 'dockhulk'].includes(s))).toBe(true);
  });
});
