import { describe, expect, it } from 'vitest';
import { MOODS, chordTones, composeBar, degreeToMidi, progressionFor } from './composer';
import { moodFor } from './useMusic';

describe('procedural composer', () => {
  it('builds diatonic chords in the mood key', () => {
    const m = MOODS['slums-night'];
    expect(chordTones(m, 0)).toEqual([57, 60, 64]); // A minor: A C E
    expect(degreeToMidi(m, 7)).toBe(69);
  });

  it('is deterministic for a seed and varies between seeds', () => {
    const m = MOODS.battle;
    expect(composeBar(m, 12, 1)).toEqual(composeBar(m, 12, 1));
    const a = JSON.stringify(Array.from({ length: 32 }, (_, i) => composeBar(m, i, 1)));
    const b = JSON.stringify(Array.from({ length: 32 }, (_, i) => composeBar(m, i, 2)));
    expect(a).not.toBe(b);
  });

  it('never repeats the same progression in consecutive phrases', () => {
    const m = MOODS['slums-night'];
    for (let p = 1; p < 40; p++) expect(progressionFor(m, p, 9)).not.toBe(progressionFor(m, p - 1, 9));
  });

  it('keeps every event inside the bar and in a playable range', () => {
    for (const mood of Object.values(MOODS)) {
      for (let bar = 0; bar < 64; bar++) {
        for (const e of composeBar(mood, bar, 3)) {
          expect(e.step).toBeGreaterThanOrEqual(0);
          expect(e.step).toBeLessThan(16);
          for (const n of e.notes) {
            expect(n).toBeGreaterThan(20);
            expect(n).toBeLessThan(100);
          }
        }
      }
    }
  });

  it('drives harder in battles and chases than in ambient night music', () => {
    const count = (id: keyof typeof MOODS) => composeBar(MOODS[id], 9, 4).filter((e) => e.inst === 'kick' || e.inst === 'hat').length;
    expect(count('battle')).toBeGreaterThan(count('slums-night'));
  });

  it('the director maps game state to moods', () => {
    const hud = { stars: 0, isNight: true };
    expect(moodFor({ screen: 'menu', battle: null, hud })).toBe('title');
    expect(moodFor({ screen: 'game', battle: {}, hud })).toBe('battle');
    expect(moodFor({ screen: 'game', battle: null, hud: { stars: 2, isNight: true } })).toBe('chase');
    expect(moodFor({ screen: 'game', battle: null, hud: { stars: 0, isNight: false } })).toBe('slums-day');
  });
});
