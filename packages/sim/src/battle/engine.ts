import { ITEMS } from '../content/items';
import { SKILLS } from '../content/skills';
import { getSpecies } from '../content/wildlings';
import type { Skill, StageStat, WildlingInstance } from '../creatures/model';
import { displayName, gainXp, maxHp } from '../creatures/wildling';
import type { Rng } from '../core/rng';
import { chooseEnemyAction, chooseEnemyReplacement } from './ai';
import {
  STATUS_IMMUNE,
  STATUS_LABEL,
  STATUS_TURNS,
  baseDamage,
  captureChance,
  effectiveStat,
  stageMultiplier,
  xpReward,
} from './formulas';
import { type BattleAction, type BattleLog, type BattleState, type Side, ZERO_STAGES } from './types';

export interface BattleContext {
  battle: BattleState;
  playerParty: WildlingInstance[];
  inventory: Record<string, number>;
  rng: Rng;
}

const STAT_LABEL: Record<StageStat, string> = {
  attack: 'Attack',
  defence: 'Defence',
  focus: 'Focus',
  resolve: 'Resolve',
  speed: 'Speed',
  accuracy: 'accuracy',
};

export function isHealthy(w: WildlingInstance): boolean {
  return w.hp > 0;
}

export function activeOf(ctx: BattleContext, side: Side): WildlingInstance {
  const w = side === 'player' ? ctx.playerParty[ctx.battle.player.active] : ctx.battle.enemy.party[ctx.battle.enemy.active];
  if (!w) throw new Error(`No active Wildling for ${side}`);
  return w;
}

function stagesOf(ctx: BattleContext, side: Side) {
  return side === 'player' ? ctx.battle.player.stages : ctx.battle.enemy.stages;
}

function label(ctx: BattleContext, side: Side): string {
  const name = displayName(activeOf(ctx, side));
  return side === 'player' ? name : ctx.battle.kind === 'wild' ? `The wild ${name}` : `${ctx.battle.trainerName ?? 'The foe'}'s ${name}`;
}

/** Check whether an action is legal right now; returns a reason if not. */
export function validateAction(ctx: BattleContext, action: BattleAction): string | null {
  const b = ctx.battle;
  if (b.phase === 'ended') return 'The battle is over.';
  const active = activeOf(ctx, 'player');
  if (b.phase === 'force-switch' && action.kind !== 'switch') return 'Choose a Wildling to send out.';
  switch (action.kind) {
    case 'skill':
      return active.skills[action.index] ? null : 'No such skill.';
    case 'switch': {
      const target = ctx.playerParty[action.partyIndex];
      if (!target || !isHealthy(target)) return 'That Wildling cannot fight.';
      if (action.partyIndex === b.player.active && b.phase !== 'force-switch') return 'Already in battle.';
      if (b.phase !== 'force-switch' && active.status?.kind === 'rooted') return `${displayName(active)} is rooted in place!`;
      return null;
    }
    case 'item': {
      const def = ITEMS[action.itemId];
      if (!def || def.category !== 'medicine' || (ctx.inventory[action.itemId] ?? 0) <= 0) return 'You have none of those.';
      const target = ctx.playerParty[action.partyIndex];
      if (!target || !isHealthy(target)) return 'It would have no effect.';
      if (def.heal && target.hp >= maxHp(target) && !(def.cures && target.status)) return 'It would have no effect.';
      if (!def.heal && def.cures && !target.status) return 'It would have no effect.';
      return null;
    }
    case 'capture':
      if (b.kind !== 'wild') return "You can't snare another trainer's Wildling!";
      if (ITEMS[action.itemId]?.category !== 'snare' || (ctx.inventory[action.itemId] ?? 0) <= 0) return 'You have no Snares of that kind.';
      return null;
    case 'flee':
      if (b.kind !== 'wild') return "There's no running from a trainer battle!";
      if (active.status?.kind === 'rooted') return `${displayName(active)} is rooted in place!`;
      return null;
  }
}

/** Resolve one player decision (and the enemy's response). Mutates state; returns the narrated log. */
export function resolveTurn(ctx: BattleContext, action: BattleAction): BattleLog[] {
  const log: BattleLog[] = [];
  const b = ctx.battle;
  const invalid = validateAction(ctx, action);
  if (invalid) return [{ t: 'text', text: invalid }];

  if (b.phase === 'force-switch' && action.kind === 'switch') {
    doSwitch(ctx, 'player', action.partyIndex, log);
    b.phase = 'choose';
    return log;
  }

  const enemyAction = chooseEnemyAction(ctx);
  const order = orderActions(ctx, action, enemyAction);
  for (const { side, act } of order) {
    if (b.phase !== 'choose') break;
    if (!isHealthy(activeOf(ctx, side))) continue;
    perform(ctx, side, act, log);
    checkFaints(ctx, log);
  }
  if (b.phase === 'choose') {
    endOfTurn(ctx, log);
    checkFaints(ctx, log);
  }
  b.turn++;
  b.firstStrike = false;
  return log;
}

function orderActions(ctx: BattleContext, player: BattleAction, enemy: BattleAction) {
  const b = ctx.battle;
  const rank = (a: BattleAction) => (a.kind === 'skill' ? (SKILLS[activeSkillId(ctx, a)]?.priority ?? 0) : 10);
  const pr = rank(player);
  const er = rank(enemy);
  let playerFirst: boolean;
  if (b.firstStrike) playerFirst = true;
  else if (pr !== er) playerFirst = pr > er;
  else if (player.kind !== 'skill') playerFirst = true;
  else {
    const ps = effectiveStat(activeOf(ctx, 'player'), b.player.stages, 'speed');
    const es = effectiveStat(activeOf(ctx, 'enemy'), b.enemy.stages, 'speed');
    playerFirst = ps === es ? ctx.rng.chance(0.5) : ps > es;
  }
  const p = { side: 'player' as Side, act: player };
  const e = { side: 'enemy' as Side, act: enemy };
  return playerFirst ? [p, e] : [e, p];
}

function activeSkillId(ctx: BattleContext, a: BattleAction & { kind: 'skill' }): string {
  return activeOf(ctx, 'player').skills[a.index] ?? '';
}

function perform(ctx: BattleContext, side: Side, action: BattleAction, log: BattleLog[]): void {
  switch (action.kind) {
    case 'skill': {
      const user = activeOf(ctx, side);
      const skill = SKILLS[user.skills[action.index] ?? ''];
      if (skill) useSkill(ctx, side, skill, log);
      return;
    }
    case 'switch':
      doSwitch(ctx, side, action.partyIndex, log);
      return;
    case 'item':
      useItem(ctx, side, action.itemId, action.partyIndex, log);
      return;
    case 'capture':
      tryCapture(ctx, action.itemId, log);
      return;
    case 'flee':
      tryFlee(ctx, log);
      return;
  }
}

function doSwitch(ctx: BattleContext, side: Side, index: number, log: BattleLog[]): void {
  const b = ctx.battle;
  if (side === 'player') {
    if (isHealthy(activeOf(ctx, 'player')) && b.phase !== 'force-switch') {
      log.push({ t: 'text', text: `${displayName(activeOf(ctx, 'player'))}, come back!` });
    }
    b.player.active = index;
    b.player.stages = { ...ZERO_STAGES };
    const w = activeOf(ctx, 'player');
    if (!b.player.participants.includes(w.uid)) b.player.participants.push(w.uid);
    log.push({ t: 'switch', side, index });
    log.push({ t: 'text', text: `Go, ${displayName(w)}!` });
  } else {
    b.enemy.active = index;
    b.enemy.stages = { ...ZERO_STAGES };
    b.enemy.lastSwitchTurn = b.turn;
    log.push({ t: 'switch', side, index });
    log.push({ t: 'text', text: `${b.trainerName ?? 'The foe'} sends out ${displayName(activeOf(ctx, 'enemy'))}!` });
  }
}

function useSkill(ctx: BattleContext, side: Side, skill: Skill, log: BattleLog[]): void {
  const b = ctx.battle;
  const foeSide: Side = side === 'player' ? 'enemy' : 'player';
  const user = activeOf(ctx, side);
  const name = label(ctx, side);

  if (user.status?.kind === 'shorted' && ctx.rng.chance(0.25)) {
    log.push({ t: 'text', text: `${name} is shorted out and can't move!` });
    return;
  }
  if (user.status?.kind === 'spooked' && ctx.rng.chance(1 / 3)) {
    const dmg = Math.max(1, Math.floor(maxHp(user) / 8));
    user.hp = Math.max(0, user.hp - dmg);
    log.push({ t: 'text', text: `${name} is spooked and lashes out at nothing!` });
    log.push({ t: 'damage', side, amount: dmg, hp: user.hp, max: maxHp(user), effectiveness: 1, crit: false });
    return;
  }

  log.push({ t: 'text', text: `${name} used ${skill.name}!` });
  log.push({ t: 'use', side, skill: skill.id, type: skill.type });

  const targetSide = skill.target === 'self' ? side : foeSide;
  const target = activeOf(ctx, targetSide);
  if (skill.target === 'foe') {
    const accStage = stageMultiplier(stagesOf(ctx, side).accuracy);
    const acc = skill.accuracy * accStage * (user.status?.kind === 'dazed' ? 0.75 : 1);
    if (ctx.rng.next() * 100 >= acc) {
      log.push({ t: 'miss', side: targetSide });
      log.push({ t: 'text', text: `${name}'s attack missed!` });
      return;
    }
  }

  if (skill.category !== 'status') {
    const { damage, effectiveness: eff } = baseDamage({
      attacker: user,
      attackerStages: stagesOf(ctx, side),
      defender: target,
      defenderStages: stagesOf(ctx, targetSide),
      skill,
      env: b.env,
    });
    const critChance = 1 / 16 + (side === 'player' ? Math.max(0, user.friendship - 150) / 2000 : 0);
    const crit = ctx.rng.chance(critChance);
    const roll = ctx.rng.range(0.85, 1);
    const amount = Math.max(1, Math.floor(damage * roll * (crit ? 1.5 : 1)));
    const dealt = Math.min(target.hp, amount);
    target.hp = Math.max(0, target.hp - amount);
    log.push({ t: 'damage', side: targetSide, amount, hp: target.hp, max: maxHp(target), effectiveness: eff, crit });
    if (crit) log.push({ t: 'text', text: 'A critical hit!' });
    if (eff > 1) log.push({ t: 'text', text: "It's super effective!" });
    else if (eff < 1) log.push({ t: 'text', text: "It's not very effective..." });
    if (skill.recoil && user.hp > 0) {
      // Recoil follows the HP actually knocked off, not overkill.
      const r = Math.max(1, Math.floor(dealt * skill.recoil));
      user.hp = Math.max(0, user.hp - r);
      log.push({ t: 'damage', side, amount: r, hp: user.hp, max: maxHp(user), effectiveness: 1, crit: false });
      log.push({ t: 'text', text: `${name} is hurt by the impact!` });
    }
  }

  if (skill.status && target.hp > 0 && ctx.rng.next() * 100 < skill.status.chance) {
    applyStatus(ctx, targetSide, skill.status.kind, log, skill.category === 'status');
  }
  if (skill.stages && ctx.rng.next() * 100 < skill.stages.chance) {
    const stSide = skill.stages.target === 'self' ? side : foeSide;
    const stages = stagesOf(ctx, stSide);
    const before = stages[skill.stages.stat];
    stages[skill.stages.stat] = Math.max(-6, Math.min(6, before + skill.stages.delta));
    const delta = stages[skill.stages.stat] - before;
    const who = label(ctx, stSide);
    if (delta === 0) log.push({ t: 'text', text: `${who}'s ${STAT_LABEL[skill.stages.stat]} won't go any ${skill.stages.delta > 0 ? 'higher' : 'lower'}!` });
    else {
      log.push({ t: 'stage', side: stSide, stat: skill.stages.stat, delta });
      log.push({ t: 'text', text: `${who}'s ${STAT_LABEL[skill.stages.stat]} ${delta > 0 ? (delta > 1 ? 'rose sharply' : 'rose') : delta < -1 ? 'fell sharply' : 'fell'}!` });
    }
  }
  if (skill.heal) {
    const max = maxHp(user);
    if (user.hp >= max) log.push({ t: 'text', text: `${name}'s HP is already full.` });
    else {
      user.hp = Math.min(max, user.hp + Math.floor(max * skill.heal));
      log.push({ t: 'heal', side, hp: user.hp, max });
      log.push({ t: 'text', text: `${name} recovered HP.` });
    }
  }
}

function applyStatus(ctx: BattleContext, side: Side, kind: NonNullable<WildlingInstance['status']>['kind'], log: BattleLog[], announceFail: boolean) {
  const target = activeOf(ctx, side);
  const immune = STATUS_IMMUNE[kind]?.some((t) => getSpecies(target.speciesId).types.includes(t as never));
  if (target.status || immune) {
    if (announceFail) log.push({ t: 'text', text: 'But it failed!' });
    return;
  }
  target.status = { kind, turns: STATUS_TURNS[kind], stacks: 1 };
  log.push({ t: 'status', side, status: kind });
  log.push({ t: 'text', text: `${label(ctx, side)} is ${STATUS_LABEL[kind]}!` });
}

function useItem(ctx: BattleContext, side: Side, itemId: string, partyIndex: number, log: BattleLog[]) {
  const def = ITEMS[itemId];
  if (!def) return;
  let target: WildlingInstance | undefined;
  if (side === 'player') {
    ctx.inventory[itemId] = (ctx.inventory[itemId] ?? 0) - 1;
    target = ctx.playerParty[partyIndex];
    log.push({ t: 'text', text: `You used a ${def.name}.` });
  } else {
    ctx.battle.enemy.items[itemId] = (ctx.battle.enemy.items[itemId] ?? 0) - 1;
    target = activeOf(ctx, 'enemy');
    log.push({ t: 'text', text: `${ctx.battle.trainerName ?? 'The foe'} used a ${def.name}.` });
  }
  if (!target) return;
  const targetSide: Side | null =
    side === 'enemy' ? 'enemy' : partyIndex === ctx.battle.player.active ? 'player' : null;
  if (def.heal) {
    target.hp = Math.min(maxHp(target), target.hp + def.heal);
    if (targetSide) log.push({ t: 'heal', side: targetSide, hp: target.hp, max: maxHp(target) });
    log.push({ t: 'text', text: `${displayName(target)} recovered HP.` });
  }
  if (def.cures && target.status) {
    target.status = null;
    if (targetSide) log.push({ t: 'status', side: targetSide, status: null });
    log.push({ t: 'text', text: `${displayName(target)} feels better.` });
  }
}

function tryCapture(ctx: BattleContext, itemId: string, log: BattleLog[]) {
  const def = ITEMS[itemId];
  if (!def?.snare) return;
  ctx.inventory[itemId] = (ctx.inventory[itemId] ?? 0) - 1;
  const target = activeOf(ctx, 'enemy');
  log.push({ t: 'text', text: `You threw a ${def.name}!` });
  log.push({ t: 'throw', item: itemId });
  const p = captureChance(target, maxHp(target), def.snare);
  const success = ctx.rng.chance(p);
  const shakes = success ? 3 : ctx.rng.int(0, 2);
  for (let i = 1; i <= shakes; i++) log.push({ t: 'shake', n: i });
  log.push({ t: 'capture', success });
  if (success) {
    log.push({ t: 'text', text: `Gotcha! ${displayName(target)} was snared!` });
    awardXp(ctx, target, log);
    endBattle(ctx, 'captured', log);
  } else {
    log.push({ t: 'text', text: shakes === 0 ? 'It broke free immediately!' : shakes === 1 ? 'Argh! Almost had it!' : 'So close!' });
  }
}

function tryFlee(ctx: BattleContext, log: BattleLog[]) {
  const b = ctx.battle;
  b.fleeAttempts++;
  const ps = effectiveStat(activeOf(ctx, 'player'), b.player.stages, 'speed');
  const es = effectiveStat(activeOf(ctx, 'enemy'), b.enemy.stages, 'speed');
  const chance = Math.max(0.1, Math.min(1, 0.5 + (ps - es) / (2 * es) + 0.15 * (b.fleeAttempts - 1)));
  if (ctx.rng.chance(chance)) {
    log.push({ t: 'text', text: 'You got away safely!' });
    endBattle(ctx, 'fled', log);
  } else {
    log.push({ t: 'text', text: "Couldn't get away!" });
  }
}

function endOfTurn(ctx: BattleContext, log: BattleLog[]) {
  for (const side of ['player', 'enemy'] as const) {
    const w = activeOf(ctx, side);
    if (!w.status || w.hp <= 0) continue;
    const name = label(ctx, side);
    if (w.status.kind === 'scorched' || w.status.kind === 'poisoned') {
      const frac = w.status.kind === 'scorched' ? 1 / 12 : w.status.stacks / 16;
      const dmg = Math.max(1, Math.floor(maxHp(w) * frac));
      w.hp = Math.max(0, w.hp - dmg);
      log.push({ t: 'damage', side, amount: dmg, hp: w.hp, max: maxHp(w), effectiveness: 1, crit: false });
      log.push({ t: 'text', text: `${name} is hurt by ${w.status.kind === 'scorched' ? 'its burns' : 'poison'}!` });
      if (w.status.kind === 'poisoned') w.status.stacks = Math.min(6, w.status.stacks + 1);
    }
    w.status.turns--;
    if (w.status.turns <= 0 && w.hp > 0) {
      w.status = null;
      log.push({ t: 'status', side, status: null });
      log.push({ t: 'text', text: `${name} recovered.` });
    }
  }
}

function checkFaints(ctx: BattleContext, log: BattleLog[]) {
  const b = ctx.battle;
  if (b.phase === 'ended') return;
  const enemy = activeOf(ctx, 'enemy');
  if (enemy.hp <= 0) {
    log.push({ t: 'faint', side: 'enemy' });
    log.push({ t: 'text', text: `${label(ctx, 'enemy')} fainted!` });
    awardXp(ctx, enemy, log);
    const next = chooseEnemyReplacement(ctx);
    if (b.kind === 'trainer' && next !== null) doSwitch(ctx, 'enemy', next, log);
    else {
      if (b.kind === 'trainer') {
        log.push({ t: 'text', text: `You defeated ${b.trainerName}!` });
        if (b.rewardMoney > 0) log.push({ t: 'text', text: `You got ${b.rewardMoney}₵ for winning.` });
      }
      endBattle(ctx, 'win', log);
      return;
    }
  }
  const mine = activeOf(ctx, 'player');
  if (mine.hp <= 0) {
    mine.status = null;
    mine.injuries = Math.min(3, mine.injuries + 1);
    mine.friendship = Math.max(0, mine.friendship - 5);
    log.push({ t: 'faint', side: 'player' });
    log.push({ t: 'text', text: `${displayName(mine)} fainted! It's injured.` });
    if (ctx.playerParty.some(isHealthy)) b.phase = 'force-switch';
    else {
      log.push({ t: 'text', text: 'You have no Wildlings left that can fight...' });
      endBattle(ctx, 'lose', log);
    }
  }
}

function awardXp(ctx: BattleContext, defeated: WildlingInstance, log: BattleLog[]) {
  const b = ctx.battle;
  const earners = ctx.playerParty.filter((w) => isHealthy(w) && b.player.participants.includes(w.uid));
  if (earners.length === 0) return;
  const total = xpReward(defeated, b.kind === 'trainer');
  for (const w of earners) {
    // Catch-up: beating something stronger pays more, up to +80%.
    const amount = Math.max(1, Math.floor((total / earners.length) * (1 + Math.min(0.8, Math.max(0, defeated.level - w.level) * 0.1))));
    log.push({ t: 'xp', uid: w.uid, amount });
    log.push({ t: 'text', text: `${displayName(w)} gained ${amount} XP.` });
    w.friendship = Math.min(255, w.friendship + 1);
    for (const ev of gainXp(w, amount)) {
      switch (ev.kind) {
        case 'levelup':
          log.push({ t: 'levelup', uid: w.uid, level: ev.level });
          log.push({ t: 'text', text: `${displayName(w)} grew to level ${ev.level}!` });
          break;
        case 'learned':
          log.push({ t: 'text', text: `${displayName(w)} learned ${SKILLS[ev.skill]?.name ?? ev.skill}!` });
          break;
        case 'cannot-learn':
          log.push({ t: 'text', text: `${displayName(w)} wants to learn ${SKILLS[ev.skill]?.name ?? ev.skill}, but already knows four skills.` });
          break;
        case 'evolved':
          log.push({ t: 'evolve', uid: w.uid, from: ev.from, to: ev.to });
          log.push({ t: 'text', text: `What? ${getSpecies(ev.from).name} evolved into ${getSpecies(ev.to).name}!` });
          break;
      }
    }
  }
}

function endBattle(ctx: BattleContext, outcome: NonNullable<BattleState['outcome']>, log: BattleLog[]) {
  const b = ctx.battle;
  b.phase = 'ended';
  b.outcome = outcome;
  for (const w of ctx.playerParty) w.status = null;
  log.push({ t: 'end', outcome });
}
