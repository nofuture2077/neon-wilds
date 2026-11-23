import { Rng, deriveSeed } from '@neon-wilds/sim';

/**
 * Algorithmic synthwave composer (docs/AUDIO.md). Pure and seeded: given a
 * mood and a bar index it returns the notes for that bar. Rule tables —
 * progressions, arpeggio shapes, drum grids — are handwritten; randomness
 * only chooses between them. No generative AI.
 */
export type Instrument = 'pad' | 'bass' | 'arp' | 'lead' | 'kick' | 'snare' | 'hat' | 'openhat';
export type MoodId = 'title' | 'slums-night' | 'slums-day' | 'battle' | 'chase';

export interface NoteEvent {
  /** 16th-note step within the bar (0..15). */
  step: number;
  inst: Instrument;
  /** MIDI notes (pad chords) or a single note. */
  notes: number[];
  /** Length in 16th steps. */
  dur: number;
  velocity: number;
}

export interface Mood {
  id: MoodId;
  bpm: number;
  /** MIDI root note of the key (e.g. 57 = A3). */
  root: number;
  scale: readonly number[];
  /** 0 = ambient, 1 = groove, 2 = driving. */
  energy: 0 | 1 | 2;
  progressions: readonly (readonly number[])[];
  lead: boolean;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10] as const;
const DORIAN = [0, 2, 3, 5, 7, 9, 10] as const;
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10] as const;

/** Scale-degree chord roots per bar (i–VI–III–VII, i–iv–VI–v, ...). */
const MINOR_PROGRESSIONS = [
  [0, 5, 2, 6],
  [0, 3, 5, 4],
  [0, 5, 3, 4],
  [0, 6, 5, 6],
  [5, 6, 0, 0],
  [0, 2, 5, 6],
] as const;

export const MOODS: Record<MoodId, Mood> = {
  title: { id: 'title', bpm: 92, root: 57, scale: MINOR, energy: 1, progressions: MINOR_PROGRESSIONS, lead: true },
  'slums-night': { id: 'slums-night', bpm: 86, root: 57, scale: MINOR, energy: 1, progressions: MINOR_PROGRESSIONS, lead: false },
  'slums-day': { id: 'slums-day', bpm: 96, root: 62, scale: DORIAN, energy: 1, progressions: [[0, 3, 0, 4], [0, 6, 3, 4], [0, 2, 3, 4]], lead: false },
  battle: { id: 'battle', bpm: 128, root: 57, scale: MINOR, energy: 2, progressions: MINOR_PROGRESSIONS, lead: true },
  chase: { id: 'chase', bpm: 136, root: 52, scale: PHRYGIAN, energy: 2, progressions: [[0, 1, 0, 6], [0, 1, 5, 6], [0, 6, 5, 1]], lead: false },
};

/** Main theme (handwritten leitmotif) as scale degrees over 8th notes; null = rest. */
const THEME: readonly (number | null)[] = [4, null, 3, 2, 1, null, 2, 0, 4, 4, 5, 4, 2, null, 0, null];

export function degreeToMidi(mood: Mood, degree: number, octave = 0): number {
  const len = mood.scale.length;
  const o = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return mood.root + mood.scale[idx]! + 12 * (o + octave);
}

/** Triad (optionally with a 7th) built on a scale degree. */
export function chordTones(mood: Mood, degree: number, seventh = false): number[] {
  const tones = [degree, degree + 2, degree + 4];
  if (seventh) tones.push(degree + 6);
  return tones.map((d) => degreeToMidi(mood, d));
}

const PHRASE_BARS = 8;

const progressionCache = new Map<string, number[]>();

/** Which progression a phrase uses: seeded, never the same twice in a row (a seeded walk over the table). */
export function progressionFor(mood: Mood, phrase: number, seed: number): readonly number[] {
  const n = mood.progressions.length;
  const key = `${mood.id}:${seed}`;
  let walk = progressionCache.get(key);
  if (!walk) {
    walk = [new Rng(deriveSeed(seed, `${mood.id}:prog:0`)).int(0, n - 1)];
    progressionCache.set(key, walk);
  }
  while (walk.length <= phrase) {
    const prev = walk[walk.length - 1]!;
    const step = n > 1 ? 1 + new Rng(deriveSeed(seed, `${mood.id}:prog:${walk.length}`)).int(0, n - 2) : 0;
    walk.push((prev + step) % n);
  }
  return mood.progressions[walk[phrase]!]!;
}

export function composeBar(mood: Mood, bar: number, seed: number): NoteEvent[] {
  const rng = new Rng(deriveSeed(seed, `${mood.id}:bar:${bar}`));
  const phrase = Math.floor(bar / PHRASE_BARS);
  const barInPhrase = bar % PHRASE_BARS;
  const progression = progressionFor(mood, phrase, seed);
  const degree = progression[barInPhrase % progression.length]!;
  const chord = chordTones(mood, degree, rng.chance(0.35));
  const events: NoteEvent[] = [];
  const add = (step: number, inst: Instrument, notes: number[], dur: number, velocity = 1) => events.push({ step, inst, notes, dur, velocity });
  // Arrangement: the first bars of a piece and every 4th phrase drop to a breakdown.
  const breakdown = bar < 2 || phrase % 4 === 3;
  const energy = breakdown ? 0 : mood.energy;

  // Pad: one sustained chord per bar.
  add(0, 'pad', chord, 16, 0.8);

  // Bass.
  const root = chord[0]! - 24;
  if (energy === 0) {
    add(0, 'bass', [root], 8, 0.8);
  } else if (energy === 1) {
    for (let s = 0; s < 16; s += 2) add(s, 'bass', [s % 8 === 6 ? root + 12 : root], 2, s % 4 === 0 ? 1 : 0.7);
  } else {
    for (let s = 0; s < 16; s++) add(s, 'bass', [s % 4 === 2 ? root + 12 : root], 1, s % 4 === 0 ? 1 : 0.6);
  }

  // Arpeggio over two octaves; shape chosen per phrase.
  const shapes = [
    [0, 1, 2, 3, 2, 1],
    [0, 2, 1, 3],
    [3, 2, 1, 0],
    [0, 1, 2, 3, 4, 3, 2, 1],
  ];
  const shape = shapes[new Rng(deriveSeed(seed, `${mood.id}:arp:${phrase}`)).int(0, shapes.length - 1)]!;
  const arpNotes = [...chord, ...chord.map((n) => n + 12)];
  const rate = energy === 0 ? 2 : 1;
  for (let s = 0, i = 0; s < 16; s += rate, i++) {
    const n = arpNotes[shape[i % shape.length]! % arpNotes.length]!;
    add(s, 'arp', [n], rate, 0.55 + 0.25 * (s % 4 === 0 ? 1 : 0));
  }

  // Drums.
  if (energy >= 1) {
    const kicks = energy === 2 ? [0, 4, 8, 12] : [0, 8, ...(rng.chance(0.5) ? [10] : [])];
    for (const k of kicks) add(k, 'kick', [], 1);
    for (const s of [4, 12]) add(s, 'snare', [], 1);
    for (let s = 0; s < 16; s += energy === 2 ? 1 : 2) add(s, s % 4 === 2 ? 'openhat' : 'hat', [], 1, s % 2 === 0 ? 0.8 : 0.45);
    if (barInPhrase === PHRASE_BARS - 1) for (const s of [13, 14, 15]) add(s, 'snare', [], 1, 0.6); // fill
  } else if (!breakdown || bar >= 2) {
    add(0, 'kick', [], 1, 0.6);
  }

  // Lead: the handwritten theme, transposed by the chord, on alternate phrases.
  if (mood.lead && !breakdown && phrase % 2 === 1) {
    const half = barInPhrase % 2;
    for (let i = 0; i < 8; i++) {
      const d = THEME[half * 8 + i];
      if (d === null || d === undefined) continue;
      add(i * 2, 'lead', [degreeToMidi(mood, d + (degree % 3 === 0 ? 0 : 2), 1)], 2, 0.7);
    }
  }
  return events;
}
