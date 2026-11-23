import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import type { Session } from '../state/gameStore';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';

/**
 * Owns the Phaser.Game instance. React mounts it once per session and never
 * renders game-world content itself.
 */
export function GameCanvas({ session }: { session: Session }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO, // WebGL with automatic Canvas fallback
      parent: host.current,
      backgroundColor: '#07070f',
      pixelArt: true,
      roundPixels: true,
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      input: { gamepad: true, keyboard: true },
      fps: { target: 60, smoothStep: true },
      banner: false,
      scene: [BootScene, WorldScene, BattleScene],
      callbacks: {
        preBoot: (g) => g.registry.set('session', session),
      },
    });
    return () => game.destroy(true);
  }, [session]);

  return <div ref={host} className="absolute inset-0" />;
}
