import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, NO_INPUT, Rng, Simulation, checkAchievements, createWildling, migrateSnapshot, newStats, nextTip, recordsView, type SimEvent } from '../src';

const APPEARANCE = { skin: 1, hair: 2, top: 3, bottom: 4 };

/** A sim that has finished the opening: a Wildling in the party and Last Run done. */
function started(seed: number): Simulation {
  const sim = Simulation.create({ seed, playerName: 'Ash', appearance: APPEARANCE, startMinutes: 12 * 60 });
  sim.progression.missions.push({ id: 'last-run', status: 'completed', objective: 0 });
  sim.progression.party.push(createWildling('fizzlet', 8, new Rng(1), 'starter'));
  return sim;
}

function run(sim: Simulation, ticks: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.step(NO_INPUT);
    out.push(...sim.drainEvents());
  }
  return out;
}

describe('the in-game guide', () => {
  it('explains the loop once, as things come up', () => {
    const sim = started(31);
    const tips = run(sim, 600).filter((e) => e.type === 'tip');
    const ids = tips.map((t) => (t.type === 'tip' ? t.id : ''));
    expect(ids).toContain('job-board');
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(sim.progression.flags[`tip:${id}`]).toBe(true);
  });

  it('introduces each district on the first visit', () => {
    const sim = started(32);
    run(sim, 300);
    sim.travelTo('oldtown');
    const ids = run(sim, 900).flatMap((e) => (e.type === 'tip' ? [e.id] : []));
    expect(ids).toContain('district-oldtown');
  });

  it('puts the catching tip first in a wild battle', () => {
    const tip = nextTip({ flags: {}, started: true, wildNearby: true, inWildBattle: true, snares: 0, partyHurt: true, inVehicle: false, wanted: false, region: 'slums' });
    expect(tip?.id).toBe('wild-battle');
    expect(nextTip({ flags: {}, started: false, wildNearby: false, inWildBattle: false, snares: 3, partyHurt: false, inVehicle: false, wanted: false, region: 'slums' })).toBeNull();
  });
});

describe('reasons to drive and to catch', () => {
  it('the Scrapyard Exchange buys a stolen car', () => {
    const sim = started(33);
    const car = sim.vehicles.find((v) => v.driver === 'none')!;
    sim.player.x = car.x;
    sim.player.y = car.y + 1.2;
    sim.step({ ...NO_INPUT, action: true });
    expect(sim.player.vehicleId).toBe(car.id);
    const yard = sim.layout.buildings.find((b) => b.name === 'Scrapyard Exchange')!;
    car.x = car.prevX = sim.player.x = yard.entrance.tx + 0.5;
    car.y = car.prevY = sim.player.y = yard.entrance.ty + 0.5;
    car.speed = 0;
    const law = (sim as unknown as { law: { stars: number; heat: number } }).law;
    law.stars = 0;
    law.heat = 0;
    const money = sim.progression.money;
    const events = run(sim, 12);
    expect(events.some((e) => e.type === 'chop-shop')).toBe(true);
    expect(sim.player.vehicleId).toBeNull();
    expect(sim.vehicles).not.toContain(car);
    expect(sim.progression.money).toBeGreaterThan(money);
  });

  it('the Co-op pays a bounty as the Index fills up', () => {
    const sim = started(34);
    sim.progression.index.caught.push('fizzlet', 'cindertail', 'puddlefin', 'pebblet', 'ventwing');
    const money = sim.progression.money;
    (sim as unknown as { checkIndexMilestone(): void }).checkIndexMilestone();
    expect(sim.drainEvents()).toContainEqual({ type: 'index.milestone', caught: 5, money: 150 });
    expect(sim.progression.money).toBe(money + 150);
    (sim as unknown as { checkIndexMilestone(): void }).checkIndexMilestone();
    expect(sim.drainEvents().some((e) => e.type === 'index.milestone')).toBe(false);
  });
});

describe('the Co-op shuttle', () => {
  it('runs only to districts you have visited, for a fare', () => {
    const sim = started(35);
    run(sim, 40);
    sim.progression.money = 100;
    sim.enqueue({ type: 'shuttle', to: 'harbor' });
    run(sim, 2);
    expect(sim.districtId).not.toBe('harbor');
    sim.travelTo('harbor');
    run(sim, 40);
    sim.travelTo('slums');
    run(sim, 40);
    sim.enqueue({ type: 'shuttle', to: 'harbor' });
    run(sim, 2);
    expect(sim.districtId).toBe('harbor');
    expect(sim.progression.money).toBe(70);
  });
});

describe('local statistics and achievements', () => {
  it('counts distance and unlocks achievements once', () => {
    const sim = started(36);
    const p = sim.progression;
    for (let i = 0; i < 120; i++) sim.step({ ...NO_INPUT, moveX: 1 });
    expect(p.stats.walked).toBeGreaterThan(1);
    p.stats.captures = 1;
    const unlocked = checkAchievements(p).map((a) => a.id);
    expect(unlocked).toContain('first-catch');
    expect(checkAchievements(p).map((a) => a.id)).not.toContain('first-catch');
    const records = recordsView(sim);
    expect(records.achievements.find((a) => a.id === 'first-catch')?.unlocked).toBe(true);
    expect(records.achievements.find((a) => a.id === 'ending-the-hollow')?.title).toBe('???');
    expect(records.total).toBe(ACHIEVEMENTS.length);
  });

  it('adds empty statistics to older saves', () => {
    const snap = JSON.parse(JSON.stringify(started(37).snapshot()));
    snap.version = 13;
    delete snap.progression.stats;
    expect(migrateSnapshot(snap).progression.stats).toEqual(newStats());
  });
});
