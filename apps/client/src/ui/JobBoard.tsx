import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';
import { useGamepadNav } from './useGamepadNav';

/** Courier Co-op job board: procedurally generated jobs, refreshed daily. */
export function JobBoard() {
  const open = useGameStore((s) => s.boardOpen);
  useGameStore((s) => s.progress);
  const first = useRef<HTMLButtonElement>(null);
  useGamepadNav(open);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  if (!open) return null;
  const store = useGameStore.getState();
  const board = store.queries?.board();
  const close = () => useGameStore.setState({ boardOpen: false });

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
      <div className="panel flex max-h-[92vh] w-[min(680px,94vw)] flex-col gap-4 overflow-y-auto p-6">
        <h2 className="neon-title font-pixel text-sm text-neon-yellow">Co-op job board</h2>
        <p className="font-term text-lg text-slate-400">Fresh jobs every day. Some pay better than others — and some pay in ways you won't like.</p>
        {board?.jobs.length === 0 && <p className="font-term text-xl text-slate-400">Nothing on the board right now. Check back tomorrow.</p>}
        {board?.jobs.map((job, i) => (
          <div key={job.id} className="flex items-center justify-between gap-4 border-2 border-night-700 bg-night-800 p-3">
            <div className="flex flex-col">
              <span className="font-pixel text-[10px] text-white">{job.title}</span>
              <span className="font-term text-lg text-slate-300">{job.summary}</span>
              <span className="font-term text-lg text-neon-yellow">
                Reward: {job.reward}
                {job.deadline && <span className="ml-3 text-neon-pink">Due {job.deadline}</span>}
              </span>
            </div>
            <button
              ref={i === 0 ? first : undefined}
              data-nav
              className="pixel-button shrink-0 !px-3 !py-2 !text-[10px]"
              onClick={() => store.command({ type: 'mission.accept', missionId: job.id })}
            >
              Accept
            </button>
          </div>
        ))}
        <button data-nav data-nav-back className="pixel-button text-center" onClick={close}>
          Close (Esc)
        </button>
      </div>
    </div>
  );
}
