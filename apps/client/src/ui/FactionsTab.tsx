import { css } from '../game/assets/canvas';
import { useGameStore } from '../state/gameStore';

export function FactionsTab() {
  useGameStore((s) => s.progress);
  const factions = useGameStore.getState().queries?.factions() ?? [];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {factions.map((f) => {
        const pct = (f.reputation + 100) / 2;
        return (
          <div key={f.id} className="border-2 border-night-700 bg-night-800 p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-pixel text-[10px]" style={{ color: css(f.color) }}>
                {f.name}
              </span>
              <span className="font-pixel text-[9px] text-slate-300">{f.tier}</span>
            </div>
            <div className="font-term text-lg italic text-slate-400">“{f.motto}”</div>
            <div className="font-term text-lg text-slate-300">Leader: {f.leader}</div>
            <div className="relative mt-2 h-2 w-full border border-black bg-night-950">
              <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
              <div className="h-full" style={{ width: `${pct}%`, background: f.reputation >= 0 ? '#4fffb0' : '#ff4f5e' }} />
            </div>
            <div className="mt-1 flex justify-between font-term text-base text-slate-400">
              <span>Standing {f.reputation > 0 ? '+' : ''}{f.reputation}</span>
              {f.blocks > 0 && <span>Holds {f.blocks} block{f.blocks === 1 ? '' : 's'}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
