import { describe, expect, it } from 'vitest';
import { EventQueue, NO_INPUT, Simulation, TICK_RATE, controllerOf, createWildling, factionTick, newFactionAgents, newTerritory, planGoap, repTier, Rng, type GoapAction, type SimEvent } from '../src';

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
      const agents = newFactionAgents();
      const ev = new EventQueue();
      for (let h = 0; h < 72; h++) {
        for (const f of agents) {
          factionTick(f, {
            layout: sim.layout,
            territory: t,
            reputation: rep,
            events: ev,
            world: { blackout: false, recallDrive: false, procession: false, hour: h % 24, absHour: h },
            spawnCrew: (_f, _b, n) => Array.from({ length: n }, (_, i) => `c${h}-${i}`),
            crewDisrupted: () => false,
            dismissCrew: () => {},
          });
        }
      }
      return { halcyon: Object.values(t.controllers).filter((c) => c === 'halcyon').length, events: ev.drain() };
    };
    const neutral = run({ saints: 0, halcyon: 0 });
    const proHalcyon = run({ saints: -60, halcyon: 60 });
    const proSaints = run({ saints: 60, halcyon: -60 });
    expect(neutral.events.some((e) => e.type === 'territory.changed')).toBe(true);
    expect(neutral.events.some((e) => e.type === 'faction.operation' && e.status === 'started')).toBe(true);
    expect(proHalcyon.halcyon).toBeGreaterThan(proSaints.halcyon);
  });

  it('runs the faction strategy every in-game hour inside the simulation', () => {
    const sim = newSim(44, 60 * 10 + 59);
    const before = JSON.stringify(sim.territory.influence);
    for (let i = 0; i < TICK_RATE * 2; i++) sim.step(NO_INPUT);
    expect(sim.factionAgents.every((f) => f.goal !== null)).toBe(true);
    for (let i = 0; i < TICK_RATE * 60 * 6; i++) sim.step(NO_INPUT);
    expect(JSON.stringify(sim.territory.influence)).not.toBe(before);
  }, 20000);

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

describe('faction GOAP', () => {
  const actions: GoapAction[] = [
    { id: 'fundraise', cost: 2, pre: {}, eff: { hasCash: true }, hours: 2, targeted: false, crew: 0 },
    { id: 'scout', cost: 1, pre: {}, eff: { hasIntel: true }, hours: 1, targeted: true, crew: 1 },
    { id: 'outreach', cost: 3, pre: { hasCash: true, hasIntel: true }, eff: { targetGained: true }, hours: 3, targeted: true, crew: 2 },
    { id: 'raid', cost: 2, pre: { hasIntel: true, hasCrew: true, aggressive: true }, eff: { targetGained: true }, hours: 2, targeted: true, crew: 3 },
  ];

  it('plans the cheapest action chain that satisfies the goal', () => {
    expect(planGoap({ hasCash: true }, { targetGained: true }, actions)).toEqual(['scout', 'outreach']);
    expect(planGoap({}, { targetGained: true }, actions)).toEqual(['scout', 'fundraise', 'outreach']);
    expect(planGoap({ hasCrew: true, aggressive: true }, { targetGained: true }, actions)).toEqual(['scout', 'raid']);
    expect(planGoap({}, { impossible: true }, actions)).toBeNull();
  });

  const ctxFor = (sim: ReturnType<typeof newSim>, world: Partial<{ blackout: boolean; recallDrive: boolean; procession: boolean }>, disrupted = false) => ({
    layout: sim.layout,
    territory: newTerritory(sim.layout),
    reputation: {},
    events: new EventQueue(),
    world: { blackout: false, recallDrive: false, procession: false, hour: 12, absHour: 12, ...world },
    spawnCrew: (_f: string, _b: string, n: number) => Array.from({ length: n }, (_, i) => `c${i}`),
    crewDisrupted: () => disrupted,
    dismissCrew: () => {},
  });

  it('Halcyon stops expanding during a blackout and saves money instead', () => {
    const sim = newSim(47);
    const [halcyon] = newFactionAgents();
    halcyon!.cash = 0;
    factionTick(halcyon!, ctxFor(sim, { blackout: true }));
    expect(halcyon!.goal).toBe('accumulate');
  });

  it('a faction that lost a block retaliates with a raid when it can', () => {
    const sim = newSim(48);
    const [halcyon] = newFactionAgents();
    halcyon!.members = 4;
    halcyon!.lostBlockAt = 11;
    const ctx = ctxFor(sim, {});
    factionTick(halcyon!, ctx);
    expect(halcyon!.log[0]).toContain('raid');
  });

  it('player harassment disrupts an operation and costs morale', () => {
    const sim = newSim(49);
    const [halcyon] = newFactionAgents();
    halcyon!.op = { action: 'outreach', blockId: sim.layout.blocks[0]!.id, hoursLeft: 3, crew: ['c0'], disrupted: false };
    const morale = halcyon!.morale;
    const ctx = ctxFor(sim, {}, true);
    factionTick(halcyon!, ctx);
    expect(ctx.events.drain()).toContainEqual(expect.objectContaining({ type: 'faction.operation', status: 'disrupted' }));
    expect(halcyon!.morale).toBeLessThan(morale);
    expect(halcyon!.op?.action).not.toBe('outreach'); // it re-plans right away
  });
});
