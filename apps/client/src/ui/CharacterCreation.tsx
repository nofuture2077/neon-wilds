import type { Appearance } from '@neon-wilds/sim';
import { useEffect, useRef, useState } from 'react';
import { drawCharacterFrame } from '../game/assets/characters';
import { css } from '../game/assets/canvas';
import { HAIR_COLORS, JACKET_COLORS, PANTS_COLORS, SKIN_TONES } from '../game/assets/palette';
import { useGameStore } from '../state/gameStore';
import { useGamepadNav } from './useGamepadNav';

const MAX_NAME = 14;

export function CharacterCreation() {
  const startSession = useGameStore((s) => s.startSession);
  const goTo = useGameStore((s) => s.goTo);
  const [name, setName] = useState('Ash');
  const [look, setLook] = useState<Appearance>({
    skin: SKIN_TONES[2],
    hair: HAIR_COLORS[0],
    top: JACKET_COLORS[0],
    bottom: PANTS_COLORS[0],
  });
  useGamepadNav(true);

  const trimmed = name.trim();
  const start = () => {
    if (!trimmed) return;
    // The city seed only affects world layout; gameplay randomness is seeded from it deterministically.
    const seed = (Math.random() * 0xffffffff) >>> 0;
    startSession({ kind: 'new', setup: { playerName: trimmed, appearance: look, seed } });
  };

  return (
    <div className="scanlines relative flex h-full w-full items-center justify-center bg-night-950 p-4">
      <div className="panel relative z-10 grid w-[min(860px,96vw)] gap-8 p-8 md:grid-cols-[1fr_220px]">
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <h2 className="font-pixel text-lg text-neon-cyan">Who are you?</h2>
          <p className="-mt-3 font-term text-xl text-slate-400">
            A night-shift courier in the Slums. Tonight's package is about to change everything.
          </p>
          <label className="flex flex-col gap-2">
            <span className="font-pixel text-xs text-slate-300">Name</span>
            <input
              data-nav
              autoFocus
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} '\-]/gu, ''))}
              className="border-2 border-night-700 bg-night-800 px-3 py-2 font-term text-2xl text-white outline-none focus:border-neon-cyan"
            />
          </label>
          <Swatches label="Skin" colors={SKIN_TONES} value={look.skin} onPick={(skin) => setLook({ ...look, skin })} />
          <Swatches label="Hair" colors={HAIR_COLORS} value={look.hair} onPick={(hair) => setLook({ ...look, hair })} />
          <Swatches label="Jacket" colors={JACKET_COLORS} value={look.top} onPick={(top) => setLook({ ...look, top })} />
          <Swatches label="Trousers" colors={PANTS_COLORS} value={look.bottom} onPick={(bottom) => setLook({ ...look, bottom })} />
          <div className="mt-2 flex gap-3">
            <button type="button" data-nav data-nav-back className="pixel-button" onClick={() => goTo('menu')}>
              Back
            </button>
            <button type="submit" data-nav className="pixel-button flex-1 text-center" disabled={!trimmed}>
              Hit the streets
            </button>
          </div>
        </form>
        <div className="flex flex-col items-center justify-center gap-4">
          <Preview look={look} />
          <span className="font-pixel text-xs text-neon-yellow">{trimmed || '???'}</span>
        </div>
      </div>
    </div>
  );
}

function Swatches({
  label,
  colors,
  value,
  onPick,
}: {
  label: string;
  colors: readonly number[];
  value: number;
  onPick: (c: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-pixel text-xs text-slate-300">{label}</span>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            data-nav
            aria-label={`${label} ${c.toString(16)}`}
            aria-pressed={c === value}
            onClick={() => onPick(c)}
            className={`h-8 w-8 border-2 outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
              c === value ? 'border-white' : 'border-night-700'
            }`}
            style={{ background: css(c) }}
          />
        ))}
      </div>
    </div>
  );
}

/** Live, rotating, walking preview drawn with the same code as the in-game sprite. */
function Preview({ look }: { look: Appearance }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const frame = document.createElement('canvas');
    frame.width = 16;
    frame.height = 16;
    const fctx = frame.getContext('2d');
    if (!fctx) return;
    let raf = 0;
    const draw = (t: number) => {
      fctx.clearRect(0, 0, 16, 16);
      drawCharacterFrame(fctx, 0, 0, look, Math.floor(t / 180) % 4);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#6a6a78';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.floor(t / 1500) * (Math.PI / 2));
      ctx.drawImage(frame, -64, -64, 128, 128);
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [look]);
  return <canvas ref={ref} width={176} height={176} className="border-2 border-night-700" />;
}
