import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { readSave } from '../services/saves';
import type { SlotId } from '../services/saveFormat';
import { ControlsPanel } from './ControlsPanel';
import { LoadMenu, latestSave } from './LoadMenu';
import { useGamepadNav } from './useGamepadNav';

export function MainMenu() {
  const goTo = useGameStore((s) => s.goTo);
  const [panel, setPanel] = useState<'main' | 'controls' | 'load'>('main');
  const [latest, setLatest] = useState<SlotId | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  useGamepadNav(true);
  useEffect(() => {
    latestSave().then(setLatest).catch(() => setLatest(null));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => (document.querySelector<HTMLElement>('[data-nav]:not([disabled])') ?? first.current)?.focus(), 30);
    return () => clearTimeout(t);
  }, [panel, latest]);
  const continueGame = async () => {
    if (!latest) return;
    const res = await readSave(latest).catch(() => null);
    if (res) useGameStore.getState().startSession({ kind: 'load', snapshot: res.snapshot, slot: latest });
    else setPanel('load');
  };

  return (
    <div className="scanlines relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_bottom,#2a0f3d_0%,#07070f_65%)]">
      <Skyline />
      <div className="relative z-10 flex flex-col items-center gap-10 px-4">
        <div className="text-center">
          <h1 className="neon-title font-pixel text-4xl text-neon-pink sm:text-6xl">NEON</h1>
          <h1 className="neon-title mt-3 font-pixel text-4xl text-neon-cyan sm:text-6xl">WILDS</h1>
          <p className="mt-6 font-term text-2xl text-slate-300">Vesper City never sleeps. Neither do its Wildlings.</p>
        </div>

        {panel === 'controls' && (
          <div className="panel w-[min(560px,92vw)] p-6">
            <ControlsPanel />
            <button ref={first} data-nav data-nav-back className="pixel-button mt-6 w-full" onClick={() => setPanel('main')}>
              Back
            </button>
          </div>
        )}
        {panel === 'load' && (
          <div className="panel w-[min(640px,92vw)] p-6">
            <LoadMenu onBack={() => setPanel('main')} />
          </div>
        )}
        {panel === 'main' && (
          <nav className="flex w-72 flex-col gap-3">
            {latest && (
              <button ref={first} data-nav className="pixel-button" onClick={() => void continueGame()}>
                Continue
              </button>
            )}
            <button ref={latest ? undefined : first} data-nav className="pixel-button" onClick={() => goTo('create')}>
              New Game
            </button>
            <button data-nav className="pixel-button" onClick={() => setPanel('load')}>
              Load Game
            </button>
            <button data-nav className="pixel-button" onClick={() => setPanel('controls')}>
              Controls
            </button>
          </nav>
        )}
        <p className="font-term text-lg text-slate-500">v0.2 · Milestone 2 — Wildlings</p>
      </div>
    </div>
  );
}

/** Decorative CSS skyline with a few flickering windows. */
function Skyline() {
  const towers = [
    [4, 38],
    [9, 55],
    [15, 30],
    [21, 70],
    [28, 45],
    [34, 60],
    [41, 35],
    [47, 80],
    [55, 50],
    [61, 40],
    [67, 66],
    [74, 32],
    [80, 58],
    [87, 44],
    [93, 62],
  ] as const;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-70">
      {towers.map(([left, height], i) => (
        <div
          key={i}
          className="absolute bottom-0 w-[6%] bg-night-900"
          style={{ left: `${left - 3}%`, height: `${height}%`, boxShadow: 'inset 0 2px 0 #24243f' }}
        >
          <div
            className="absolute left-1/4 top-4 h-1 w-1/2"
            style={{ background: i % 3 === 0 ? '#ff3fa4' : i % 3 === 1 ? '#00e5ff' : '#fff275', boxShadow: '0 0 8px currentColor', opacity: 0.8 }}
          />
        </div>
      ))}
    </div>
  );
}
