import { SNAPSHOT_VERSION, getSpecies, migrateSnapshot, type SimSnapshot } from '@neon-wilds/sim';

export const SAVE_FORMAT = 'neon-wilds-save';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type SlotId = (typeof SLOTS)[number];

export interface SaveSummary {
  playerName: string;
  location: string;
  leadSpecies: string | null;
  partyCount: number;
  caught: number;
  money: number;
  playTimeSeconds: number;
}

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: string;
  summary: SaveSummary;
  checksum: string;
  state: SimSnapshot;
}

/** CRC-32 (IEEE) over a UTF-16 string's code units; enough to detect corruption. */
export function crc32(text: string): string {
  let crc = 0xffffffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) & 0xff;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    crc ^= (text.charCodeAt(i) >>> 8) & 0xff;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

export function makeEnvelope(state: SimSnapshot, location: string, now = new Date()): SaveEnvelope {
  const lead = state.progression.party[0];
  return {
    format: SAVE_FORMAT,
    version: SNAPSHOT_VERSION,
    savedAt: now.toISOString(),
    summary: {
      playerName: state.player.name,
      location,
      leadSpecies: lead ? getSpecies(lead.speciesId).name : null,
      partyCount: state.progression.party.length,
      caught: state.progression.index.caught.length,
      money: state.progression.money,
      playTimeSeconds: Math.floor(state.tick / 60),
    },
    checksum: crc32(JSON.stringify(state)),
    state,
  };
}

/** Validate an envelope read from storage; returns a migrated snapshot or an error reason. */
export function openEnvelope(raw: unknown): { ok: true; snapshot: SimSnapshot } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'empty' };
  const env = raw as Partial<SaveEnvelope>;
  if (env.format !== SAVE_FORMAT || !env.state || typeof env.checksum !== 'string') return { ok: false, reason: 'not a save' };
  if (crc32(JSON.stringify(env.state)) !== env.checksum) return { ok: false, reason: 'checksum mismatch' };
  try {
    return { ok: true, snapshot: migrateSnapshot(env.state) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'unreadable' };
  }
}

export function formatPlayTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** File name for an exported save, e.g. `neon-wilds-ash-slot1-2026-11-24.json`. */
export function exportFileName(env: SaveEnvelope, slot: SlotId): string {
  const who = env.summary.playerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'courier';
  return `neon-wilds-${who}-${slot}-${env.savedAt.slice(0, 10)}.json`;
}

/** Read an exported save file. Same checks as storage: format, checksum, migration. */
export function parseSaveFile(text: string): { ok: true; envelope: SaveEnvelope; snapshot: SimSnapshot } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not a save file' };
  }
  const res = openEnvelope(raw);
  return res.ok ? { ok: true, envelope: raw as SaveEnvelope, snapshot: res.snapshot } : res;
}
