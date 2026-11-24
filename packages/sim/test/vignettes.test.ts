import { describe, expect, it } from 'vitest';
import { DISTRICTS, NO_INPUT, Simulation, VESPER, VIGNETTES, allArchetypes, generateCity, vignetteActive, vignetteDef } from '../src';

const APPEARANCE = { skin: 1, hair: 2, top: 3, bottom: 4 };

describe('vignettes (WORLD_GEN.md L6)', () => {
  it('are well-formed: unique ids, known archetypes, sensible hours', () => {
    expect(VIGNETTES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(VIGNETTES.map((v) => v.id)).size).toBe(VIGNETTES.length);
    const archetypes = new Set(allArchetypes().map((a) => a.id));
    const regions = new Set(Object.keys(DISTRICTS));
    for (const v of VIGNETTES) {
      for (const e of v.extras ?? []) expect(archetypes.has(e.archetype), `${v.id}: ${e.archetype}`).toBe(true);
      for (const r of v.regions) expect(regions.has(r), `${v.id}: ${r}`).toBe(true);
      expect(v.look.length, v.id).toBeGreaterThan(0);
      expect(v.hours[0]).toBeGreaterThanOrEqual(0);
      expect(v.hours[1]).toBeLessThanOrEqual(24);
    }
  });

  for (const seed of [1, 7, 1337]) {
    it(`places several distinct scenes in every district (seed ${seed})`, () => {
      const city = generateCity(VESPER, seed);
      for (const r of VESPER.regions) {
        const here = city.vignettes.filter((v) => v.region === r.id);
        expect(here.length, r.id).toBeGreaterThanOrEqual(5);
        expect(new Set(here.map((v) => v.def)).size, r.id).toBe(here.length);
      }
      const doors = new Set(city.buildings.map((b) => `${b.entrance.tx},${b.entrance.ty}`));
      for (const v of city.vignettes) {
        expect(city.map.isPedestrianWalkable(v.tx, v.ty), v.id).toBe(true);
        expect(doors.has(`${v.tx},${v.ty}`), v.id).toBe(false);
      }
    });
  }

  it('is deterministic', () => {
    expect(generateCity(VESPER, 5).vignettes).toEqual(generateCity(VESPER, 5).vignettes);
  });

  it('can be looked at, gives its reward once, and brings its extras to life', () => {
    const sim = Simulation.create({ seed: 41, playerName: 'Ash', appearance: APPEARANCE, startMinutes: 12 * 60 });
    const v = sim.layout.vignettes.find((x) => {
      const d = vignetteDef(x.def)!;
      return d.reward && d.extras?.length && vignetteActive(d, 12);
    })!;
    expect(v).toBeTruthy();
    const def = vignetteDef(v.def)!;
    sim.player.x = sim.player.prevX = v.tx + 0.5;
    sim.player.y = sim.player.prevY = v.ty + 0.5;
    for (let i = 0; i < 61; i++) sim.step(NO_INPUT);
    sim.drainEvents();
    expect(sim.npcs.filter((n) => n.id.startsWith(`${v.id}-`))).toHaveLength(def.extras!.length);
    // Stand on the anchor tile and look.
    sim.player.x = sim.player.prevX = v.tx + 0.5;
    sim.player.y = sim.player.prevY = v.ty + 0.5;
    sim.step(NO_INPUT);
    expect(sim.focus?.kind === 'spot' || sim.focus?.kind === 'npc').toBe(true);
    (sim as unknown as { lookAtVignette(id: string): void }).lookAtVignette(v.id);
    const events = sim.drainEvents();
    expect(events.some((e) => e.type === 'message' && e.speaker === def.title)).toBe(true);
    expect(sim.progression.flags[`vig:${v.id}`]).toBe(true);
  });
});
