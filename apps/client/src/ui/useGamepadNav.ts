import { useEffect } from 'react';
import { getSettings } from '../settings';

/**
 * Lets a controller drive menu screens: d-pad / left stick moves focus across
 * elements marked `data-nav` (arrow keys too), A clicks, B triggers the element marked `data-nav-back`.
 */
export function useGamepadNav(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let prev: boolean[] = [];
    let lastMove = 0;

    const focusables = () => Array.from(document.querySelectorAll<HTMLElement>('[data-nav]:not([disabled])'));
    const move = (dir: number) => {
      const items = focusables();
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = items[(i + dir + items.length) % items.length] ?? items[0];
      next?.focus();
    };

    const tick = (t: number) => {
      const pad = navigator.getGamepads?.().find((p) => p !== null) ?? null;
      if (pad) {
        const pressed = pad.buttons.map((b) => b.pressed);
        const edge = (i: number) => (pressed[i] ?? false) && !(prev[i] ?? false);
        const stickY = pad.axes[1] ?? 0;
        const up = (pressed[12] ?? false) || stickY < -0.5;
        const down = (pressed[13] ?? false) || stickY > 0.5;
        if ((up || down) && t - lastMove > 180) {
          move(up ? -1 : 1);
          lastMove = t;
        }
        if (!up && !down) lastMove = 0;
        if (edge(0)) (document.activeElement as HTMLElement | null)?.click();
        if (edge(1)) document.querySelector<HTMLElement>('[data-nav-back]')?.click();
        prev = pressed;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const active = document.activeElement as HTMLElement | null;
      const onNav = !!active?.matches('[data-nav]');
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') move(-1);
      else if (e.code === getSettings().bindings.interact && onNav && active?.tagName !== 'INPUT') active!.click(); // the interact key confirms, like the game
      else if (e.key === 'Enter' && !onNav) {
        // Nothing focused yet: Enter focuses the first option instead of being lost.
        (document.querySelector<HTMLElement>('[data-nav]:not([disabled])') ?? null)?.focus();
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
  }, [enabled]);
}
