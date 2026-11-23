import { useGameStore } from '../state/gameStore';

export function DialogueBox() {
  const dialogue = useGameStore((s) => s.dialogue);
  const inBattle = useGameStore((s) => s.battle !== null);
  const advance = useGameStore((s) => s.advanceDialogue);
  if (!dialogue || inBattle) return null;
  const last = dialogue.page >= dialogue.pages.length - 1;
  const sign = dialogue.source.kind === 'sign';

  return (
    <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
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
          <span className="blink">{last ? '[E] close' : '[E] ▾'}</span>
        </div>
      </button>
    </div>
  );
}
