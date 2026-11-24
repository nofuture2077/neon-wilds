import { describe, expect, it } from 'vitest';
import {
  NO_INPUT,
  PLAYER_HALF_EXTENT,
  Simulation,
  TICK_RATE,
  overlapsSolid,
  type PlayerInput,
  type SimEvent,
} from '../src';

const APPEARANCE = { skin: 0xe0ac69, hair: 0x222222, top: 0x00e5ff, bottom: 0x222233 };

function newSim(seed = 1234): Simulation {
  return Simulation.create({ seed, playerName: 'Ash', appearance: APPEARANCE });
}

/** Deterministic pseudo-player: wanders with changing directions and occasional sprints. */
function scriptedInput(tick: number): PlayerInput {
  const phase = Math.floor(tick / 90);
  const angle = (phase * 2.399) % (Math.PI * 2);
  return { moveX: Math.cos(angle), moveY: Math.sin(angle), run: phase % 3 === 0, interact: tick % 200 === 0 };
}

function run(sim: Simulation, ticks: number, input: (t: number) => PlayerInput = scriptedInput): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.step(input(sim.tick));
    if (sim.player.conversationWith) sim.enqueue({ type: 'endDialogue' });
    events.push(...sim.drainEvents());
  }
  return events;
}

describe('Simulation', () => {
  it('is deterministic: same seed + inputs => identical state', () => {
    const a = newSim();
    const b = newSim();
    run(a, TICK_RATE * 30);
    run(b, TICK_RATE * 30);
    expect(JSON.stringify(a.snapshot())).toBe(JSON.stringify(b.snapshot()));
  });

  it('resumes identically from a snapshot', () => {
    const a = newSim();
    run(a, TICK_RATE * 10);
    const b = Simulation.fromSnapshot(JSON.parse(JSON.stringify(a.snapshot())));
    run(a, TICK_RATE * 10);
    run(b, TICK_RATE * 10);
    expect(JSON.stringify(b.snapshot())).toBe(JSON.stringify(a.snapshot()));
  });

  it('never lets the player or NPCs end up inside solid tiles', () => {
    const sim = newSim(77);
    for (let i = 0; i < TICK_RATE * 60; i++) {
      sim.step(scriptedInput(i));
      if (sim.player.conversationWith) sim.enqueue({ type: 'endDialogue' });
      sim.drainEvents();
      expect(overlapsSolid(sim.layout.map, sim.player.x, sim.player.y, PLAYER_HALF_EXTENT - 1e-3)).toBe(false);
      for (const npc of sim.npcs) {
        expect(sim.layout.map.isSolid(Math.floor(npc.x), Math.floor(npc.y)), npc.name).toBe(false);
      }
    }
  });

  it('moves NPCs on their own without player input', () => {
    const sim = newSim();
    const named = sim.npcs.filter((n) => n.present && !n.transient);
    const start = new Map(named.map((n) => [n.id, { x: n.x, y: n.y }]));
    run(sim, TICK_RATE * 20, () => NO_INPUT);
    const moved = named.filter((n) => Math.hypot(n.x - start.get(n.id)!.x, n.y - start.get(n.id)!.y) > 2);
    expect(moved.length).toBeGreaterThan(named.length / 2);
  });

  it('advances the clock and emits hour events', () => {
    const sim = Simulation.create({ seed: 1, playerName: 'A', appearance: APPEARANCE, startMinutes: 59 });
    const events = run(sim, TICK_RATE * 2, () => NO_INPUT);
    expect(events).toContainEqual({ type: 'clock.hour', hour: 1 });
  });

  describe('interactions', () => {
    function placeNpcInFront(sim: Simulation) {
      const npc = sim.npcs[0]!;
      npc.x = sim.player.x;
      npc.y = sim.player.y + 0.9;
      npc.mode = 'idle';
      npc.timer = 100;
      sim.player.heading = Math.PI / 2;
      return npc;
    }

    it('opens and closes a dialogue with a focused NPC', () => {
      const sim = newSim();
      const npc = placeNpcInFront(sim);
      sim.step(NO_INPUT);
      expect(sim.focus).toEqual({ kind: 'npc', id: npc.id, label: npc.name });

      sim.step({ ...NO_INPUT, interact: true });
      const opened = sim.drainEvents().find((e) => e.type === 'dialogue.opened');
      expect(opened).toMatchObject({ npcId: npc.id, speaker: npc.name });
      expect(sim.player.conversationWith).toBe(npc.id);
      expect(npc.mode).toBe('talking');

      // Player cannot walk away mid-conversation.
      const { x, y } = sim.player;
      sim.step({ ...NO_INPUT, moveX: 1 });
      expect(sim.player.x).toBe(x);
      expect(sim.player.y).toBe(y);

      sim.enqueue({ type: 'endDialogue' });
      sim.step(NO_INPUT);
      expect(sim.drainEvents()).toContainEqual({ type: 'dialogue.closed', npcId: npc.id });
      expect(sim.player.conversationWith).toBeNull();
      expect(['idle', 'walking']).toContain(npc.mode); // back to its routine
    });

    it('substitutes the player name into dialogue', () => {
      const sim = newSim();
      const npc = placeNpcInFront(sim);
      npc.archetypeId = 'street-kid';
      const pages: string[] = [];
      for (let i = 0; i < 30; i++) {
        sim.step({ ...NO_INPUT, interact: true });
        for (const e of sim.drainEvents()) if (e.type === 'dialogue.opened') pages.push(...e.pages);
        sim.enqueue({ type: 'endDialogue' });
        sim.step(NO_INPUT);
        npc.x = sim.player.x;
        npc.y = sim.player.y + 0.9;
        npc.timer = 100;
      }
      expect(pages.some((p) => p.includes('{player}'))).toBe(false);
      expect(pages.some((p) => p.includes('Ash'))).toBe(true);
    });

    it('sprinting into an NPC shoves them, they react and remember it', () => {
      const sim = newSim();
      const npc = sim.npcs.find((n) => n.archetypeId === 'night-worker')!; // timid
      // Sprint along whichever direction has open pavement ahead.
      const p = sim.player;
      const [dx, dy] = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).find(([ax, ay]) =>
        [1, 2, 3, 4].every((k) => !sim.layout.map.isSolid(Math.floor(p.x + ax * k), Math.floor(p.y + ay * k))),
      )!;
      npc.x = p.x + dx * 1.2;
      npc.y = p.y + dy * 1.2;
      npc.mode = 'idle';
      npc.timer = 100;

      const events: SimEvent[] = [];
      for (let i = 0; i < 30; i++) {
        sim.step({ moveX: dx, moveY: dy, run: true, interact: false });
        events.push(...sim.drainEvents());
      }
      expect(events).toContainEqual({ type: 'npc.shoved', npcId: npc.id, byPlayer: true });
      expect(events.some((e) => e.type === 'bark' && e.actorId === npc.id)).toBe(true);
      expect(['fleeing', 'confronting']).toContain(npc.mode);
      expect(npc.grudgeUntilTick).toBeGreaterThan(sim.tick);
    });

    it('walking into an NPC does not count as a shove', () => {
      const sim = newSim();
      const npc = sim.npcs[0]!;
      npc.x = sim.player.x + 1.2;
      npc.y = sim.player.y;
      npc.mode = 'idle';
      npc.timer = 100;
      const events = run(sim, 60, () => ({ moveX: 1, moveY: 0, run: false, interact: false }));
      expect(events.some((e) => e.type === 'npc.shoved')).toBe(false);
    });

    it('a shoved NPC uses grudge dialogue afterwards', () => {
      const sim = newSim();
      const npc = placeNpcInFront(sim);
      npc.archetypeId = 'gutter-saint';
      npc.grudgeUntilTick = sim.tick + 10_000;
      sim.step({ ...NO_INPUT, interact: true });
      const opened = sim.drainEvents().find((e) => e.type === 'dialogue.opened');
      const grudgePages = [
        "You've got a lot of nerve, talking to me after that.",
        'Walk away, Ash. Slowly.',
      ];
      expect(opened && opened.type === 'dialogue.opened' && grudgePages.includes(opened.pages[0]!)).toBe(true);
    });

    it('inspecting a building entrance emits its description', () => {
      const sim = newSim();
      const b = sim.layout.buildings.find((x) => !x.service && x.kind === 'residential')!;
      sim.player.x = b.entrance.tx + 0.5;
      sim.player.y = b.entrance.ty + 0.5;
      // keep NPCs out of the way
      for (const n of sim.npcs) {
        n.x = sim.layout.playerSpawn.x;
        n.y = sim.layout.playerSpawn.y;
        n.mode = 'idle';
        n.timer = 100;
      }
      sim.player.heading = Math.atan2(b.door.ty + 0.5 - sim.player.y, b.door.tx + 0.5 - sim.player.x);
      sim.step({ ...NO_INPUT, interact: true });
      expect(sim.drainEvents()).toContainEqual({
        type: 'building.inspected',
        buildingId: b.id,
        name: b.name,
        text: b.description,
      });
    });
  });
});
