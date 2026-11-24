import { describe, expect, it } from 'vitest';
import { MURALS, NO_INPUT, Rng, SKILLS, Simulation, createWildling, effectiveness, getSpecies, healFully, type SimEvent } from '../src';

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
    // Battles can start from a conversation: arrive healed, strongest Wildling first.
    const party = this.sim.progression.party;
    for (const w of party) healFully(w, true);
    const ace = party.findIndex((w) => w.uid === 'ace');
    if (ace > 0) party.unshift(...party.splice(ace, 1));
    const npc = this.sim.npcs.find((n) => n.id === npcId);
    if (!npc) throw new Error(`no npc ${npcId} in ${this.sim.districtId}`);
    npc.indoors = null;
    npc.present = true;
    if (npc.mode !== 'stationary') {
      npc.mode = 'idle';
      npc.path = [];
    }
    // Stand next to them, on whichever side makes them (not a nearby door) the focus.
    const p = this.sim.player;
    for (const [dx, dy] of [[0, -0.9], [0, 0.9], [-0.9, 0], [0.9, 0]] as const) {
      p.x = p.prevX = npc.x + dx;
      p.y = p.prevY = npc.y + dy;
      p.heading = Math.atan2(-dy, -dx);
      this.clearArea(npcId);
      this.step(1);
      if (this.sim.focus?.id === npcId) break;
    }
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
    // Story-flow test, not a balance test: patch everyone up like a clinic visit would.
    for (const w of this.sim.progression.party) healFully(w, true);
    for (let i = 0; i < 80 && this.sim.battle; i++) {
      const b = this.sim.battle;
      // Keep the active Wildling topped up so story tests don't hinge on damage rolls.
      const active = this.sim.progression.party[b.player.active];
      if (active && active.hp > 0) healFully(active, false);
      const action =
        b.phase === 'force-switch'
          ? { kind: 'switch' as const, partyIndex: this.sim.progression.party.findIndex((w) => w.hp > 0) }
          : { kind: 'skill' as const, index: this.bestSkill() };
      this.sim.enqueue({ type: 'battle.action', action });
      this.step(1);
    }
    expect(this.sim.battle).toBeNull();
    this.closeDialogue();
  }

  /** Pick the damaging skill with the best power × type effectiveness against the current foe. */
  bestSkill(): number {
    const b = this.sim.battle!;
    const me = this.sim.progression.party[b.player.active]!;
    const foe = getSpecies(b.enemy.party[b.enemy.active]!.speciesId).types;
    let best = 0;
    let bestScore = -1;
    me.skills.forEach((id, i) => {
      const sk = SKILLS[id];
      const score = sk && sk.category !== 'status' ? sk.power * effectiveness(sk.type, foe) * (sk.recoil ? 0.8 : 1) : 0;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    return best;
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

function playActOne(pl: Player, decision: 'saints' | 'sell' | 'independent') {
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

function playCargo(pl: Player, choice: 'leverage' | 'expose') {
  const sim = pl.sim;
  if (sim.districtId !== 'downtown') sim.travelTo('downtown', 'Lantern Parade');
  sim.travelTo('harbor', 'Prism Row');
  pl.step(2);
  expect(sim.districtId).toBe('harbor');
  pl.talk('npc-danso');
  expect(pl.status('cargo')).toBe('active');
  pl.talk('npc-dockwarden');
  pl.winBattle();
  pl.inspect('Container Yard Office');
  pl.talk('npc-danso');
  pl.choose(choice);
  expect(pl.status('cargo')).toBe('completed');
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

    // Compact arc, Harbor.
    playCargo(pl, 'expose');
    expect(sim.progression.inventory['hush-fragment']).toBe(3);
    sim.travelTo('downtown', 'Prism Row');

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
    playCargo(pl, 'leverage');
    expect(sim.progression.inventory['hush-fragment']).toBe(3);

    pl.step(2);
    sim.travelTo('downtown', 'Prism Row');
    pl.step(2);
    pl.talk('npc-ashgrave');
    pl.winBattle();
    pl.talk('npc-ashgrave');
    const ids = sim.pendingChoice?.options.map((o) => o.id) ?? [];
    expect(ids).not.toContain('chorus');
    expect(ids).toContain('the-quiet');
    pl.choose('the-quiet');
    expect(pl.log.some((e) => e.type === 'game.ending' && e.ending === 'the-quiet')).toBe(true);
  }, 30000);
});

describe('Iron Chain arc', () => {
  it('climbs the pit ladder, beats Vik and earns a fragment', () => {
    const sim = Simulation.create({ seed: 79, playerName: 'Nova', appearance: APPEARANCE, startMinutes: 20 * 60 });
    const pl = new Player(sim);
    playActOne(pl, 'independent');
    sim.travelTo('industrial', 'Gutter Lane');
    pl.step(2);
    expect(sim.districtId).toBe('industrial');
    pl.talk('npc-hale');
    expect(pl.status('the-pit')).toBe('active');
    for (const fighter of ['npc-pit1', 'npc-pit2', 'npc-vik2']) {
      pl.talk(fighter);
      pl.winBattle();
      expect(sim.progression.defeatedTrainers).toContain(fighter);
    }
    pl.talk('npc-hale');
    pl.choose('dignity');
    expect(pl.status('the-pit')).toBe('completed');
    expect(sim.progression.flags['pits-freed']).toBe(true);
    expect(sim.progression.inventory['hush-fragment']).toBe(1);
  }, 30000);
});

describe('Verdant Choir arc', () => {
  it('reads the murals, opens the Founders’ Vault, stops Thorn and earns a fragment', () => {
    const sim = Simulation.create({ seed: 83, playerName: 'Nova', appearance: APPEARANCE, startMinutes: 21 * 60 });
    const pl = new Player(sim);
    playActOne(pl, 'independent');
    sim.travelTo('oldtown');
    pl.step(2);
    expect(sim.districtId).toBe('oldtown');
    pl.talk('npc-lark');
    expect(pl.status('founders-vault')).toBe('active');
    for (const mural of ['Bellfounders’ Tower', 'Drowned Arcade', 'Cistern Steps']) pl.inspect(mural);
    pl.talk('npc-thorn-acolyte');
    pl.winBattle();
    pl.inspect('Founders’ Vault');
    expect(sim.progression.inventory['hush-fragment']).toBe(1);
    pl.talk('npc-thorn');
    pl.winBattle();
    expect(sim.progression.defeatedTrainers).toContain('npc-thorn');
    pl.talk('npc-cantor');
    pl.choose('restraint');
    expect(pl.status('founders-vault')).toBe('completed');
    expect(sim.progression.flags['thorn-contained']).toBe(true);
    expect(sim.npcs.find((n) => n.id === 'npc-thorn')?.present ?? false).toBe(false);
  }, 30000);
});

describe('The Hollow (secret ending)', () => {
  it('places all eight founders’ murals, each in a building of the city', () => {
    const sim = Simulation.create({ seed: 84, playerName: 'Nova', appearance: APPEARANCE });
    for (const name of MURALS) {
      const found = sim.layout.buildings.filter((b) => b.name === name);
      expect(found, name).toHaveLength(1);
      expect(found[0]!.mural, name).toBeTruthy();
    }
  });

  it('follows the murals to the Hollow, evolves the Glitchling and unlocks the Hollow ending', () => {
    const sim = Simulation.create({ seed: 85, playerName: 'Nova', appearance: APPEARANCE, startMinutes: 22 * 60 });
    const pl = new Player(sim);
    playActOne(pl, 'independent');
    for (const mural of MURALS) pl.inspect(mural);
    expect(Object.keys(sim.progression.flags).filter((f) => f.startsWith('mural:'))).toHaveLength(8);
    pl.step(2);
    expect(pl.status('the-hollow')).toBe('active');
    pl.inspect('The Hollow Gate');
    pl.resolveQuestWildling('hollowstag');
    pl.choose('sing');
    expect(pl.status('the-hollow')).toBe('completed');
    expect(sim.progression.party.some((w) => w.speciesId === 'resonant')).toBe(true);
    expect(sim.progression.party.some((w) => w.speciesId === 'glitchling')).toBe(false);
    expect(sim.progression.party.find((w) => w.speciesId === 'resonant')!.skills).toContain('harmonic-chord');

    // Act III: with the marsh song learned, the Hollow ending is on the table.
    sim.progression.inventory['hush-fragment'] = 3;
    for (let i = 0; i < 4000 && pl.status('the-quiet') !== 'active'; i++) pl.step(1); // checked on the hour
    expect(pl.status('the-quiet')).toBe('active');
    pl.talk('npc-ashgrave');
    pl.winBattle();
    pl.talk('npc-ashgrave');
    pl.choose('the-hollow');
    expect(pl.log.find((e) => e.type === 'game.ending')).toMatchObject({ ending: 'the-hollow', title: 'The Hollow' });
  }, 30000);
});
