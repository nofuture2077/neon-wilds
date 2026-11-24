import { describe, expect, it } from 'vitest';
import { SfxEngine, type SfxId } from './sfx';

/** Just enough of the Web Audio API to run the synth code paths. */
function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), type: '', buffer: null });
  let created = 0;
  const ctx = {
    currentTime: 1,
    sampleRate: 8000,
    state: 'running',
    destination: node(),
    createGain: () => (created++, node()),
    createOscillator: () => (created++, node()),
    createBiquadFilter: () => (created++, node()),
    createBufferSource: () => (created++, node()),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return { ctx: ctx as unknown as AudioContext, created: () => created, tick: (t: number) => (ctx.currentTime = t) };
}

const ALL: SfxId[] = ['ui-move', 'ui-confirm', 'ui-back', 'talk', 'tip', 'hit', 'hit-super', 'miss', 'faint', 'throw', 'shake', 'capture', 'levelup', 'evolve', 'coin', 'achievement', 'mission', 'door', 'crash', 'horn', 'siren', 'explosion', 'shove'];

describe('procedural sound effects', () => {
  it('synthesises every effect, cries and the engine hum without errors', () => {
    const f = fakeContext();
    const sfx = new SfxEngine();
    sfx.attach(f.ctx);
    let t = 1;
    for (const id of ALL) {
      f.tick((t += 1));
      sfx.play(id);
    }
    sfx.cry('fizzlet');
    sfx.setEngine(6);
    sfx.setEngine(null);
    expect(f.created()).toBeGreaterThan(ALL.length);
  });

  it('stays silent at zero volume and before audio is unlocked', () => {
    const f = fakeContext();
    const sfx = new SfxEngine();
    sfx.play('hit');
    sfx.attach(f.ctx);
    const before = f.created();
    sfx.setVolume(0);
    sfx.play('hit');
    expect(f.created()).toBe(before);
  });
});
