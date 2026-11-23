import { describe, expect, it } from 'vitest';
import { NO_INPUT, Simulation, TICK_RATE, createVehicle, starsFor, type SimEvent } from '../src';

const APPEARANCE = { skin: 1, hair: 2, top: 3, bottom: 4 };
const newSim = (seed = 31) => Simulation.create({ seed, playerName: 'Ash', appearance: APPEARANCE });

function run(sim: Simulation, ticks: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.step(NO_INPUT);
    out.push(...sim.drainEvents());
  }
  return out;
}

/** Park a police cruiser right next to the player so they are "seen". */
function policeNextToPlayer(sim: Simulation) {
  const v = createVehicle('cop-test', 'cruiser', 0, sim.player.x + 3, sim.player.y, 0, 'police', sim.tick);
  sim.vehicles.push(v);
  return v;
}

describe('wanted system', () => {
  it('maps heat to stars', () => {
    expect(starsFor(0)).toBe(0);
    expect(starsFor(25)).toBe(1);
    expect(starsFor(130)).toBe(3);
  });

  it('a crime in front of the police gives an immediate wanted level', () => {
    const sim = newSim();
    policeNextToPlayer(sim);
    sim.reportCrime('carjacking', sim.player.x, sim.player.y, 3);
    expect(sim.law.stars).toBeGreaterThanOrEqual(2);
    expect(sim.drainEvents()).toContainEqual(expect.objectContaining({ type: 'crime', kind: 'carjacking', witnessed: true }));
  });

  it('civilian witnesses phone it in after a delay; Gutter Saints never do', () => {
    const sim = newSim(32);
    for (const n of sim.npcs) n.present = false;
    const civilian = sim.npcs.find((n) => n.archetypeId === 'night-worker')!;
    civilian.present = true;
    civilian.x = sim.player.x + 2;
    civilian.y = sim.player.y;
    let reported = false;
    let wanted = false;
    for (let attempt = 0; attempt < 10 && !reported; attempt++) {
      sim.reportCrime('vehicle-theft', sim.player.x, sim.player.y, 1);
      const events = run(sim, TICK_RATE * 10);
      reported = events.some((e) => e.type === 'notice' && e.text.includes('called the Wardens'));
      wanted ||= events.some((e) => e.type === 'wanted.changed' && e.stars >= 1);
    }
    expect(reported).toBe(true);
    expect(wanted).toBe(true); // (a patrol may well have busted the player since)

    const saints = newSim(33);
    for (const n of saints.npcs) n.present = false;
    const saint = saints.npcs.find((n) => n.archetypeId === 'gutter-saint')!;
    saint.present = true;
    saint.x = saints.player.x + 2;
    saint.y = saints.player.y;
    for (let i = 0; i < 5; i++) saints.reportCrime('vehicle-theft', saints.player.x, saints.player.y, 1);
    run(saints, TICK_RATE * 12);
    expect(saints.law.heat).toBe(0);
  });

  it('heat decays once the police lose sight of you', () => {
    const sim = newSim(34);
    const cop = policeNextToPlayer(sim);
    sim.reportCrime('vehicle-theft', sim.player.x, sim.player.y, 1);
    expect(sim.law.stars).toBe(1);
    sim.vehicles.splice(sim.vehicles.indexOf(cop), 1);
    // Keep any newly dispatched cruisers far away by teleporting them off.
    for (let i = 0; i < TICK_RATE * 30 && sim.law.stars > 0; i++) {
      for (const v of sim.vehicles) if (v.driver === 'police') v.x = v.prevX = 1;
      sim.step(NO_INPUT);
      sim.drainEvents();
    }
    expect(sim.law.stars).toBe(0);
  });

  it('dispatches pursuit cruisers and officers who arrest a suspect on foot', () => {
    const sim = newSim(35);
    sim.progression.money = 500;
    policeNextToPlayer(sim);
    sim.reportCrime('carjacking', sim.player.x, sim.player.y, 3);
    let busted: SimEvent | undefined;
    for (let i = 0; i < TICK_RATE * 30 && !busted; i++) {
      sim.step(NO_INPUT);
      busted = sim.drainEvents().find((e) => e.type === 'busted');
    }
    expect(busted).toMatchObject({ type: 'busted', lostMoney: 100 });
    expect(sim.law.stars).toBe(0);
    expect(sim.progression.money).toBe(400);
    const station = sim.layout.buildings.find((b) => b.name === 'Warden Substation 14')!;
    expect(Math.hypot(sim.player.x - (station.entrance.tx + 0.5), sim.player.y - (station.entrance.ty + 0.5))).toBeLessThan(1.5);
  });

  it('a respray at Rustbucket Garage clears the wanted level when unseen', () => {
    const sim = newSim(36);
    sim.progression.money = 300;
    const garage = sim.layout.buildings.find((b) => b.name === 'Rustbucket Garage')!;
    const car = createVehicle('getaway', 'compact', 2, garage.entrance.tx + 0.5, garage.entrance.ty + 0.5, 0, 'player', sim.tick);
    sim.vehicles.push(car);
    sim.player.vehicleId = car.id;
    sim.law.heat = 30;
    sim.law.stars = 1;
    sim.law.lastSeenTick = -1e6;
    for (const v of sim.vehicles) if (v.driver === 'police') v.x = 1;
    let resprayed = false;
    for (let i = 0; i < 30 && !resprayed; i++) {
      sim.step(NO_INPUT);
      resprayed = sim.drainEvents().some((e) => e.type === 'respray');
    }
    expect(resprayed).toBe(true);
    expect(sim.law.stars).toBe(0);
    expect(sim.progression.money).toBe(200);
  });
});
