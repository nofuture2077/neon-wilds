import { describe, expect, it } from 'vitest';
import { NO_INPUT, Rng, Simulation, createWildling, type SimEvent } from '../src';

const APPEARANCE = { skin: 1, hair: 2, top: 3, bottom: 4 };

class Player {
  readonly log: SimEvent[] = [];
  constructor(readonly sim: Simulation) {}

  step(n = 1, input = NO_INPUT) {
    for (let i = 0; i < n; i++) {
      this.sim.step(input);
      this.log.push(...this.sim.drainEvents());
    }
  }

  clearArea(keep?: string) {
    const p = this.sim.player;
    for (const n of this.sim.npcs) if (n.id !== keep && !n.stationary && Math.hypot(n.x - p.x, n.y - p.y) < 3) n.x += 9;
    for (const w of this.sim.wildlings) w.calmUntilTick = this.sim.tick + 600;
  }

  inspect(name: string) {
    const b = this.sim.layout.buildings.find((x) => x.name === name);
    if (!b) throw new Error(`no building ${name} in ${this.sim.districtId}`);
    this.sim.player.x = this.sim.player.prevX = b.entrance.tx + 0.5;
    this.sim.player.y = this.sim.player.prevY = b.entrance.ty + 0.5;
    this.clearArea();
    this.step(1, { ...NO_INPUT, interact: true });
    this.closeDialogue();
  }

  talk(npcId: string) {
    const npc = this.sim.npcs.find((n) => n.id === npcId);
    if (!npc) throw new Error(`no npc ${npcId} in ${this.sim.districtId}`);
    npc.indoors = null;
    npc.present = true;
    if (npc.mode !== 'stationary') {
      npc.mode = 'idle';
      npc.path = [];
    }
    this.sim.player.x = this.sim.player.prevX = npc.x;
    this.sim.player.y = this.sim.player.prevY = npc.y - 0.9;
    this.sim.player.heading = Math.PI / 2;
    this.clearArea(npcId);
    this.step(1, { ...NO_INPUT, interact: true });
    this.closeDialogue();
  }

  closeDialogue() {
    this.sim.enqueue({ type: 'endDialogue' });
    this.step(2);
  }

  choose(optionId: string) {
    expect(this.sim.pendingChoice?.options.map((o) => o.id)).toContain(optionId);
    this.sim.enqueue({ type: 'dialogue.choose', optionId });
    this.closeDialogue();
  }

  winBattle() {
    for (let i = 0; i < 80 && this.sim.battle; i++) {
      const b = this.sim.battle;
      const action =
        b.phase === 'force-switch'
          ? { kind: 'switch' as const, partyIndex: this.sim.progression.party.findIndex((w) => w.hp > 0) }
          : { kind: 'skill' as const, index: 0 };
      this.sim.enqueue({ type: 'battle.action', action });
      this.step(1);
    }
    expect(this.sim.battle).toBeNull();
    this.closeDialogue();
  }

  resolveQuestWildling(tag: string) {
    const w = this.sim.wildlings.find((x) => x.questTag === tag);
    if (!w) throw new Error(`no quest wildling ${tag}`);
    w.calmUntilTick = 0;
    this.sim.player.x = this.sim.player.prevX = w.x;
    this.sim.player.y = this.sim.player.prevY = w.y;
    (this.sim as unknown as { encounterCooldownUntilTick: number }).encounterCooldownUntilTick = 0;
    this.step(1);
    this.winBattle();
  }

  status(id: string) {
    return this.sim.progression.missions.find((m) => m.id === id)?.status;
  }
}

function boost(sim: Simulation) {
  sim.progression.party.push(createWildling('gearhound', 40, new Rng(9), 'ace'));
  sim.applyEffect({ type: 'set-flag', flag: 'test' });
}

function playActOne(pl: Player, decision: 'saints' | 'sell') {
  const sim = pl.sim;
  pl.step(2);
  pl.inspect('Vesper Courier Co-op');
  pl.inspect('Halcyon Outreach Kiosk');
  boost(sim);
  pl.talk('npc-aegis');
  pl.winBattle();
  pl.inspect('Saint Ottilie Free Clinic');
  expect(pl.status('last-run')).toBe('completed');

  pl.talk('npc-bram'); // offers The Hum
  expect(pl.status('the-hum')).toBe('active');
  pl.inspect("Kasimir's Cables & Coils");
  expect(sim.world.event?.id).toBe('blackout');
  pl.resolveQuestWildling('frenzy');
  pl.talk('npc-bram');
  expect(pl.status('the-hum')).toBe('completed');

  expect(pl.status('everyone-wants-it')).toBe('active');
  pl.talk('npc-rook');
  pl.choose(decision);
  expect(pl.status('everyone-wants-it')).toBe('completed');
}

describe('main story', () => {
  it('Saints path: Act I → both Act II arcs → Ashgrave → The Chorus', () => {
    const sim = Simulation.create({ seed: 77, playerName: 'Nova', appearance: APPEARANCE, startMinutes: 20 * 60 });
    const pl = new Player(sim);
    playActOne(pl, 'saints');
    expect(sim.progression.flags['act1-saints']).toBe(true);

    // Saints arc.
    pl.talk('npc-dez');
    expect(pl.status('tethered')).toBe('active');
    pl.talk('npc-handler');
    pl.winBattle();
    pl.talk('npc-rook');
    expect(pl.status('tethered')).toBe('completed');
    expect(sim.progression.inventory['hush-fragment']).toBe(1);

    // Halcyon insider, Downtown.
    sim.travelTo('downtown', 'Lantern Parade');
    pl.step(2);
    pl.talk('npc-wren');
    pl.choose('ally');
    expect(sim.progression.inventory['hush-fragment']).toBe(2);

    // Finale.
    pl.step(2);
    expect(pl.status('the-quiet')).toBe('active');
    pl.talk('npc-ashgrave');
    pl.winBattle();
    pl.talk('npc-ashgrave');
    expect(sim.pendingChoice?.options.map((o) => o.id)).toEqual(expect.arrayContaining(['chorus', 'lights-out', 'the-quiet']));
    pl.choose('chorus');
    const ending = pl.log.find((e) => e.type === 'game.ending');
    expect(ending).toMatchObject({ type: 'game.ending', ending: 'chorus', title: 'The Chorus' });
    if (ending?.type === 'game.ending') expect(ending.slides.length).toBeGreaterThan(4);
    expect(pl.status('the-quiet')).toBe('completed');
  }, 30000);

  it('selling the Glitchling closes the Chorus ending but still reaches an ending', () => {
    const sim = Simulation.create({ seed: 78, playerName: 'Nova', appearance: APPEARANCE, startMinutes: 20 * 60 });
    const pl = new Player(sim);
    playActOne(pl, 'sell');
    expect(sim.progression.party.some((w) => w.speciesId === 'glitchling')).toBe(false);
    expect(sim.progression.party.some((w) => w.speciesId === 'scrapup')).toBe(true);

    // The Saints arc is closed; Halcyon offers its own job instead.
    pl.talk('npc-dez');
    expect(pl.status('tethered')).toBeUndefined();
    sim.travelTo('downtown', 'Lantern Parade');
    pl.step(2);
    pl.talk('npc-dt-guard1');
    expect(pl.status('loyal-employee')).toBe('active');
    pl.talk('npc-wren');
    pl.choose('report');
    sim.travelTo('slums', 'Lantern Parade');
    pl.step(2);
    pl.talk('npc-dez');
    expect(sim.progression.inventory['hush-fragment']).toBe(2);

    sim.travelTo('downtown', 'Lantern Parade');
    pl.step(2);
    pl.talk('npc-ashgrave');
    pl.winBattle();
    pl.talk('npc-ashgrave');
    const ids = sim.pendingChoice?.options.map((o) => o.id) ?? [];
    expect(ids).not.toContain('chorus');
    expect(ids).toContain('vargas-city');
    pl.choose('vargas-city');
    expect(pl.log.some((e) => e.type === 'game.ending' && e.ending === 'vargas-city')).toBe(true);
  }, 30000);
});
