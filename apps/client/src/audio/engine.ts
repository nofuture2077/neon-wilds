import { MOODS, type MoodId, composeBar } from './composer';
import { SynthRack } from './synth';
import { sfx } from './sfx';

const LOOKAHEAD_SECONDS = 0.12;
const TICK_MS = 25;

/**
 * Bar-by-bar scheduler for the procedural soundtrack. Mood changes are
 * quantised to the next bar so transitions stay on the beat.
 */
export class MusicEngine {
  private ctx: AudioContext | null = null;
  private rack: SynthRack | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private mood: MoodId = 'title';
  private pendingMood: MoodId | null = null;
  private bar = 0;
  private step = 0;
  private nextTime = 0;
  private volume = 0.6;
  private ducked = false;
  private readonly seed: number;

  constructor(seed = (Date.now() / 86_400_000) | 0) {
    // One "sound of the day": the seed changes daily, so sessions feel fresh but coherent.
    this.seed = seed;
  }

  get started(): boolean {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    sfx.attach(this.ctx);
    this.rack = new SynthRack(this.ctx, this.stepSeconds());
    this.applyVolume();
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.ctx?.close();
    this.ctx = null;
    this.rack = null;
  }

  setMood(mood: MoodId): void {
    if (mood !== this.mood && mood !== this.pendingMood) this.pendingMood = mood;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyVolume();
  }

  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyVolume();
  }

  private applyVolume(): void {
    if (!this.ctx || !this.rack) return;
    const target = this.volume * (this.ducked ? 0.35 : 1) * 0.8;
    this.rack.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
  }

  private stepSeconds(): number {
    return 60 / MOODS[this.mood].bpm / 4;
  }

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  };

  private schedule(): void {
    const ctx = this.ctx;
    const rack = this.rack;
    if (!ctx || !rack || ctx.state !== 'running') return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      if (this.step === 0) {
        if (this.pendingMood) {
          this.mood = this.pendingMood;
          this.pendingMood = null;
          this.bar = 0;
          rack.setTempo(this.stepSeconds());
        }
        this.currentBar = composeBar(MOODS[this.mood], this.bar, this.seed);
      }
      const stepSec = this.stepSeconds();
      for (const e of this.currentBar) if (e.step === this.step) rack.play(e, this.nextTime, stepSec);
      this.nextTime += stepSec;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar++;
    }
  }

  private currentBar: ReturnType<typeof composeBar> = [];
}

export const music = new MusicEngine();
