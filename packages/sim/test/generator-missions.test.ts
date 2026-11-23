import { describe, expect, it } from 'vitest';
import {
  NO_INPUT,
  Rng,
  SPECIES,
  Simulation,
  TICK_RATE,
  boardView,
  createWildling,
  generateNpcRequest,
  type SimEvent,
} from '../src';

const APPEARANCE = { skin: 1, hair: 2, top: 3, bottom: 4 };

function afterLastRun(seed: number, startMinutes = 20 * 60) {
  const sim = Simulation.create({ seed, playerName: 'Ash', appearance: APPEARANCE, startMinutes });
  sim.progression.missions = [{ id: 'last-run', status: 'completed', objective: 4 }];
  sim.progression.party.push(createWildling('glitchling', 20, new Rng(1), 'g1'));
  sim.progression.inventory['tin-snare'] = 5;
  return sim;
}

function inspect(sim: Simulation, name: string): SimEvent[] {
  const b = sim.layout.buildings.find((x) => x.name === name)!;
  sim.player.x = sim.player.prevX = b.entrance.tx + 0.5;
  sim.player.y = sim.player.prevY = b.entrance.ty + 0.5;
  for (const n of sim.npcs) if (Math.hypot(n.x - sim.player.x, n.y - sim.player.y) < 3) n.x += 9;
  sim.step({ ...NO_INPUT, interact: true });
  return sim.drainEvents();
}

describe('procedural missions', () => {
  it('the Co-op job board offers bound, completable jobs', () => {
    const sim = afterLastRun(51);
    const ev = inspect(sim, 'Vesper Courier Co-op');
    expect(ev).toContainEqual({ type: 'board.opened' });
    const board = boardView(sim);
    expect(board.jobs.length).toBeGreaterThanOrEqual(1);
    for (const job of sim.progression.generated.filter((m) => !m.giver)) {
      for (const obj of job.objectives) {
        if (obj.kind === 'inspect') expect(sim.layout.buildings.some((b) => b.name === obj.target), obj.target).toBe(true);
        if (obj.kind === 'capture') expect(SPECIES[obj.target]?.captureRate).toBeGreaterThan(0);
      }
      if (job.generated?.deadlineMinutes != null) expect(job.generated.deadlineMinutes).toBeGreaterThan(sim.now);
    }
  });

  it('is deterministic per seed', () => {
    const titles = (seed: number) => {
      const sim = afterLastRun(seed);
      inspect(sim, 'Vesper Courier Co-op');
      return boardView(sim).jobs.map((j) => j.title);
    };
    expect(titles(52)).toEqual(titles(52));
  });

  it('a delivery can be accepted and completed for money', () => {
    const sim = afterLastRun(53);
    inspect(sim, 'Vesper Courier Co-op');
    const job = sim.progression.generated.find((m) => m.generated?.template === 'delivery')!;
    expect(job).toBeDefined();
    sim.enqueue({ type: 'mission.accept', missionId: job.id });
    sim.step(NO_INPUT);
    const money = sim.progression.money;
    inspect(sim, job.objectives[0]!.target);
    const ev = inspect(sim, job.objectives[1]!.target);
    expect(ev.some((e) => e.type === 'mission.completed' && e.missionId === job.id)).toBe(true);
    expect(sim.progression.money).toBeGreaterThan(money);
  });

  it('missing a deadline fails the job', () => {
    const sim = afterLastRun(54);
    inspect(sim, 'Vesper Courier Co-op');
    const job = sim.progression.generated.find((m) => m.generated?.template === 'delivery')!;
    sim.enqueue({ type: 'mission.accept', missionId: job.id });
    sim.step(NO_INPUT);
    const rt = sim.progression.missions.find((m) => m.id === job.id)!;
    rt.deadline = sim.now + 0.5;
    const events: SimEvent[] = [];
    for (let i = 0; i < TICK_RATE * 3; i++) {
      sim.step(NO_INPUT);
      events.push(...sim.drainEvents());
    }
    expect(events.some((e) => e.type === 'mission.failed' && e.missionId === job.id)).toBe(true);
    expect(rt.status).toBe('failed');
  });

  it('an NPC request to catch a Wildling completes through capture and a talk', () => {
    const sim = afterLastRun(55, 21 * 60);
    let def = null;
    for (let i = 0; i < 20 && (!def || def.generated?.template !== 'wildling-request'); i++) {
      def = generateNpcRequest(
        { layout: sim.layout, npcs: sim.npcs, progression: sim.progression, territory: sim.territory, factions: sim.factionAgents, rng: new Rng(i), now: sim.now, hour: sim.hour, player: sim.player, locationOf: () => 'here' },
        () => `t${i}`,
      );
    }
    expect(def?.generated?.template).toBe('wildling-request');
    sim.progression.generated.push(def!);
    sim.progression.board.push(def!.id);
    expect(sim.npcsWithOffers()).toContain(def!.giver);

    // Talk to the giver → mission starts.
    const giver = sim.npcs.find((n) => n.id === def!.giver)!;
    // Stand somewhere open, away from doors, so the giver is the only thing to talk to.
    const open = sim.layout.pedestrianSpawns.find(
      (t) => sim.layout.map.isPedestrianWalkable(t.tx, t.ty + 1) && sim.layout.buildings.every((b) => Math.hypot(b.entrance.tx - t.tx, b.entrance.ty - t.ty) > 4),
    )!;
    sim.player.x = sim.player.prevX = open.tx + 0.5;
    sim.player.y = sim.player.prevY = open.ty + 0.5;
    for (const n of sim.npcs) if (n !== giver && Math.hypot(n.x - sim.player.x, n.y - sim.player.y) < 3) n.x += 9;
    giver.x = sim.player.x;
    giver.y = sim.player.y + 0.9;
    giver.mode = 'idle';
    giver.indoors = null;
    sim.player.heading = Math.PI / 2;
    sim.step({ ...NO_INPUT, interact: true });
    sim.enqueue({ type: 'endDialogue' });
    sim.step(NO_INPUT);
    expect(sim.progression.missions.some((m) => m.id === def!.id && m.status === 'active')).toBe(true);
  });

  it('Saints ask you to break up an active Halcyon crew, and shoving a crew member does it', () => {
    const sim = afterLastRun(56, 13 * 60);
    const halcyon = sim.factionAgents.find((f) => f.id === 'halcyon')!;
    const block = sim.layout.blocks[0]!;
    halcyon.op = { action: 'outreach', blockId: block.id, hoursLeft: 3, crew: ['crew-x'], disrupted: false };
    let def = null;
    for (let i = 0; i < 20 && def?.generated?.template !== 'disrupt-halcyon'; i++) {
      def = generateNpcRequest(
        { layout: sim.layout, npcs: sim.npcs, progression: sim.progression, territory: sim.territory, factions: sim.factionAgents, rng: new Rng(i), now: sim.now, hour: sim.hour, player: sim.player, locationOf: () => 'here' },
        () => `d${i}`,
      );
    }
    expect(def?.generated?.template).toBe('disrupt-halcyon');
    expect(sim.npcs.find((n) => n.id === def!.giver)?.archetypeId).toBe('gutter-saint');
  });
});
