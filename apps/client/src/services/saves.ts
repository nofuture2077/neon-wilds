import type { SimSnapshot } from '@neon-wilds/sim';
import { type SaveEnvelope, type SlotId, SLOTS, makeEnvelope, openEnvelope } from './saveFormat';

/**
 * Local save games in IndexedDB. Each slot keeps the current save plus two
 * rotating backups; a corrupted save falls back to the newest valid backup.
 */
const DB_NAME = 'neon-wilds';
const STORE = 'saves';
const BACKUPS = 2;

interface SlotRecord {
  slot: SlotId;
  current: SaveEnvelope;
  backups: SaveEnvelope[];
}

export interface SlotInfo {
  slot: SlotId;
  envelope: SaveEnvelope | null;
  /** True when the current save was unreadable and a backup is being offered instead. */
  recovered: boolean;
  corrupted: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function writeSave(slot: SlotId, state: SimSnapshot, location: string): Promise<SaveEnvelope> {
  const envelope = makeEnvelope(state, location);
  const existing = (await withStore<SlotRecord | undefined>('readonly', (s) => s.get(slot))) ?? null;
  const backups = existing ? [existing.current, ...existing.backups].slice(0, BACKUPS) : [];
  await withStore('readwrite', (s) => s.put({ slot, current: envelope, backups } satisfies SlotRecord));
  return envelope;
}

/** Load a slot, falling back to backups if the current save is corrupted. */
export async function readSave(slot: SlotId): Promise<{ snapshot: SimSnapshot; recovered: boolean } | null> {
  const record = await withStore<SlotRecord | undefined>('readonly', (s) => s.get(slot));
  if (!record) return null;
  for (const [i, env] of [record.current, ...record.backups].entries()) {
    const res = openEnvelope(env);
    if (res.ok) return { snapshot: res.snapshot, recovered: i > 0 };
  }
  return null;
}

export async function listSaves(): Promise<SlotInfo[]> {
  const out: SlotInfo[] = [];
  for (const slot of SLOTS) {
    let record: SlotRecord | undefined;
    try {
      record = await withStore<SlotRecord | undefined>('readonly', (s) => s.get(slot));
    } catch {
      record = undefined;
    }
    if (!record) {
      out.push({ slot, envelope: null, recovered: false, corrupted: false });
      continue;
    }
    const candidates = [record.current, ...record.backups];
    const valid = candidates.findIndex((e) => openEnvelope(e).ok);
    out.push({
      slot,
      envelope: valid >= 0 ? candidates[valid]! : null,
      recovered: valid > 0,
      corrupted: valid !== 0,
    });
  }
  return out;
}

export async function deleteSave(slot: SlotId): Promise<void> {
  await withStore('readwrite', (s) => s.delete(slot));
}

export function slotLabel(slot: SlotId): string {
  return slot === 'auto' ? 'Autosave' : `Slot ${slot.slice(-1)}`;
}
