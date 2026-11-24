import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, getSettings, hpColour, keyLabel, keysFor, rebind, updateSettings } from './settings';

describe('settings', () => {
  beforeEach(() => updateSettings({ bindings: { ...DEFAULT_BINDINGS }, colourBlind: false }));

  it('rebinds an action and swaps a clashing key onto the other action', () => {
    rebind('interact', 'KeyF');
    expect(getSettings().bindings.interact).toBe('KeyF');
    expect(getSettings().bindings.vehicle).toBe('KeyE');
    expect(keysFor('interact')).toEqual(['KeyF', 'Space', 'Enter', 'NumpadEnter']);
  });

  it('labels keys for prompts', () => {
    expect(keyLabel('KeyQ')).toBe('Q');
    expect(keyLabel('ShiftLeft')).toBe('Shift');
    expect(keyLabel('ArrowUp')).toBe('↑');
  });

  it('swaps red and green for the colour-blind palette', () => {
    expect(hpColour(0.9)).toBe('#4fffb0');
    updateSettings({ colourBlind: true });
    expect(hpColour(0.9)).not.toBe('#4fffb0');
    expect(hpColour(0.1)).toBe('#ff8a00');
  });
});
