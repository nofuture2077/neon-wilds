import { useEffect, useRef, useState } from 'react';
import { type PauseTab, useGameStore } from '../state/gameStore';
import { type SlotInfo, listSaves, slotLabel, writeSave } from '../services/saves';
import { SLOTS, type SlotId, formatPlayTime } from '../services/saveFormat';
import { saveMusicVolume } from '../audio/useMusic';
import { ControlsPanel } from './ControlsPanel';
import { FactionsTab } from './FactionsTab';
import { MapTab } from './MapTab';
import { CreatureIcon, HpBar, StatusBadge, TypeBadge, XpBar } from './widgets';
import { useGamepadNav } from './useGamepadNav';

const TABS: Array<[PauseTab, string]> = [
  ['party', 'Party'],
  ['bag', 'Bag'],
  ['index', 'Index'],
  ['map', 'Map'],
  ['journal', 'Journal'],
  ['factions', 'Factions'],
  ['save', 'Save'],
  ['options', 'Options'],
];

export function PauseMenu() {
  const paused = useGameStore((s) => s.paused);
  const tab = useGameStore((s) => s.pauseTab);
  const setPaused = useGameStore((s) => s.setPaused);
  const setTab = useGameStore((s) => s.setPauseTab);
  const quit = useGameStore((s) => s.quitToMenu);
  const first = useRef<HTMLButtonElement>(null);
  useGamepadNav(paused);
  useEffect(() => {
    if (paused) first.current?.focus();
  }, [paused]);
  if (!paused) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
      <div className="panel flex h-[min(680px,92vh)] w-[min(980px,96vw)] flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="neon-title mr-4 font-pixel text-lg text-neon-pink">Paused</h2>
          {TABS.map(([id, label], i) => (
            <button
              key={id}
              ref={i === 0 ? first : undefined}
              data-nav
              className={`pixel-button !px-3 !py-2 !text-[10px] ${tab === id ? '!border-neon-cyan !text-neon-cyan' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
          <span className="flex-1" />
          <button data-nav data-nav-back className="pixel-button !px-3 !py-2 !text-[10px]" onClick={() => setPaused(false)}>
            Resume
          </button>
          <button data-nav className="pixel-button !px-3 !py-2 !text-[10px]" onClick={quit}>
            Quit
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === 'party' && <PartyTab />}
          {tab === 'bag' && <BagTab />}
          {tab === 'index' && <IndexTab />}
          {tab === 'map' && <MapTab />}
          {tab === 'journal' && <JournalTab />}
          {tab === 'factions' && <FactionsTab />}
          {tab === 'save' && <SaveTab />}
          {tab === 'options' && <OptionsTab />}
        </div>
      </div>
    </div>
  );
}

function PartyTab() {
  const progress = useGameStore((s) => s.progress);
  const command = useGameStore((s) => s.command);
  if (!progress || progress.party.length === 0) return <Empty text="No Wildlings yet. Something tells you that will change tonight." />;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        {progress.party.map((w, i) => (
          <div key={w.uid} className="border-2 border-night-700 bg-night-800 p-3">
            <div className="flex gap-3">
              <CreatureIcon speciesId={w.speciesId} size={64} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between">
                  <span className="font-pixel text-xs text-neon-cyan">{w.name}</span>
                  <span className="font-pixel text-[10px]">Lv{w.level}</span>
                </div>
                <div className="flex gap-1">
                  {w.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                  <StatusBadge status={w.status} />
                  {w.injuries > 0 && <span className="font-term text-base text-neon-pink">injured ×{w.injuries}</span>}
                </div>
                <div className="flex items-center gap-2 font-term text-lg">
                  <HpBar hp={w.hp} max={w.maxHp} wide />
                  <span className="shrink-0">
                    {w.hp}/{w.maxHp}
                  </span>
                </div>
                <XpBar xp={w.xp} start={w.xpLevelStart} next={w.xpNextLevel} />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-x-3 font-term text-base text-slate-300">
              <span>ATK {w.stats.attack}</span>
              <span>DEF {w.stats.defence}</span>
              <span>SPD {w.stats.speed}</span>
              <span>FOC {w.stats.focus}</span>
              <span>RES {w.stats.resolve}</span>
              <span>♥ {Math.round((w.friendship / 255) * 100)}%</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {w.skills.map((s) => (
                <span key={s.id} className="flex items-center gap-1 border border-night-700 px-1.5 font-term text-base" title={s.description}>
                  <TypeBadge type={s.type} /> {s.name}
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {i > 0 && (
                <button data-nav className="pixel-button !px-2 !py-1 !text-[9px]" onClick={() => command({ type: 'party.setLead', partyIndex: i })}>
                  Make lead
                </button>
              )}
              {progress.party.length > 1 && (
                <button data-nav className="pixel-button !px-2 !py-1 !text-[9px]" onClick={() => command({ type: 'party.deposit', partyIndex: i })}>
                  To storage
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {progress.storage.length > 0 && (
        <div>
          <h3 className="mb-2 font-pixel text-xs text-neon-yellow">Coop storage ({progress.storage.length})</h3>
          <div className="flex flex-wrap gap-2">
            {progress.storage.map((w, i) => (
              <button
                key={w.uid}
                data-nav
                disabled={progress.party.length >= 6}
                className="pixel-button flex items-center gap-2 !px-2 !py-1"
                onClick={() => command({ type: 'party.withdraw', storageIndex: i })}
                title="Move to party"
              >
                <CreatureIcon speciesId={w.speciesId} size={32} />
                <span className="!text-[9px]">
                  {w.name} Lv{w.level}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BagTab() {
  const progress = useGameStore((s) => s.progress);
  const command = useGameStore((s) => s.command);
  const [using, setUsing] = useState<string | null>(null);
  if (!progress || progress.inventory.length === 0) return <Empty text="Your bag is empty. Paper Moon Pawn sells Snares." />;
  return (
    <div className="flex flex-col gap-2">
      {progress.inventory.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 border-2 border-night-700 bg-night-800 px-3 py-2">
          <div className="flex flex-col">
            <span className="font-pixel text-[10px] text-white">
              {item.name} <span className="text-neon-yellow">×{item.qty}</span>
            </span>
            <span className="font-term text-lg text-slate-400">{item.description}</span>
          </div>
          {item.category === 'medicine' && progress.party.length > 0 && (
            <button data-nav className="pixel-button !px-2 !py-1 !text-[9px]" onClick={() => setUsing(using === item.id ? null : item.id)}>
              Use
            </button>
          )}
        </div>
      ))}
      {using && (
        <div className="flex flex-wrap items-center gap-2 border-2 border-neon-cyan p-2">
          <span className="font-term text-lg">Use on:</span>
          {progress.party.map((w, i) => (
            <button
              key={w.uid}
              data-nav
              className="pixel-button !px-2 !py-1 !text-[9px]"
              onClick={() => {
                command({ type: 'item.use', itemId: using, partyIndex: i });
                setUsing(null);
              }}
            >
              {w.name} {w.hp}/{w.maxHp}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IndexTab() {
  const progress = useGameStore((s) => s.progress);
  if (!progress) return null;
  const caught = progress.index.filter((e) => e.caught).length;
  const seen = progress.index.filter((e) => e.seen).length;
  return (
    <div>
      <div className="mb-3 font-term text-xl text-slate-300">
        Seen {seen} · Caught {caught} · Known species {progress.index.length}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {progress.index.map((e, i) => (
          <div key={e.id} className="flex gap-2 border-2 border-night-700 bg-night-800 p-2">
            <CreatureIcon speciesId={e.id} size={48} silhouette={!e.caught} />
            <div className="flex min-w-0 flex-col">
              <span className="font-pixel text-[9px] text-slate-400">#{String(i + 1).padStart(3, '0')}</span>
              <span className="font-pixel text-[10px]">{e.seen ? e.name : '???'}</span>
              {e.seen && (
                <div className="flex gap-1">
                  {e.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </div>
              )}
              {e.caught && <span className="font-term text-sm leading-tight text-slate-400">{e.lore}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JournalTab() {
  const progress = useGameStore((s) => s.progress);
  if (!progress || progress.missions.length === 0) return <Empty text="No missions yet." />;
  const active = progress.missions.filter((m) => m.status === 'active');
  const done = progress.missions.filter((m) => m.status !== 'active');
  return (
    <div className="flex flex-col gap-4">
      {active.map((m) => (
        <div key={m.id} className="border-2 border-neon-yellow bg-night-800 p-3">
          <div className="font-pixel text-xs text-neon-yellow">{m.title}</div>
          <div className="font-term text-lg text-slate-400">{m.summary}</div>
          <div className="mt-1 font-term text-xl">▸ {m.objective}</div>
        </div>
      ))}
      {done.length > 0 && <h3 className="font-pixel text-[10px] text-slate-400">Finished</h3>}
      {done.map((m) => (
        <div key={m.id} className="border-2 border-night-700 bg-night-800 p-3 opacity-70">
          <div className="font-pixel text-[10px]">{m.status === 'failed' ? '✗' : '✓'} {m.title}</div>
          <div className="font-term text-lg text-slate-400">{m.summary}</div>
        </div>
      ))}
    </div>
  );
}

function SaveTab() {
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const refresh = () => listSaves().then(setSlots).catch(() => setStatus('Local storage is unavailable in this browser.'));
  useEffect(() => {
    void refresh();
  }, []);
  const save = async (slot: SlotId) => {
    const source = useGameStore.getState().snapshotSource?.();
    if (!source) {
      setStatus("You can't save right now.");
      return;
    }
    try {
      await writeSave(slot, source.snapshot, source.location);
      setStatus(`Saved to ${slotLabel(slot)}.`);
      void refresh();
    } catch {
      setStatus('Saving failed — local storage unavailable or full.');
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {SLOTS.filter((s) => s !== 'auto').map((slot) => {
        const info = slots?.find((x) => x.slot === slot);
        const env = info?.envelope;
        return (
          <button key={slot} data-nav className="pixel-button flex items-center justify-between gap-3" onClick={() => void save(slot)}>
            <span>{slotLabel(slot)}</span>
            <span className="font-term text-lg normal-case text-slate-300">
              {env ? `${env.summary.playerName} · ${env.summary.location} · ${formatPlayTime(env.summary.playTimeSeconds)} · ${new Date(env.savedAt).toLocaleString()}` : 'Empty'}
            </span>
          </button>
        );
      })}
      {status && <div className="font-term text-xl text-neon-yellow">{status}</div>}
      <p className="font-term text-lg text-slate-400">The game also autosaves every few minutes and after each mission.</p>
    </div>
  );
}

function OptionsTab() {
  const volume = useGameStore((s) => s.musicVolume);
  const set = (v: number) => {
    useGameStore.setState({ musicVolume: v });
    saveMusicVolume(v);
  };
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 font-pixel text-xs text-neon-yellow">Audio</h3>
        <label className="flex items-center gap-4 font-term text-xl">
          <span className="w-56">Music (procedural synthwave)</span>
          <input
            data-nav
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => set(Number(e.target.value) / 100)}
            className="w-64 accent-[#00e5ff]"
          />
          <span className="w-12 text-right">{Math.round(volume * 100)}%</span>
        </label>
        <p className="mt-2 font-term text-lg text-slate-400">
          The soundtrack is composed live by a rule-based algorithm — it never plays the same night twice.
        </p>
      </div>
      <ControlsPanel />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="font-term text-xl text-slate-400">{text}</p>;
}
