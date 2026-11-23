import { describe, expect, it } from 'vitest';
import {
  NO_INPUT,
  Simulation,
  TICK_RATE,
  act,
  decayMemories,
  generateCity,
  VESPER,
  gossip,
  lineOfSight,
  relationship,
  remember,
  scoreActivities,
  seq,
  sel,
  cond,
  tickTree,
  type BtHost,
  type MemoryRecord,
} from '../src';

const APPEARANCE = { skin: 1, hair: 2, top: 3, bottom: 4 };

describe('behaviour tree runtime', () => {
  it('runs sequences with memory and falls back in selectors', () => {
    const log: string[] = [];
    const host: BtHost<{ ok: boolean }> = {
      condition: (name, _p, ctx) => (name === 'ok' ? ctx.ok : false),
      action: (name, params, _ctx, memory, key) => {
        log.push(name);
        if (name === 'wait') {
          memory[key] = (memory[key] ?? 0) + 1;
          return memory[key]! >= Number(params.ticks) ? 'success' : 'running';
        }
        return 'success';
      },
    };
    const tree = sel(seq(cond('ok'), act('a'), act('wait', { ticks: 3 }), act('b')), act('fallback'));
    const mem: Record<string, number> = {};
    expect(tickTree(tree, host, { ok: true }, mem)).toBe('running');
    expect(tickTree(tree, host, { ok: true }, mem)).toBe('running');
    expect(tickTree(tree, host, { ok: true }, mem)).toBe('success');
    // 'a' ran once: the sequence resumed at the running child instead of restarting.
    expect(log.filter((l) => l === 'a')).toHaveLength(1);
    expect(tickTree(tree, host, { ok: false }, {})).toBe('success');
    expect(log.at(-1)).toBe('fallback');
  });
});

describe('memory and relationships', () => {
  it('reinforces, decays and derives feelings', () => {
    const mem: MemoryRecord[] = [];
    remember(mem, { kind: 'shoved', salience: 0.8, important: false, secondhand: false, at: 0 });
    remember(mem, { kind: 'shoved', salience: 0.8, important: false, secondhand: false, at: 5 });
    expect(mem).toHaveLength(1);
    expect(mem[0]!.salience).toBeGreaterThan(0.8);
    const before = relationship(mem);
    expect(before.affection).toBeLessThan(0);
    for (let h = 0; h < 80; h++) decayMemories(mem);
    expect(mem).toHaveLength(0);
  });

  it('important memories never fade', () => {
    const mem: MemoryRecord[] = [{ kind: 'helped', salience: 1, important: true, secondhand: false, at: 0 }];
    for (let h = 0; h < 500; h++) decayMemories(mem);
    expect(mem[0]!.salience).toBe(1);
    expect(relationship(mem).trust).toBeGreaterThan(0.5);
  });

  it('gossip passes the strongest first-hand memory on as a weaker rumour', () => {
    const teller: MemoryRecord[] = [{ kind: 'hit-by-car', salience: 1, important: false, secondhand: false, at: 0 }];
    const listener: MemoryRecord[] = [];
    expect(gossip(teller, listener, 10)).toBe('hit-by-car');
    expect(listener[0]).toMatchObject({ kind: 'hit-by-car', secondhand: true });
    expect(listener[0]!.salience).toBeLessThan(1);
    // Rumours are not re-told as first-hand knowledge.
    expect(gossip(listener, [], 11)).toBeNull();
  });

  it('walls block line of sight', () => {
    const layout = generateCity(VESPER, 5);
    const b = layout.buildings.find((x) => x.w >= 4 && x.h >= 4)!;
    const above = { x: b.x + b.w / 2, y: b.y - 1.5 };
    const below = { x: b.x + b.w / 2, y: b.y + b.h + 1.5 };
    expect(lineOfSight(layout.map, above.x, above.y, below.x, below.y)).toBe(false);
    expect(lineOfSight(layout.map, above.x, above.y, above.x + 2, above.y)).toBe(true);
  });
});

describe('daily routines', () => {
  it('scores activities from the schedule and needs', () => {
    const sim = Simulation.create({ seed: 7, playerName: 'A', appearance: APPEARANCE });
    const vendor = sim.npcs.find((n) => n.archetypeId === 'street-vendor')!;
    const noon = scoreActivities(vendor, vendor.agent!, 13, () => 0.5);
    expect(noon[0]![0]).toBe('work');
    const night = scoreActivities(vendor, { ...vendor.agent!, needs: { hunger: 0, fatigue: 1, social: 0 } }, 3, () => 0.5);
    expect(night[0]![0]).toBe('sleep');
  });

  it('NPCs go home to sleep and come back out over a day', () => {
    const sim = Simulation.create({ seed: 8, playerName: 'A', appearance: APPEARANCE, startMinutes: 20 * 60 });
    const named = () => sim.npcs.filter((n) => n.present && !n.transient && n.agent);
    let maxIndoors = 0;
    let minIndoorsAfterMorning = Infinity;
    const activities = new Set<string>();
    for (let i = 0; i < TICK_RATE * 60 * 20; i++) {
      sim.step(NO_INPUT);
      sim.drainEvents();
      if (i % 600 === 0) {
        const indoors = named().filter((n) => n.indoors).length;
        maxIndoors = Math.max(maxIndoors, indoors);
        if (sim.hour >= 12 && sim.hour < 15) minIndoorsAfterMorning = Math.min(minIndoorsAfterMorning, indoors);
        for (const n of named()) if (n.agent?.activity) activities.add(n.agent.activity);
      }
    }
    expect(maxIndoors).toBeGreaterThan(3);
    expect(minIndoorsAfterMorning).toBeLessThan(maxIndoors);
    for (const a of ['sleep', 'work', 'socialize', 'patrol']) expect(activities, a).toContain(a);
  }, 30000);

  it('crowd density follows the clock', () => {
    const count = (startMinutes: number) => {
      const sim = Simulation.create({ seed: 9, playerName: 'A', appearance: APPEARANCE, startMinutes });
      for (let i = 0; i < TICK_RATE * 40; i++) sim.step(NO_INPUT);
      return sim.npcs.filter((n) => n.transient).length;
    };
    expect(count(18 * 60)).toBeGreaterThan(count(2 * 60));
  });

  it('shoving someone spreads through gossip', () => {
    const sim = Simulation.create({ seed: 10, playerName: 'A', appearance: APPEARANCE, startMinutes: 15 * 60 });
    const victim = sim.npcs.find((n) => n.archetypeId === 'gutter-saint')!;
    remember(victim.memory, { kind: 'hit-by-car', salience: 1, important: true, secondhand: false, at: 0 });
    let heard = false;
    for (let i = 0; i < TICK_RATE * 60 * 8 && !heard; i++) {
      sim.step(NO_INPUT);
      sim.drainEvents();
      if (i % 300 === 0) heard = sim.npcs.some((n) => n !== victim && n.memory.some((m) => m.kind === 'hit-by-car' && m.secondhand));
    }
    expect(heard).toBe(true);
  }, 30000);
});
