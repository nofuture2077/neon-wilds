import { describe, expect, it } from 'vitest';
import {
  type BattleContext,
  type BattleState,
  Rng,
  ZERO_STAGES,
  captureChance,
  chooseEnemyAction,
  createWildling,
  maxHp,
  resolveTurn,
  type WildlingInstance,
} from '../src';

function setup(
  player: WildlingInstance[],
  enemy: WildlingInstance[],
  kind: 'wild' | 'trainer' = 'wild',
  ai: BattleState['ai'] = 'wild',
  seed = 1,
): BattleContext {
  return {
    rng: new Rng(seed),
    playerParty: player,
    inventory: { 'tin-snare': 5, 'patch-kit': 2 },
    battle: {
      id: 'b',
      kind,
      trainerId: kind === 'trainer' ? 't' : null,
      trainerName: kind === 'trainer' ? 'Vik' : null,
      ai,
      env: { night: true, terrain: 'street' },
      turn: 1,
      phase: 'choose',
      outcome: null,
      player: { active: 0, stages: { ...ZERO_STAGES }, participants: [player[0]!.uid] },
      enemy: { party: enemy, active: 0, stages: { ...ZERO_STAGES }, items: {}, lastSwitchTurn: 0 },
      firstStrike: false,
      fleeAttempts: 0,
      wildEntityId: null,
      questTag: null,
      rewardMoney: 100,
    },
  };
}

const mk = (species: string, level: number, uid: string, seed = 3) => createWildling(species, level, new Rng(seed), uid);

describe('battle engine', () => {
  it('a strong Wildling defeats a weak one and gains XP', () => {
    const ctx = setup([mk('glitchling', 20, 'g')], [mk('fizzlet', 3, 'f')]);
    const xpBefore = ctx.playerParty[0]!.xp;
    let log = resolveTurn(ctx, { kind: 'skill', index: 0 });
    for (let i = 0; i < 10 && ctx.battle.phase !== 'ended'; i++) log = log.concat(resolveTurn(ctx, { kind: 'skill', index: 0 }));
    expect(ctx.battle.outcome).toBe('win');
    expect(log.some((e) => e.t === 'faint' && e.side === 'enemy')).toBe(true);
    expect(ctx.playerParty[0]!.xp).toBeGreaterThan(xpBefore);
  });

  it('applies type effectiveness (Spark crushes Tide)', () => {
    const ctx = setup([mk('fizzlet', 10, 'f')], [mk('puddlefin', 10, 'p')]);
    const log = resolveTurn(ctx, { kind: 'skill', index: ctx.playerParty[0]!.skills.indexOf('static-nip') });
    const hit = log.find((e) => e.t === 'damage' && e.side === 'enemy');
    if (hit && hit.t === 'damage') expect(hit.effectiveness).toBe(2);
  });

  it('rejects illegal actions without consuming the turn', () => {
    const ctx = setup([mk('glitchling', 5, 'g')], [mk('fizzlet', 3, 'f')], 'trainer', 'novice');
    const log = resolveTurn(ctx, { kind: 'capture', itemId: 'tin-snare' });
    expect(log).toEqual([{ t: 'text', text: "You can't snare another trainer's Wildling!" }]);
    expect(ctx.battle.turn).toBe(1);
    expect(ctx.inventory['tin-snare']).toBe(5);
  });

  it('forces a switch when the active Wildling faints and loses when none remain', () => {
    const weak = mk('cracksprout', 2, 'c');
    const ctx = setup([weak, mk('pebblet', 3, 'p2')], [mk('cindertail', 25, 'e')], 'wild', 'wild');
    for (let i = 0; i < 10 && ctx.battle.phase === 'choose'; i++) resolveTurn(ctx, { kind: 'skill', index: 0 });
    expect(ctx.battle.phase).toBe('force-switch');
    expect(weak.injuries).toBe(1);
    resolveTurn(ctx, { kind: 'switch', partyIndex: 1 });
    expect(ctx.battle.player.active).toBe(1);
    for (let i = 0; i < 20 && ctx.battle.phase === 'choose'; i++) resolveTurn(ctx, { kind: 'skill', index: 0 });
    expect(ctx.battle.outcome).toBe('lose');
  });

  it('capture chance rises as HP falls and with status', () => {
    const w = mk('fizzlet', 5, 'f');
    const full = captureChance(w, maxHp(w), { multiplier: 1 });
    w.hp = 1;
    const low = captureChance(w, maxHp(w), { multiplier: 1 });
    w.status = { kind: 'dazed', turns: 2, stacks: 1 };
    const dazed = captureChance(w, maxHp(w), { multiplier: 1 });
    expect(low).toBeGreaterThan(full);
    expect(dazed).toBeGreaterThan(low);
    expect(captureChance(mk('glitchling', 5, 'g'), 10, { multiplier: 3 })).toBe(0);
  });

  it('snaring a weakened wild Wildling eventually succeeds and consumes snares', () => {
    const ctx = setup([mk('glitchling', 30, 'g')], [mk('pebblet', 3, 'p')]);
    ctx.battle.enemy.party[0]!.hp = 1;
    ctx.inventory['tin-snare'] = 20;
    for (let i = 0; i < 20 && ctx.battle.phase === 'choose'; i++) resolveTurn(ctx, { kind: 'capture', itemId: 'tin-snare' });
    expect(ctx.battle.outcome).toBe('captured');
    expect(ctx.inventory['tin-snare']).toBeLessThan(20);
  });

  it('is deterministic for the same seed', () => {
    const run = () => {
      const ctx = setup([mk('fizzlet', 8, 'a')], [mk('binbandit', 8, 'b')], 'wild', 'wild', 42);
      const logs = [];
      for (let i = 0; i < 6 && ctx.battle.phase === 'choose'; i++) logs.push(...resolveTurn(ctx, { kind: 'skill', index: i % 2 }));
      return JSON.stringify(logs);
    };
    expect(run()).toBe(run());
  });
});

describe('battle AI', () => {
  it('prefers a super-effective attack', () => {
    // Enemy Fizzlet (Spark) vs player Puddlefin (Tide): should pick its Spark move over a status move.
    const enemy = mk('fizzlet', 10, 'e');
    enemy.skills = ['static-field', 'static-nip'];
    const ctx = setup([mk('puddlefin', 10, 'p')], [enemy], 'trainer', 'skilled');
    expect(chooseEnemyAction(ctx)).toEqual({ kind: 'skill', index: 1 });
  });

  it('skilled trainers heal when low and switch out of hopeless matchups', () => {
    const lead = mk('cracksprout', 10, 'e1');
    lead.skills = ['vine-snap'];
    const counter = mk('puddlefin', 10, 'e2');
    const ctx = setup([mk('cindertail', 10, 'p')], [lead, counter], 'trainer', 'skilled');
    ctx.battle.turn = 3;
    expect(chooseEnemyAction(ctx)).toEqual({ kind: 'switch', partyIndex: 1 });

    ctx.battle.enemy.items = { 'patch-kit': 1 };
    lead.hp = 2;
    expect(chooseEnemyAction(ctx)).toEqual({ kind: 'item', itemId: 'patch-kit', partyIndex: 0 });
  });
});
