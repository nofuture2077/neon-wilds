import { describe, expect, it } from 'vitest';
import { DOWNTOWN, NO_INPUT, Simulation, TICK_RATE, createVehicle, generateDistrict, objectiveMarkers, type SimEvent } from '../src';

const APPEARANCE = { skin: 1, hair: 2, top: 3, bottom: 4 };

function unlocked(seed = 61) {
  const sim = Simulation.create({ seed, playerName: 'Ash', appearance: APPEARANCE });
  sim.progression.missions = [{ id: 'last-run', status: 'completed', objective: 4 }];
  return sim;
}

/** Walk the player onto the east edge of Lantern Parade. */
function toEastExit(sim: Simulation) {
  const exit = sim.exitToward('downtown')!;
  sim.player.x = sim.player.prevX = sim.layout.map.width - 1.0;
  sim.player.y = sim.player.prevY = exit.y;
}

function run(sim: Simulation, ticks: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.step(NO_INPUT);
    out.push(...sim.drainEvents());
  }
  return out;
}

describe('city graph', () => {
  it('generates Downtown with its landmarks and a strict grid', () => {
    const layout = generateDistrict(DOWNTOWN, 5);
    for (const name of ['Halcyon Flagship Store', 'Lumen Spire', 'Wardens Central']) {
      expect(layout.buildings.some((b) => b.name === name)).toBe(true);
    }
    expect(layout.exits).toEqual([{ to: 'slums', side: 'west', street: 'Lantern Parade' }]);
  });

  it('the bridge is closed until Last Run is done', () => {
    const sim = Simulation.create({ seed: 60, playerName: 'Ash', appearance: APPEARANCE });
    toEastExit(sim);
    const ev = run(sim, 10);
    expect(sim.districtId).toBe('slums');
    expect(ev.some((e) => e.type === 'notice' && e.text.includes('checkpoint'))).toBe(true);
  });

  it('travels to Downtown and back, keeping each district’s state', () => {
    const sim = unlocked();
    const dez = sim.npcs.find((n) => n.id === 'npc-dez')!;
    dez.memory.push({ kind: 'helped', salience: 1, important: true, secondhand: false, at: 0 });
    toEastExit(sim);
    const ev = run(sim, 10);
    expect(ev).toContainEqual({ type: 'district.entered', districtId: 'downtown', name: 'Neon Downtown' });
    expect(sim.districtId).toBe('downtown');
    expect(sim.npcs.some((n) => n.archetypeId === 'office-worker')).toBe(true);
    expect(Object.values(sim.territory.controllers).every((c) => c === 'halcyon')).toBe(true);
    expect(sim.layout.map.isSolid(Math.floor(sim.player.x), Math.floor(sim.player.y))).toBe(false);

    // Walk back west.
    run(sim, TICK_RATE * 4);
    sim.player.x = sim.player.prevX = 1.0;
    sim.player.y = sim.player.prevY = sim.exitToward('slums')!.y;
    run(sim, 10);
    expect(sim.districtId).toBe('slums');
    expect(sim.npcs.find((n) => n.id === 'npc-dez')!.memory.some((m) => m.kind === 'helped')).toBe(true);
  });

  it('your car comes with you', () => {
    const sim = unlocked(62);
    toEastExit(sim);
    const car = createVehicle('mine', 'compact', 1, sim.player.x, sim.player.y, 0, 'player', sim.tick);
    sim.vehicles.push(car);
    sim.player.vehicleId = car.id;
    run(sim, 10);
    expect(sim.districtId).toBe('downtown');
    expect(sim.vehicles).toContain(car);
    expect(sim.playerVehicle).toBe(car);
  });

  it('saves and restores across districts deterministically', () => {
    const sim = unlocked(63);
    toEastExit(sim);
    run(sim, TICK_RATE * 5);
    const copy = Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot())));
    expect(copy.districtId).toBe('downtown');
    run(sim, 300);
    run(copy, 300);
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(sim.snapshot()));
  });

  it('objectives in another district point at the road out', () => {
    const sim = unlocked(64);
    toEastExit(sim);
    run(sim, 10);
    sim.progression.missions.push({ id: 'binbandit-chase', status: 'active', objective: 1 });
    const markers = objectiveMarkers(sim);
    expect(markers[0]?.label).toContain('The Slums');
    expect(markers[0]!.x).toBeLessThan(3);
  });

  it('Downtown has its own Wildlings', () => {
    const sim = unlocked(65);
    sim.progression.party.push({
      uid: 'g', speciesId: 'glitchling', nickname: null, level: 30, xp: 0,
      ivs: { hp: 1, attack: 1, defence: 1, focus: 1, resolve: 1, speed: 1 }, hp: 99, status: null,
      skills: ['static-nip'], heldItem: null, friendship: 70, loyalty: 100, injuries: 0, caughtTick: 0,
    });
    toEastExit(sim);
    run(sim, TICK_RATE * 15);
    const species = new Set(sim.wildlings.map((w) => w.speciesId));
    expect([...species].some((s) => ['wattbug', 'hydrantoad', 'heistcoon', 'fizzlet', 'neonyx'].includes(s))).toBe(true);
  });
});
