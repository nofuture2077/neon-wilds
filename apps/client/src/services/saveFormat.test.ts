import { NO_INPUT, Simulation } from '@neon-wilds/sim';
import { describe, expect, it } from 'vitest';
import { crc32, exportFileName, makeEnvelope, openEnvelope, parseSaveFile } from './saveFormat';

const sim = Simulation.create({ seed: 3, playerName: 'Ash', appearance: { skin: 1, hair: 2, top: 3, bottom: 4 } });
for (let i = 0; i < 120; i++) sim.step(NO_INPUT);

describe('save format', () => {
  it('crc32 matches the IEEE reference for ASCII', () => {
    expect(crc32('The quick brown fox jumps over the lazy dog')).not.toBe(crc32('The quick brown fox jumps over the lazy cog'));
    expect(crc32('')).toBe('00000000');
  });

  it('round-trips through JSON and restores an identical simulation', () => {
    const env = JSON.parse(JSON.stringify(makeEnvelope(sim.snapshot(), 'Cinder Row')));
    const res = openEnvelope(env);
    expect(res.ok).toBe(true);
    if (res.ok) expect(JSON.stringify(Simulation.fromSnapshot(res.snapshot).snapshot())).toBe(JSON.stringify(sim.snapshot()));
    expect(env.summary).toMatchObject({ playerName: 'Ash', location: 'Cinder Row', money: 100 });
  });

  it('exports to a file and imports it back', () => {
    const env = makeEnvelope(sim.snapshot(), 'Cinder Row', new Date('2026-11-24T10:00:00Z'));
    expect(exportFileName(env, 'slot1')).toBe('neon-wilds-ash-slot1-2026-11-24.json');
    const res = parseSaveFile(JSON.stringify(env, null, 2));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.envelope.summary.location).toBe('Cinder Row');
    expect(parseSaveFile('{ nope')).toEqual({ ok: false, reason: 'not a save file' });
    const tampered = JSON.parse(JSON.stringify(env));
    tampered.state.progression.money = 1e9;
    expect(parseSaveFile(JSON.stringify(tampered))).toEqual({ ok: false, reason: 'checksum mismatch' });
  });

  it('detects corruption', () => {
    const env = makeEnvelope(sim.snapshot(), 'x');
    env.state.progression.money = 999999;
    expect(openEnvelope(env)).toEqual({ ok: false, reason: 'checksum mismatch' });
    expect(openEnvelope(null)).toEqual({ ok: false, reason: 'empty' });
    expect(openEnvelope({ format: 'other' })).toEqual({ ok: false, reason: 'not a save' });
  });
});
