import type { EventQueue } from '../core/events';
import type { Rng } from '../core/rng';

/**
 * World director (AI.md §7): hourly weather Markov chain and a weighted
 * table of world events with preconditions. Events have durations and
 * effects that other systems read (lighting, factions, spawns, crowds).
 */
export type Weather = 'clear' | 'drizzle' | 'rain' | 'storm';
export type WorldEventId = 'blackout' | 'night-market' | 'recall-drive' | 'saints-procession';

export interface WorldState {
  weather: Weather;
  event: { id: WorldEventId; untilHour: number } | null;
  nextEventHour: number;
}

const WEATHER_NEXT: Record<Weather, Array<[Weather, number]>> = {
  clear: [['clear', 0.75], ['drizzle', 0.15], ['rain', 0.1]],
  drizzle: [['clear', 0.4], ['drizzle', 0.3], ['rain', 0.3]],
  rain: [['drizzle', 0.35], ['rain', 0.5], ['storm', 0.15]],
  storm: [['rain', 0.7], ['storm', 0.3]],
};

interface EventDef {
  id: WorldEventId;
  weight: number;
  hours: number;
  /** Allowed if the current hour is in [from, to) (wrapping). */
  from: number;
  to: number;
  title: string;
  text: string;
}

const EVENTS: EventDef[] = [
  { id: 'blackout', weight: 3, hours: 3, from: 20, to: 4, title: 'Blackout', text: 'The grid dies block by block. The neon goes dark — and something in the drains wakes up.' },
  { id: 'night-market', weight: 4, hours: 4, from: 19, to: 1, title: 'Night market', text: 'Stalls fill the square: grilled skewers, bootleg Snares, a Fizzlet in a jar of lightning.' },
  { id: 'recall-drive', weight: 3, hours: 4, from: 9, to: 18, title: 'Halcyon recall drive', text: 'White vans roll in. "Unlicensed Wildlings will be collected for their safety."' },
  { id: 'saints-procession', weight: 2, hours: 2, from: 17, to: 22, title: 'Saints procession', text: 'Candles and silver halos: the Gutter Saints march for the strays Halcyon took.' },
];

export const WORLD_EVENT_INFO: Record<WorldEventId, { title: string; text: string }> = Object.fromEntries(
  EVENTS.map((e) => [e.id, { title: e.title, text: e.text }]),
) as Record<WorldEventId, { title: string; text: string }>;

export function newWorldState(): WorldState {
  return { weather: 'clear', event: null, nextEventHour: 3 };
}

const inWindow = (h: number, from: number, to: number) => (from <= to ? h >= from && h < to : h >= from || h < to);

export function worldHour(w: WorldState, absHour: number, rng: Rng, events: EventQueue): void {
  // Weather.
  const before = w.weather;
  let r = rng.next();
  for (const [next, p] of WEATHER_NEXT[w.weather]) {
    if ((r -= p) <= 0) {
      w.weather = next;
      break;
    }
  }
  if (w.weather !== before) events.push({ type: 'weather.changed', weather: w.weather });

  // End the running event.
  if (w.event && absHour >= w.event.untilHour) {
    events.push({ type: 'world.event', id: w.event.id, status: 'ended', title: WORLD_EVENT_INFO[w.event.id].title, text: '' });
    w.event = null;
    w.nextEventHour = absHour + rng.int(4, 9);
  }
  // Start a new one.
  if (!w.event && absHour >= w.nextEventHour) {
    const hour = absHour % 24;
    const options = EVENTS.filter((e) => inWindow(hour, e.from, e.to));
    if (options.length) {
      const total = options.reduce((a, e) => a + e.weight, 0);
      let pick = rng.next() * total;
      const def = options.find((e) => (pick -= e.weight) <= 0) ?? options[0]!;
      w.event = { id: def.id, untilHour: absHour + def.hours };
      events.push({ type: 'world.event', id: def.id, status: 'started', title: def.title, text: def.text });
    } else {
      w.nextEventHour = absHour + 1;
    }
  }
}

export function eventActive(w: WorldState, id: WorldEventId): boolean {
  return w.event?.id === id;
}
