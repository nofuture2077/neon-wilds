import { beforeEach, describe, expect, it } from 'vitest';
import type { BattleView } from '@neon-wilds/sim';
import { useGameStore } from './gameStore';

const creature = (uid: string, hp = 20) => ({
  uid,
  name: uid,
  speciesId: 'fizzlet',
  speciesName: 'Fizzlet',
  types: ['spark' as const],
  level: 5,
  hp,
  maxHp: 20,
  status: null,
  xp: 0,
  xpLevelStart: 0,
  xpNextLevel: 10,
  friendship: 70,
  loyalty: 100,
  injuries: 0,
  stats: { hp: 20, attack: 10, defence: 10, focus: 10, resolve: 10, speed: 10 },
  skills: [],
});

const view: BattleView = {
  id: 'b1',
  kind: 'wild',
  trainerName: null,
  terrain: 'street',
  night: true,
  phase: 'choose',
  activeIndex: 0,
  party: [creature('mine')],
  enemy: creature('foe'),
  enemyPartySize: 1,
  enemyRemaining: 1,
  snares: [],
  medicine: [],
};

describe('gameStore dialogue', () => {
  beforeEach(() => useGameStore.setState({ dialogue: null, dialogueQueue: [] }));

  it('pages through and closes, returning the closed dialogue', () => {
    const s = useGameStore.getState();
    s.openDialogue({ source: { kind: 'npc', npcId: 'n1' }, speaker: 'Dez', pages: ['a', 'b'] });
    expect(useGameStore.getState().advanceDialogue()).toBeNull();
    expect(useGameStore.getState().dialogue?.page).toBe(1);
    const closed = useGameStore.getState().advanceDialogue();
    expect(closed?.source).toEqual({ kind: 'npc', npcId: 'n1' });
    expect(useGameStore.getState().dialogue).toBeNull();
  });

  it('queues dialogues opened while another is showing', () => {
    const s = useGameStore.getState();
    s.openDialogue({ source: { kind: 'message' }, speaker: 'A', pages: ['1'] });
    s.openDialogue({ source: { kind: 'message' }, speaker: 'B', pages: ['2'] });
    expect(useGameStore.getState().advanceDialogue()).toBeNull();
    expect(useGameStore.getState().dialogue?.speaker).toBe('B');
    expect(useGameStore.getState().advanceDialogue()?.speaker).toBe('B');
  });

  it('does not re-render when the HUD is unchanged', () => {
    const hud = { district: 'The Slums', location: 'Cinder Row', clock: '18:30', isNight: false, prompt: null, promptKey: 'E', speed: null, vehicleHealth: null, stars: 0, seen: false };
    useGameStore.getState().setHud(hud);
    const ref = useGameStore.getState().hud;
    useGameStore.getState().setHud({ ...hud });
    expect(useGameStore.getState().hud).toBe(ref);
  });
});

describe('gameStore battle playback', () => {
  it('plays log entries message by message, applying HP changes in order, then closes after the end', () => {
    const s = useGameStore.getState();
    s.battleStart('b1', 'A wild Fizzlet appeared!', view);
    expect(useGameStore.getState().battle?.message).toBe('A wild Fizzlet appeared!');
    s.battleAdvance();
    expect(useGameStore.getState().battle?.message).toBeNull();

    s.battleLog(
      [
        { t: 'text', text: 'mine used Static Nip!' },
        { t: 'damage', side: 'enemy', amount: 20, hp: 0, max: 20, effectiveness: 1, crit: false },
        { t: 'text', text: 'foe fainted!' },
        { t: 'end', outcome: 'win' },
      ],
      null,
    );
    expect(useGameStore.getState().battle?.message).toBe('mine used Static Nip!');
    expect(useGameStore.getState().battle?.enemy.hp).toBe(20);
    useGameStore.getState().battleAdvance();
    expect(useGameStore.getState().battle?.enemy.hp).toBe(0);
    expect(useGameStore.getState().battle?.message).toBe('foe fainted!');
    useGameStore.getState().battleAdvance();
    expect(useGameStore.getState().battle?.outcome).toBe('win');
    useGameStore.getState().battleAdvance();
    expect(useGameStore.getState().battle).toBeNull();
  });
});
