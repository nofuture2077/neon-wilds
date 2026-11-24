import { useEffect, useState } from 'react';
import { ACTION_LABELS, DEFAULT_BINDINGS, type GameAction, type TextSize, keyLabel, rebind, updateSettings, useSettings } from '../settings';

/** Accessibility options and key rebinding (stored per browser). */
export function AccessibilityPanel() {
  const s = useSettings();
  const [waiting, setWaiting] = useState<GameAction | null>(null);

  useEffect(() => {
    if (!waiting) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape' || waiting === 'pause') rebind(waiting, e.code);
      setWaiting(null);
    };
    // Capture phase, so the menu's own key handling doesn't see the key being bound.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [waiting]);

  const toggle = (label: string, on: boolean, flip: () => void, note: string) => (
    <div>
      <button data-nav className="pixel-button" onClick={flip}>
        {label}: {on ? 'ON' : 'OFF'}
      </button>
      <p className="mt-1 font-term text-lg text-slate-400">{note}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 font-pixel text-xs text-neon-yellow">Accessibility</h3>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 font-term text-xl">
            <span className="w-40">Text size</span>
            {(['normal', 'large', 'huge'] as TextSize[]).map((size) => (
              <button
                key={size}
                data-nav
                className={`pixel-button !px-3 !py-2 !text-[10px] ${s.textSize === size ? '!border-neon-cyan !text-neon-cyan' : ''}`}
                onClick={() => updateSettings({ textSize: size })}
              >
                {size}
              </button>
            ))}
          </div>
          {toggle('Colour-blind friendly palette', s.colourBlind, () => updateSettings({ colourBlind: !s.colourBlind }), 'Health bars and highlights use blue and orange instead of green and red.')}
          {toggle('Reduce flashing', s.reduceFlashing, () => updateSettings({ reduceFlashing: !s.reduceFlashing }), 'No screen flashes in battles and crashes, and no flickering neon.')}
          {toggle('Screen shake', s.screenShake, () => updateSettings({ screenShake: !s.screenShake }), 'Camera shake on hits, crashes and explosions.')}
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-pixel text-xs text-neon-yellow">Keys</h3>
        <p className="mb-2 font-term text-lg text-slate-400">Pick an action, then press the new key. Arrows, Enter, Space and Esc always work too.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {(Object.keys(ACTION_LABELS) as GameAction[]).map((a) => (
            <button key={a} data-nav className="pixel-button flex justify-between !text-[10px]" onClick={() => setWaiting(a)}>
              <span>{ACTION_LABELS[a]}</span>
              <span className="text-neon-cyan">{waiting === a ? 'press a key…' : keyLabel(s.bindings[a])}</span>
            </button>
          ))}
        </div>
        <button data-nav className="pixel-button mt-3 !text-[10px]" onClick={() => updateSettings({ bindings: { ...DEFAULT_BINDINGS } })}>
          Reset keys to defaults
        </button>
      </div>
    </div>
  );
}
