import { describe, expect, it } from 'vitest';
import { EventQueue, Rng, newWorldState, worldHour, type SimEvent } from '../src';

describe('world director', () => {
  it('changes weather and runs time-appropriate world events', () => {
    const w = newWorldState();
    const rng = new Rng(3);
    const ev = new EventQueue();
    const weathers = new Set<string>();
    const started: Array<{ id: string; hour: number }> = [];
    for (let h = 0; h < 24 * 10; h++) {
      worldHour(w, h, rng, ev);
      weathers.add(w.weather);
      for (const e of ev.drain() as SimEvent[]) if (e.type === 'world.event' && e.status === 'started') started.push({ id: e.id, hour: h % 24 });
    }
    expect(weathers.size).toBeGreaterThan(2);
    expect(started.length).toBeGreaterThan(5);
    for (const s of started) {
      if (s.id === 'blackout') expect(s.hour >= 20 || s.hour < 4).toBe(true);
      if (s.id === 'recall-drive') expect(s.hour >= 9 && s.hour < 18).toBe(true);
    }
  });
});
