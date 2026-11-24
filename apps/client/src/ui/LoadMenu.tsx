import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { type SlotInfo, deleteSave, exportSave, importSave, listSaves, readSave, slotLabel } from '../services/saves';
import { formatPlayTime, type SlotId } from '../services/saveFormat';

/** Lists local save slots; used by the main menu. */
export function LoadMenu({ onBack }: { onBack: () => void }) {
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startSession = useGameStore((s) => s.startSession);
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = () =>
    listSaves()
      .then(setSlots)
      .catch(() => setError('Local storage is unavailable in this browser.'));
  useEffect(() => {
    void refresh();
  }, []);

  const load = async (slot: SlotId) => {
    try {
      const res = await readSave(slot);
      if (!res) {
        setError('That save is corrupted and no backup could be recovered.');
        return;
      }
      startSession({ kind: 'load', snapshot: res.snapshot, slot });
      if (res.recovered) useGameStore.getState().pushToast('The latest save was damaged — restored the previous backup.', 'warning');
    } catch {
      setError('Could not read the save.');
    }
  };

  const onImport = async (file: File) => {
    const current = slots ?? (await listSaves());
    const target = (['slot1', 'slot2', 'slot3'] as const).find((s) => !current.find((c) => c.slot === s)?.envelope) ?? null;
    if (!target) {
      setError('All three slots are full. Delete one first, then import.');
      return;
    }
    const message = await importSave(target, await file.text());
    if (message) setError(message);
    else {
      setError(null);
      setNotice(`Imported into ${slotLabel(target)}.`);
      await refresh();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-pixel text-sm text-neon-yellow">Load game</h2>
      <p className="font-term text-lg text-slate-400">Saves live in this browser only. Export them to keep a backup or to move them to another browser.</p>
      {!slots && !error && <p className="font-term text-xl">Reading saves…</p>}
      {slots?.map((info) => (
        <div key={info.slot} className="flex gap-2">
          <button
            data-nav
            disabled={!info.envelope}
            className="pixel-button flex flex-1 flex-col gap-1"
            onClick={() => void load(info.slot)}
          >
            <span>
              {slotLabel(info.slot)}
              {info.recovered && <span className="ml-2 text-neon-pink">(backup)</span>}
            </span>
            <span className="font-term text-lg normal-case text-slate-300">
              {info.envelope
                ? `${info.envelope.summary.playerName} · ${info.envelope.summary.location} · ${info.envelope.summary.caught} caught · ${formatPlayTime(info.envelope.summary.playTimeSeconds)}`
                : info.corrupted
                  ? 'Corrupted'
                  : 'Empty'}
            </span>
          </button>
          {info.envelope && (
            <button data-nav className="pixel-button !px-3 !text-[10px]" title="Export to a file" onClick={() => void exportSave(info.slot)}>
              ⇩
            </button>
          )}
          {info.envelope && info.slot !== 'auto' && (
            <button
              data-nav
              className="pixel-button !px-3 !text-[10px]"
              title="Delete"
              onClick={() => void deleteSave(info.slot).then(refresh)}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button data-nav className="pixel-button" onClick={() => fileInput.current?.click()}>
        Import save file
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onImport(file);
        }}
      />
      {notice && <p className="font-term text-xl text-neon-green">{notice}</p>}
      {error && <p className="font-term text-xl text-neon-pink">{error}</p>}
      <button data-nav data-nav-back className="pixel-button" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

/** The most recently written save, for "Continue". */
export async function latestSave(): Promise<SlotId | null> {
  const slots = await listSaves();
  let best: { slot: SlotId; at: string } | null = null;
  for (const s of slots) {
    if (s.envelope && (!best || s.envelope.savedAt > best.at)) best = { slot: s.slot, at: s.envelope.savedAt };
  }
  return best?.slot ?? null;
}
