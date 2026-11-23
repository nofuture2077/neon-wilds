import type { Instrument, NoteEvent } from './composer';

const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/**
 * Web Audio synth rack: every sound is synthesised at runtime (no samples).
 * Pads → reverb, arp → tempo-synced delay, drums with a kick-driven pump.
 */
export class SynthRack {
  readonly master: GainNode;
  private readonly padBus: GainNode;
  private readonly reverbSend: GainNode;
  private readonly delay: DelayNode;
  private readonly noise: AudioBuffer;

  constructor(private readonly ctx: AudioContext, stepSeconds: number) {
    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    const shaper = ctx.createWaveShaper();
    shaper.curve = tapeCurve();
    this.master.connect(shaper).connect(comp).connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 2.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.45;
    this.reverbSend.connect(reverb).connect(this.master);

    this.padBus = ctx.createGain();
    this.padBus.gain.value = 0.9;
    this.padBus.connect(this.master);
    this.padBus.connect(this.reverbSend);

    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = stepSeconds * 3; // dotted 8th
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const delayOut = ctx.createGain();
    delayOut.gain.value = 0.35;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(delayOut).connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
  }

  setTempo(stepSeconds: number): void {
    this.delay.delayTime.setTargetAtTime(stepSeconds * 3, this.ctx.currentTime, 0.1);
  }

  play(e: NoteEvent, time: number, stepSeconds: number): void {
    const dur = e.dur * stepSeconds;
    const handlers: Record<Instrument, () => void> = {
      pad: () => e.notes.forEach((n) => this.pad(n, time, dur, e.velocity)),
      bass: () => this.bass(e.notes[0]!, time, dur, e.velocity),
      arp: () => this.arp(e.notes[0]!, time, dur, e.velocity),
      lead: () => this.lead(e.notes[0]!, time, dur, e.velocity),
      kick: () => this.kick(time, e.velocity),
      snare: () => this.snare(time, e.velocity),
      hat: () => this.hat(time, 0.035, e.velocity),
      openhat: () => this.hat(time, 0.16, e.velocity * 0.7),
    };
    handlers[e.inst]();
  }

  private env(gain: GainNode, time: number, attack: number, peak: number, release: number, length: number): void {
    const g = gain.gain;
    g.setValueAtTime(0.0001, time);
    g.linearRampToValueAtTime(peak, time + attack);
    g.setTargetAtTime(0.0001, time + Math.max(attack, length), release / 4);
  }

  private pad(note: number, time: number, dur: number, vel: number): void {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    for (const detune of [-9, 0, 9]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiToHz(note);
      o.detune.value = detune;
      o.connect(filter);
      o.start(time);
      o.stop(time + dur + 2);
    }
    filter.connect(gain).connect(this.padBus);
    this.env(gain, time, 0.5, 0.035 * vel, 1.4, dur);
  }

  private bass(note: number, time: number, dur: number, vel: number): void {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(180, time);
    filter.frequency.linearRampToValueAtTime(900, time + 0.02);
    filter.frequency.setTargetAtTime(200, time + 0.03, 0.08);
    const gain = this.ctx.createGain();
    const saw = this.ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = midiToHz(note);
    const sub = this.ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = midiToHz(note - 12);
    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.5;
    saw.connect(filter);
    sub.connect(subGain).connect(filter);
    filter.connect(gain).connect(this.master);
    this.env(gain, time, 0.005, 0.22 * vel, 0.12, dur * 0.85);
    for (const o of [saw, sub]) {
      o.start(time);
      o.stop(time + dur + 0.4);
    }
  }

  private arp(note: number, time: number, dur: number, vel: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = midiToHz(note);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, time);
    filter.frequency.setTargetAtTime(700, time, 0.06);
    const gain = this.ctx.createGain();
    o.connect(filter).connect(gain);
    gain.connect(this.master);
    gain.connect(this.delay);
    this.env(gain, time, 0.004, 0.05 * vel, 0.12, Math.min(dur, 0.12));
    o.start(time);
    o.stop(time + dur + 0.5);
  }

  private lead(note: number, time: number, dur: number, vel: number): void {
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2600;
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vibGain = this.ctx.createGain();
    vibGain.gain.value = 6;
    vib.connect(vibGain);
    for (const detune of [-6, 6]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiToHz(note);
      o.detune.value = detune;
      vibGain.connect(o.detune);
      o.connect(filter);
      o.start(time);
      o.stop(time + dur + 1);
    }
    vib.start(time);
    vib.stop(time + dur + 1);
    filter.connect(gain);
    gain.connect(this.master);
    gain.connect(this.reverbSend);
    gain.connect(this.delay);
    this.env(gain, time, 0.02, 0.06 * vel, 0.35, dur * 0.9);
  }

  private kick(time: number, vel: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.9 * vel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    o.connect(gain).connect(this.master);
    o.start(time);
    o.stop(time + 0.32);
    // Pump the pads (sidechain-style ducking).
    const g = this.padBus.gain;
    g.setValueAtTime(0.35, time);
    g.setTargetAtTime(0.9, time + 0.02, 0.12);
  }

  private snare(time: number, vel: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1900;
    band.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4 * vel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    src.connect(band).connect(gain);
    gain.connect(this.master);
    gain.connect(this.reverbSend);
    src.start(time);
    src.stop(time + 0.22);
    const tone = this.ctx.createOscillator();
    tone.frequency.value = 185;
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.18 * vel, time);
    tg.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    tone.connect(tg).connect(this.master);
    tone.start(time);
    tone.stop(time + 0.1);
  }

  private hat(time: number, length: number, vel: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12 * vel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + length);
    src.connect(hp).connect(gain).connect(this.master);
    src.start(time, Math.random() * 0.5);
    src.stop(time + length + 0.02);
  }
}

function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 7;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = ((seed / 2147483647) * 2 - 1) * (1 - i / len) ** 3;
    }
  }
  return buf;
}

function tapeCurve(): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4);
  }
  return curve;
}
