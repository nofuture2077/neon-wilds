# NEON WILDS — Procedural Synthwave Soundtrack

> Owner: Art Director (audio) · Goal added after Milestone 1 · **v1 shipped in M3** (`apps/client/src/audio/`), full system in M7
>
> **The soundtrack is generated live by an algorithmic composer and synthesiser built on the Web Audio API.** It is rule-based, seeded and deterministic, like the rest of the game's procedural systems. **No generative AI or ML models are involved**, and no audio samples are required.

## 1. Goals

- A continuous, never-identical **synthwave / retrowave / darksynth** score that suits Vesper City's neon nights.
- **Reactive:** music follows district, time of day, weather, danger (wanted level), battles and story beats, with seamless transitions.
- **Tiny footprint:** zero audio assets for the music; a few kilobytes of composition rules.
- **Recognisable themes:** handcrafted leitmotifs (main theme, Glitchling theme, each faction's motif) that the generator weaves into procedural material.

## 2. Architecture

```
MusicDirector (game state → musical intent)
   │  intent: { district, mood, energy 0–1, tension 0–1, tempo, key, theme? }
   ▼
Composer (seeded, bar-by-bar, 1–2 bars ahead)
   ├─ Harmony: chord progressions from weighted Markov tables per mood (i–VI–III–VII, i–iv–VI–V …)
   ├─ Bass: pattern grammar (8th-note pulse, octave jumps, syncopated darksynth riffs)
   ├─ Arpeggiator: chord tones × pattern (up, down, up-down, random-walk) × rate (1/16, 1/8 triplet)
   ├─ Lead: motif engine — authored leitmotifs + variations (transpose, invert, rhythm displacement)
   ├─ Drums: pattern banks by energy (four-on-the-floor, half-time, breakbeat fills on phrase ends)
   └─ Form: 8/16-bar phrases; intro → A → B → breakdown → A' sections; layers enter by energy
   ▼
Scheduler (lookahead scheduling on AudioContext time, 100 ms ahead)
   ▼
Synth rack (Web Audio, all synthesised)
   ├─ Pad: 3–5 detuned saw oscillators → low-pass filter (slow LFO) → chorus → long reverb
   ├─ Bass: saw + square sub, filter envelope, slight overdrive
   ├─ Arp: square or pulse with a filter pluck → tempo-synced ping-pong delay
   ├─ Lead: supersaw or FM bell, portamento, vibrato
   ├─ Drums: sine-sweep kick, noise + band-pass snare with gated reverb, hi-hats from filtered noise
   └─ Master: sidechain-style ducking on the kick, tape-saturation waveshaper, compressor, limiter
```

## 3. Mood map

| Context | Key / mode | Tempo | Character |
|---|---|---|---|
| Slums, night | A minor (Aeolian) | 84–92 | Dusty lo-fi synthwave, warm pads, sparse drums |
| Downtown | F♯ minor / Dorian | 110–118 | Glossy, bright arps, gated snares |
| Industrial | D Phrygian | 100–124 | Darksynth, distorted bass, metallic hits |
| Old Town | E minor + harmonic minor colour | 72–80 | Choir-like pads, slow arps, bells |
| Harbor | C minor | 96 | Fog-horn bass drones, wide reverb |
| Outskirts | G Lydian | 70 | Ambient, few drums, open fifths |
| Battle (wild) | District key, +energy | +20 BPM | Driving bass, full drums |
| Battle (trainer / boss) | Leitmotif-based | 128–140 | Lead motif, double-time hats |
| Wanted ★★+ | District key, tension | +10–30 BPM | Pulsing bass, risers, filter sweeps |

Weather and time modulate it: rain adds reverb, a low-pass filter and vinyl noise; dawn brightens the filter; blackouts mute the pads and leave only the bass and heartbeat kicks.

## 4. Determinism and variety

- The seed is `(worldSeed, district, in-game day, section index)`, so a place has a recognisable "sound of today", yet no two days are the same.
- Anti-repetition: the Composer keeps a history of the last 32 bars and penalises repeated chord loops and identical arpeggio cells.
- Transitions are quantised to the next bar or phrase. Crossfades between layers handle energy changes; stingers mark events (capture success, level up, wanted level up).

## 5. Integration

- The client module `apps/client/src/audio/` runs on the main thread scheduler. An AudioWorklet is optional for custom oscillators.
- It reads the simulation and UI state only through the `MusicDirector` (no simulation dependency on audio).
- Settings: master, music and SFX volume; "music intensity" (ambient ↔ full); mute when the tab is hidden.
- Browsers require a user gesture before audio starts; the main menu's first interaction unlocks the AudioContext.

## 6. Delivery plan

| Milestone | Deliverable |
|---|---|
| M3 | v1: synth rack (pad, bass, arp, drums), harmony and arp generators, Slums night and battle moods, volume settings |
| M4 | Mood director (time, weather, wanted level), transitions and stingers |
| M5 | Leitmotifs (main, Glitchling, 5 factions), district palettes for all six districts, story cues |
| M7 | Mixing pass, lead motif variation engine, CPU profiling (< 3% main-thread budget), accessibility (mono, reduced intensity) |

## Sound effects (M7)

`apps/client/src/audio/sfx.ts` synthesises every effect on the fly from oscillators and filtered noise, on the same AudioContext as the music: UI blips (move, confirm), dialogue ticks, battle hits (stronger for critical and super-effective hits), misses, faints, the Snare throw, shakes and capture jingle, level-up and evolution arpeggios, coins, achievement and mission chimes, car doors, crashes scaled by impact, horns, the Warden siren (repeating while wanted), explosions, and a car engine hum that follows speed. Each Wildling has a short cry whose pitch and waveform come from a hash of its species id. `audio/eventSfx.ts` maps simulation events and battle log entries to sounds; a short per-sound cooldown stops bursts from stacking. Volume has its own slider in Options.
