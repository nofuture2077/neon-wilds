import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { CreatureIcon, HpBar } from './widgets';

export function Hud() {
  const hud = useGameStore((s) => s.hud);
  const overlay = useGameStore((s) => s.dialogue !== null || s.battle !== null || s.shopId !== null);
  const inBattle = useGameStore((s) => s.battle !== null);
  const progress = useGameStore((s) => s.progress);
  const playerName = useGameStore((s) => (s.session?.kind === 'new' ? s.session.setup.playerName : (s.session?.snapshot.player.name ?? '')));
  const objective = progress?.missions.find((m) => m.status === 'active' && m.objective);
  if (inBattle) return null;

  return (
    <div className="pointer-events-none absolute inset-0 p-4">
      <div className="flex flex-col items-start gap-2">
        <div className="panel inline-flex flex-col gap-1 px-4 py-3">
          <span className="font-pixel text-[10px] text-neon-pink">{hud.district}</span>
          <span className="font-term text-2xl leading-none text-white">{hud.location}</span>
        </div>
        {objective && (
          <div className="panel max-w-sm px-4 py-2">
            <div className="font-pixel text-[8px] text-neon-yellow">{objective.title}</div>
            <div className="font-term text-xl leading-tight text-slate-200">{objective.objective}</div>
          </div>
        )}
      </div>
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        {hud.stars > 0 && (
          <div className={`panel px-3 py-1 font-pixel text-lg tracking-widest ${hud.seen ? 'blink text-neon-pink' : 'text-neon-yellow'}`}>
            {'★'.repeat(hud.stars)}
            <span className="text-slate-600">{'★'.repeat(5 - hud.stars)}</span>
          </div>
        )}
        <div className="panel flex items-center gap-3 px-4 py-3">
          <span className="font-term text-xl text-slate-300">{playerName}</span>
          <span className="font-pixel text-xs text-neon-yellow">{progress?.money ?? 0}₵</span>
          <span className={`font-pixel text-sm ${hud.isNight ? 'text-neon-cyan' : 'text-neon-yellow'}`}>{hud.clock}</span>
        </div>
        {progress && progress.party.length > 0 && (
          <div className="panel flex gap-2 px-2 py-2">
            {progress.party.map((w) => (
              <div key={w.uid} className={`flex flex-col items-center ${w.hp <= 0 ? 'opacity-40' : ''}`} title={`${w.name} Lv${w.level}`}>
                <CreatureIcon speciesId={w.speciesId} size={32} />
                <div className="w-8">
                  <HpBar hp={w.hp} max={w.maxHp} wide />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {hud.speed !== null && (
        <div className="panel absolute bottom-6 left-6 flex items-end gap-4 px-4 py-3">
          <div>
            <div className="font-pixel text-[8px] text-slate-400">SPEED</div>
            <div className="font-pixel text-2xl text-neon-cyan">
              {hud.speed}
              <span className="ml-1 text-[10px] text-slate-400">km/h</span>
            </div>
          </div>
          <div className="w-28">
            <div className="font-pixel text-[8px] text-slate-400">CAR</div>
            <div className="h-2 w-full border border-black bg-night-950">
              <div
                className="h-full"
                style={{ width: `${hud.vehicleHealth ?? 0}%`, background: (hud.vehicleHealth ?? 0) > 35 ? '#4fffb0' : '#ff4f5e' }}
              />
            </div>
          </div>
        </div>
      )}
      {hud.prompt && !overlay && (
        <div className="absolute inset-x-0 bottom-10 flex justify-center">
          <div className="panel px-4 py-2 font-term text-2xl">
            <span className="mr-2 font-pixel text-xs text-neon-yellow">[{hud.promptKey}]</span>
            {hud.prompt}
          </div>
        </div>
      )}
      <Toasts />
    </div>
  );
}

function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissToast);
  useEffect(() => {
    if (toasts.length === 0) return;
    const first = toasts[0]!;
    const t = setTimeout(() => dismiss(first.id), 3200);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);
  const color = { info: 'border-night-700', mission: 'border-neon-yellow', reward: 'border-neon-green', warning: 'border-neon-pink' };
  return (
    <div className="absolute bottom-28 right-4 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`panel border-l-4 ${color[t.tone]} px-3 py-1.5 font-term text-xl`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
