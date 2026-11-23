import { describe, expect, it } from 'vitest';
import { EventQueue, NO_INPUT, Simulation, TICK_RATE, controllerOf, createWildling, factionHour, newTerritory, repTier, Rng, type SimEvent } from '../src';

const APPEARANCE = { skin: 1, hair: 2, top: 3, bottom: 4 };
const newSim = (seed = 41, startMinutes?: number) =>
  Simulation.create({ seed, playerName: 'Ash', appearance: APPEARANCE, ...(startMinutes !== undefined ? { startMinutes } : {}) });

describe('reputation', () => {
  it('maps values to tiers', () => {
    expect(repTier(-70)).toBe('Hunted');
    expect(repTier(-25)).toBe('Distrusted');
    expect(repTier(0)).toBe('Unknown');
    expect(repTier(30)).toBe('Trusted');
    expect(repTier(80)).toBe('Family');
  });

  it('shoving a Gutter Saint costs Saints reputation', () => {
    const sim = newSim();
    const saint = sim.npcs.find((n) => n.archetypeId === 'gutter-saint')!;
    saint.x = sim.player.x + 1.2;
    saint.y = sim.player.y;
    saint.mode = 'idle';
    saint.timer = 100;
    const events: SimEvent[] = [];
    for (let i = 0; i < 30; i++) {
      sim.step({ moveX: 1, moveY: 0, run: true, interact: false });
      events.push(...sim.drainEvents());
    }
    expect(sim.progression.reputation.saints).toBeLessThan(0);
    expect(events.some((e) => e.type === 'reputation.changed' && e.faction === 'saints')).toBe(true);
  });
});

describe('territory', () => {
  it('Halcyon starts around its kiosk and the Saints hold the rest', () => {
    const sim = newSim(42);
    const controllers = Object.values(sim.territory.controllers);
    expect(controllers.filter((c) => c === 'halcyon').length).toBe(1);
    expect(controllers.filter((c) => c === 'saints').length).toBeGreaterThan(5);
  });

  it('factions contest blocks over time, and player standing tips the balance', () => {
    const sim = newSim(43);
    const run = (rep: Record<string, number>) => {
      const t = newTerritory(sim.layout);
      const ev = new EventQueue();
      for (let h = 0; h < 72; h++) factionHour(t, sim.layout, rep, ev);
      return { halcyon: Object.values(t.controllers).filter((c) => c === 'halcyon').length, events: ev.drain() };
    };
    const neutral = run({ saints: 0, halcyon: 0 });
    const proHalcyon = run({ saints: -60, halcyon: 60 });
    const proSaints = run({ saints: 60, halcyon: -60 });
    expect(neutral.events.some((e) => e.type === 'territory.changed')).toBe(true);
    expect(proHalcyon.halcyon).toBeGreaterThan(proSaints.halcyon);
  });

  it('runs the faction strategy every in-game hour inside the simulation', () => {
    const sim = newSim(44, 60 * 10 + 59);
    const before = JSON.stringify(sim.territory.influence);
    for (let i = 0; i < TICK_RATE * 2; i++) sim.step(NO_INPUT);
    expect(JSON.stringify(sim.territory.influence)).not.toBe(before);
  });

  it('a block needs a clear lead to be controlled', () => {
    expect(controllerOf({ saints: 55, halcyon: 50 })).toBeNull();
    expect(controllerOf({ saints: 70, halcyon: 20 })).toBe('saints');
    expect(controllerOf({ saints: 40, halcyon: 45 })).toBeNull();
  });
});

describe('economy', () => {
  it('black-market demand drops as you sell the same species', () => {
    const sim = newSim(45);
    const pawn = sim.layout.buildings.find((b) => b.name === 'Paper Moon Pawn')!;
    sim.player.x = pawn.entrance.tx + 0.5;
    sim.player.y = pawn.entrance.ty + 0.5;
    const rng = new Rng(1);
    for (let i = 0; i < 4; i++) sim.progression.party.push(createWildling('fizzlet', 8, rng, `f${i}`));
    const first = sim.salePrice(sim.progression.party[1]!);
    sim.enqueue({ type: 'market.sellWildling', from: 'party', index: 1 });
    sim.step(NO_INPUT);
    const second = sim.salePrice(sim.progression.party[1]!);
    expect(second).toBeLessThan(first);
    expect(sim.progression.money).toBe(100 + first);
    expect(sim.progression.reputation.saints).toBeLessThan(0);
  });

  it('prices react to who controls the shop block', () => {
    const sim = newSim(46);
    const pawn = sim.layout.buildings.find((b) => b.name === 'Paper Moon Pawn')!;
    const blockId = Object.keys(sim.territory.influence).find((id) => {
      const b = sim.layout.blocks.find((x) => x.id === id)!;
      return pawn.x >= b.x && pawn.x < b.x + b.w && pawn.y >= b.y && pawn.y < b.y + b.h;
    })!;
    sim.territory.controllers[blockId] = 'saints';
    const saintsPrice = sim.shopPrice('paper-moon', 'coil-snare');
    sim.territory.controllers[blockId] = 'halcyon';
    const halcyonPrice = sim.shopPrice('paper-moon', 'coil-snare');
    expect(halcyonPrice).toBeGreaterThan(saintsPrice);
  });
});
