import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';
import { useGamepadNav } from './useGamepadNav';

export function DialogueBox() {
  const dialogue = useGameStore((s) => s.dialogue);
  const inBattle = useGameStore((s) => s.battle !== null);
  const advance = useGameStore((s) => s.advanceDialogue);
  const choose = useGameStore((s) => s.chooseDialogue);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const showChoices = !!dialogue && dialogue.page >= dialogue.pages.length - 1 && !!dialogue.choices?.length;
  useGamepadNav(showChoices);
  useEffect(() => {
    if (!showChoices) return;
    const t = setTimeout(() => firstChoice.current?.focus(), 180);
    return () => clearTimeout(t);
  }, [showChoices]);
  if (!dialogue || inBattle) return null;
  const last = dialogue.page >= dialogue.pages.length - 1;
  const sign = dialogue.source.kind === 'sign';

  return (
    <div className="absolute inset-x-0 bottom-6 flex flex-col items-center px-4">
      <button
        type="button"
        onClick={() => advance()}
        className="panel w-[min(760px,96vw)] cursor-pointer px-6 py-5 text-left outline-none"
      >
        <div className={`mb-2 font-pixel text-xs ${sign ? 'text-neon-yellow' : dialogue.source.kind === 'message' ? 'text-neon-pink' : 'text-neon-cyan'}`}>
          {sign ? `◆ ${dialogue.speaker}` : dialogue.speaker}
        </div>
        <p className="min-h-[3.5rem] font-term text-2xl leading-snug text-white">{dialogue.pages[dialogue.page]}</p>
        <div className="mt-2 flex justify-between font-term text-lg text-slate-400">
          <span>
            {dialogue.pages.length > 1 ? `${dialogue.page + 1}/${dialogue.pages.length}` : ''}
          </span>
          <span className="blink">{showChoices ? 'choose' : last ? '[E] close' : '[E] ▾'}</span>
        </div>
      </button>
      {showChoices && (
        <div className="absolute bottom-full mb-3 flex w-[min(760px,96vw)] flex-col gap-2">
          {dialogue.choices!.map((c, i) => (
            <button key={c.id} ref={i === 0 ? firstChoice : undefined} data-nav className="pixel-button !normal-case" onClick={() => choose(c.id)}>
              {">"} {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
