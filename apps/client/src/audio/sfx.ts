/**
 * Procedural sound effects: every sound is synthesised on the fly with Web
 * Audio oscillators and filtered noise (no sample files, no generative AI).
 * Shares the music engine's AudioContext, which only exists after a user gesture.
 */
export type SfxId =
  | 'ui-move'
  | 'ui-confirm'
  | 'ui-back'
  | 'talk'
  | 'tip'
  | 'hit'
  | 'hit-super'
  | 'miss'
  | 'faint'
  | 'throw'
  | 'shake'
  | 'capture'
  | 'levelup'
  | 'evolve'
  | 'coin'
  | 'achievement'
  | 'mission'
  | 'door'
  | 'crash'
  | 'horn'
  | 'siren'
  | 'explosion'
  | 'shove';

type Wave = OscillatorType;

export class SfxEngine {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume = 0.7;
  private engine: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  /** Last play time per id, so a burst of identical events doesn't stack into noise. */
  private readonly last = new Map<string, number>();

  attach(ctx: AudioContext): void {
    if (this.ctx === ctx) return;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = this.volume;
    this.out.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 1.5);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x7fffffff) * 2 - 1;
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  play(id: SfxId, pitch = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.out || ctx.state !== 'running' || this.volume <= 0) return;
    const now = ctx.currentTime;
    if (now - (this.last.get(id) ?? -1) < 0.045) return;
    this.last.set(id, now);
    const t = now + 0.005;
    switch (id) {
      case 'ui-move':
        this.tone('square', 880 * pitch, t, 0.03, 0.05);
        break;
      case 'ui-confirm':
        this.tone('square', 660, t, 0.04, 0.06);
        this.tone('square', 990, t + 0.045, 0.06, 0.06);
        break;
      case 'ui-back':
        this.tone('square', 660, t, 0.04, 0.05);
        this.tone('square', 440, t + 0.045, 0.06, 0.05);
        break;
      case 'talk':
        this.tone('triangle', 520 * pitch, t, 0.05, 0.08);
        break;
      case 'tip':
        this.tone('sine', 1046, t, 0.12, 0.08);
        this.tone('sine', 1568, t + 0.08, 0.18, 0.06);
        break;
      case 'hit':
        this.burst(t, 0.12, 1800, 300, 0.35);
        this.tone('square', 140, t, 0.08, 0.12, 70);
        break;
      case 'hit-super':
        this.burst(t, 0.18, 3200, 400, 0.45);
        this.tone('sawtooth', 220, t, 0.14, 0.14, 60);
        break;
      case 'miss':
        this.burst(t, 0.15, 900, 2400, 0.12);
        break;
      case 'faint':
        this.tone('sawtooth', 440, t, 0.5, 0.12, 80);
        break;
      case 'throw':
        this.burst(t, 0.25, 600, 3000, 0.18);
        break;
      case 'shake':
        this.burst(t, 0.05, 2500, 2500, 0.2);
        this.tone('square', 300, t, 0.04, 0.06);
        break;
      case 'capture':
        [523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, t + i * 0.09, 0.12, 0.07));
        break;
      case 'levelup':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, t + i * 0.06, 0.1, 0.09));
        break;
      case 'evolve':
        for (let i = 0; i < 12; i++) this.tone('sine', 400 + i * 90, t + i * 0.07, 0.15, 0.06);
        break;
      case 'coin':
        this.tone('square', 988, t, 0.06, 0.06);
        this.tone('square', 1319, t + 0.06, 0.16, 0.06);
        break;
      case 'achievement':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone('triangle', f, t + i * 0.08, 0.3, 0.07));
        break;
      case 'mission':
        [523, 784, 1046].forEach((f, i) => this.tone('square', f, t + i * 0.1, 0.18, 0.06));
        break;
      case 'door':
        this.burst(t, 0.08, 400, 200, 0.3);
        this.tone('square', 90, t, 0.06, 0.12, 60);
        break;
      case 'crash':
        this.burst(t, 0.35 * pitch, 900, 120, 0.6);
        this.tone('square', 70, t, 0.2, 0.2, 40);
        break;
      case 'horn':
        this.tone('square', 392, t, 0.28, 0.06);
        this.tone('square', 494, t, 0.28, 0.06);
        break;
      case 'siren':
        this.sweep(t, 1.2);
        break;
      case 'explosion':
        this.burst(t, 1.1, 1200, 60, 0.8);
        this.tone('sine', 60, t, 0.8, 0.4, 30);
        break;
      case 'shove':
        this.burst(t, 0.07, 700, 300, 0.25);
        break;
    }
  }

  /** A short cry for a Wildling: pitch and shape derived from its species id. */
  cry(speciesId: string): void {
    const ctx = this.ctx;
    if (!ctx || !this.out || ctx.state !== 'running' || this.volume <= 0) return;
    let h = 0;
    for (let i = 0; i < speciesId.length; i++) h = (h * 31 + speciesId.charCodeAt(i)) >>> 0;
    const base = 220 + (h % 600);
    const wave: Wave = (['square', 'sawtooth', 'triangle'] as const)[h % 3]!;
    const t = ctx.currentTime + 0.01;
    this.tone(wave, base, t, 0.12, 0.08, base * 1.5);
    this.tone(wave, base * 1.25, t + 0.12, 0.18, 0.07, base * 0.8);
  }

  /** Player car engine: a hum that follows speed; null switches it off. */
  setEngine(speed: number | null): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    if (speed === null || this.volume <= 0) {
      if (this.engine) {
        const e = this.engine;
        e.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        setTimeout(() => {
          e.osc.stop();
          e.osc2.stop();
        }, 400);
        this.engine = null;
      }
      return;
    }
    if (!this.engine) {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc2.type = 'square';
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      gain.gain.value = 0;
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.out);
      osc.start();
      osc2.start();
      this.engine = { osc, osc2, gain, filter };
    }
    const s = Math.min(1, Math.abs(speed) / 12);
    const now = ctx.currentTime;
    this.engine.osc.frequency.setTargetAtTime(45 + s * 90, now, 0.1);
    this.engine.osc2.frequency.setTargetAtTime(46.5 + s * 92, now, 0.1);
    this.engine.filter.frequency.setTargetAtTime(350 + s * 900, now, 0.1);
    this.engine.gain.gain.setTargetAtTime(0.05 + s * 0.05, now, 0.1);
  }

  private tone(wave: Wave, freq: number, at: number, dur: number, vol: number, endFreq?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, at);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(this.out!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** Filtered noise with a cutoff sweep: hits, whooshes, crashes. */
  private burst(at: number, dur: number, fromHz: number, toHz: number, vol: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(fromHz, at);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, toHz), at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.out!);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  /** Two-tone Warden siren. */
  private sweep(at: number, dur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    for (let k = 0; k < 4; k++) osc.frequency.setValueAtTime(k % 2 === 0 ? 660 : 880, at + (k * dur) / 4);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.04, at + 0.05);
    g.gain.setValueAtTime(0.04, at + dur - 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(this.out!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }
}

export const sfx = new SfxEngine();
