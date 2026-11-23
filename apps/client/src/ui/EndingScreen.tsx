import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';

/** Epilogue: the ending title, then slides assembled from the player's world state. */
export function EndingScreen() {
  const ending = useGameStore((s) => s.ending);
  useEffect(() => {
    if (!ending) return;
    const next = (e: KeyboardEvent) => {
      if (!['Enter', ' ', 'e', 'E', 'Escape'].includes(e.key)) return;
      e.preventDefault();
      advance();
    };
    window.addEventListener('keydown', next);
    return () => window.removeEventListener('keydown', next);
  }, [ending]);
  if (!ending) return null;
  const slide = ending.index >= 0 ? ending.slides[ending.index] : null;
  const last = ending.index >= ending.slides.length - 1;

  return (
    <button
      type="button"
      onClick={advance}
      className="scanlines absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-8 bg-night-950/95 p-8 text-center outline-none"
    >
      {!slide ? (
        <>
          <div className="font-term text-2xl text-slate-400">Ending</div>
          <h1 className="neon-title font-pixel text-3xl text-neon-cyan sm:text-5xl">{ending.title}</h1>
        </>
      ) : (
        <div className="flex max-w-2xl flex-col gap-4">
          <h2 className="font-pixel text-sm text-neon-pink">{slide.heading}</h2>
          <p className="font-term text-3xl leading-snug text-white">{slide.text}</p>
        </div>
      )}
      <span className="blink font-pixel text-xs text-slate-400">{last ? 'Continue exploring Vesper ▸' : '▾'}</span>
    </button>
  );
}

function advance() {
  const s = useGameStore.getState();
  const e = s.ending;
  if (!e) return;
  if (e.index >= e.slides.length - 1) useGameStore.setState({ ending: null });
  else useGameStore.setState({ ending: { ...e, index: e.index + 1 } });
}
