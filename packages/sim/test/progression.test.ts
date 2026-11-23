import { describe, expect, it } from 'vitest';
import {
  NO_INPUT,
  Simulation,
  TICK_RATE,
  battleView,
  getSpecies,
  progressView,
  type SimEvent,
  type Simulation as Sim,
} from '../src';

const APPEARANCE = { skin: 0xe0ac69, hair: 0x222222, top: 0x00e5ff, bottom: 0x222233 };
const newSim = (seed = 99) => Simulation.create({ seed, playerName: 'Ash', appearance: APPEARANCE });

function at(sim: Sim, name: string) {
  const b = sim.layout.buildings.find((x) => x.name === name)!;
  sim.player.x = b.entrance.tx + 0.5;
  sim.player.y = b.entrance.ty + 0.5;
  for (const n of sim.npcs) if (Math.hypot(n.x - sim.player.x, n.y - sim.player.y) < 3) n.x += 10;
  return b;
}

function interact(sim: Sim): SimEvent[] {
  sim.step({ ...NO_INPUT, interact: true });
  return sim.drainEvents();
}

function winBattle(sim: Sim): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < 40 && sim.battle; i++) {
    const action = sim.battle.phase === 'force-switch'
      ? { kind: 'switch' as const, partyIndex: sim.progression.party.findIndex((w) => w.hp > 0) }
      : { kind: 'skill' as const, index: 0 };
    sim.enqueue({ type: 'battle.action', action });
    sim.step(NO_INPUT);
    events.push(...sim.drainEvents());
  }
  return events;
}

describe('mission: Last Run', () => {
  it('plays from pickup to the clinic, including the Glitchling and the Aegis battle', () => {
    const sim = newSim();
    sim.step(NO_INPUT);
    const start = sim.drainEvents();
    expect(start.some((e) => e.type === 'mission.started' && e.missionId === 'last-run')).toBe(true);

    at(sim, 'Vesper Courier Co-op');
    let ev = interact(sim);
    expect(ev.some((e) => e.type === 'mission.updated')).toBe(true);
    expect(sim.progression.inventory['courier-capsule']).toBe(1);

    at(sim, 'Halcyon Outreach Kiosk');
    ev = interact(sim);
    expect(sim.progression.party.map((w) => w.speciesId)).toEqual(['glitchling']);
    expect(sim.progression.inventory['courier-capsule']).toBeUndefined();
    const aegis = sim.npcs.find((n) => n.id === 'npc-aegis')!;
    expect(aegis.present).toBe(true);

    // Make the fight reliable for the test.
    const g = sim.progression.party[0]!;
    g.level = 25;
    g.hp = 999;
    g.hp = Math.min(g.hp, progressView(sim).party[0]!.maxHp);

    sim.player.x = aegis.x;
    sim.player.y = aegis.y - 1;
    sim.player.heading = Math.PI / 2;
    ev = interact(sim);
    expect(ev.find((e) => e.type === 'dialogue.opened')).toMatchObject({ npcId: 'npc-aegis' });
    sim.enqueue({ type: 'endDialogue' });
    sim.step(NO_INPUT);
    ev = sim.drainEvents();
    expect(ev.some((e) => e.type === 'battle.started' && e.kind === 'trainer')).toBe(true);
    expect(battleView(sim)?.trainerName).toBe('Agent Kerr');

    ev = winBattle(sim);
    expect(ev.some((e) => e.type === 'battle.ended' && e.outcome === 'win')).toBe(true);
    expect(aegis.present).toBe(false);
    expect(sim.progression.defeatedTrainers).toContain('npc-aegis');

    at(sim, 'Saint Ottilie Free Clinic');
    ev = interact(sim);
    expect(ev.some((e) => e.type === 'mission.completed' && e.missionId === 'last-run')).toBe(true);
    expect(sim.progression.inventory['tin-snare']).toBe(8);
    expect(sim.npcs.find((n) => n.id === 'npc-vik')!.present).toBe(true);
    expect(progressView(sim).missions[0]).toMatchObject({ id: 'last-run', status: 'completed' });
  });
});

describe('wild encounters', () => {
  it('spawns Wildlings matching the time of day and starts a battle on contact', () => {
    const sim = newSim(5);
    sim.progression.party.push(
      ...[0].map(() => ({
        uid: 'w99',
        speciesId: 'glitchling',
        nickname: null,
        level: 30,
        xp: 0,
        ivs: { hp: 10, attack: 10, defence: 10, focus: 10, resolve: 10, speed: 10 },
        hp: 100,
        status: null,
        skills: ['static-nip', 'shadow-swipe'],
        heldItem: null,
        friendship: 70,
        loyalty: 100,
        injuries: 0,
        caughtTick: 0,
      })),
    );
    for (let i = 0; i < TICK_RATE * 10; i++) sim.step(NO_INPUT);
    sim.drainEvents();
    expect(sim.wildlings.length).toBeGreaterThan(5);
    for (const w of sim.wildlings) {
      const habitats = getSpecies(w.speciesId).habitats;
      expect(habitats.some((h) => h.time.includes('night')), w.speciesId).toBe(true);
    }
    const target = sim.wildlings[0]!;
    target.calmUntilTick = 0;
    sim.player.x = target.x;
    sim.player.y = target.y;
    sim.step(NO_INPUT);
    const ev = sim.drainEvents();
    expect(ev.some((e) => e.type === 'battle.started' && e.kind === 'wild')).toBe(true);
    expect(sim.progression.index.seen).toContain(target.speciesId);
    winBattle(sim);
    expect(sim.battle).toBeNull();
    expect(sim.wildlings.find((w) => w.id === target.id)).toBeUndefined();
  });

  it('Wildlings do not start battles when the player has no healthy party', () => {
    const sim = newSim(6);
    for (let i = 0; i < TICK_RATE * 5; i++) sim.step(NO_INPUT);
    const w = sim.wildlings[0]!;
    sim.player.x = w.x;
    sim.player.y = w.y;
    sim.step(NO_INPUT);
    expect(sim.battle).toBeNull();
  });
});

describe('saves', () => {
  it('round-trips a mid-game snapshot exactly, including party and missions', () => {
    const sim = newSim(7);
    at(sim, 'Vesper Courier Co-op');
    interact(sim);
    for (let i = 0; i < 300; i++) sim.step(NO_INPUT);
    const restored = Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot())));
    for (let i = 0; i < 300; i++) {
      sim.step(NO_INPUT);
      restored.step(NO_INPUT);
    }
    expect(JSON.stringify(restored.snapshot())).toBe(JSON.stringify(sim.snapshot()));
  });

  it('migrates a Milestone 1 (v1) snapshot', () => {
    const v2 = newSim(8).snapshot();
    const v1: Record<string, unknown> = { ...v2, version: 1 };
    for (const k of ['wildlings', 'battle', 'progression', 'pendingEffects', 'encounterCooldownUntilTick', 'nextEntityId']) delete v1[k];
    v1.npcs = v2.npcs.map(({ present: _p, stationary: _s, ...rest }) => rest);
    const sim = Simulation.fromSnapshot(v1);
    expect(sim.progression.money).toBe(100);
    expect(sim.npcs.length).toBeGreaterThan(10); // the world is rebuilt around the player
    sim.step(NO_INPUT);
  });

  it('rejects snapshots from the future and garbage', () => {
    expect(() => Simulation.fromSnapshot({ version: 99 })).toThrow(/newer/);
    expect(() => Simulation.fromSnapshot('nope')).toThrow();
  });
});

describe('shops and clinic', () => {
  it('buys items with money and heals at the clinic', () => {
    const sim = newSim(9);
    const shop = sim.layout.buildings.find((b) => b.service?.kind === 'shop' && b.name === 'Paper Moon Pawn')!;
    expect(shop).toBeDefined();
    at(sim, 'Paper Moon Pawn');
    const ev = interact(sim);
    expect(ev).toContainEqual({ type: 'shop.opened', shopId: 'paper-moon' });
    const price = sim.shopPrice('paper-moon', 'tin-snare');
    expect(price).toBeGreaterThan(40);
    expect(price).toBeLessThan(90);
    sim.enqueue({ type: 'shop.buy', shopId: 'paper-moon', itemId: 'tin-snare', qty: 1 });
    sim.step(NO_INPUT);
    expect(sim.progression.inventory['tin-snare']).toBe(1);
    expect(sim.progression.money).toBe(100 - price);
    sim.enqueue({ type: 'shop.buy', shopId: 'paper-moon', itemId: 'coil-snare', qty: 1 });
    sim.step(NO_INPUT);
    expect(sim.progression.inventory['coil-snare']).toBeUndefined();
  });
});
