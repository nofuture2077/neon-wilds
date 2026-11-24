import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';

/** First-time guide tips: one at a time, top centre, visible in battles too. */
export function TipPanel() {
  // Newest first: the tip for what is happening right now beats an older one still waiting.
  const tip = useGameStore((s) => s.tips[s.tips.length - 1]);
  const dismiss = useGameStore((s) => s.dismissTip);
  const paused = useGameStore((s) => s.paused);
  useEffect(() => {
    if (!tip || paused) return;
    const t = setTimeout(() => dismiss(tip.id), 6000 + tip.text.length * 45);
    return () => clearTimeout(t);
  }, [tip, paused, dismiss]);
  if (!tip || paused) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-30 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2">
      <div className="panel border-l-4 border-neon-cyan px-4 py-3">
        <div className="font-pixel text-[9px] text-neon-cyan">TIP · {tip.title}</div>
        <div className="mt-1 font-term text-xl leading-tight text-slate-100">{tip.text}</div>
      </div>
    </div>
  );
}
