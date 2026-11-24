import { useEffect } from 'react';
import { sfx } from './sfx';
import { getSettings, subscribeSettings } from '../settings';
import { useGameStore } from '../state/gameStore';
import type { MoodId } from './composer';
import { music } from './engine';

const VOLUME_KEY = 'neon-wilds:music-volume';

export function loadMusicVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) && localStorage.getItem(VOLUME_KEY) !== null ? v : 0.6;
  } catch {
    return 0.6;
  }
}

export function saveMusicVolume(v: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(v));
  } catch {
    // storage unavailable: the setting just won't persist
  }
}

/** Picks the musical mood from game state (the "music director"). */
export function moodFor(s: { screen: string; battle: unknown; hud: { stars: number; isNight: boolean; district?: string } }): MoodId {
  if (s.screen !== 'game') return 'title';
  if (s.battle) return 'battle';
  if (s.hud.stars >= 1) return 'chase';
  if (s.hud.district === 'Neon Downtown') return 'downtown';
  if (s.hud.district === 'Harbor District') return 'harbor';
  if (s.hud.district === 'Industrial Zone') return 'industrial';
  if (s.hud.district === 'Old Town') return 'oldtown';
  if (s.hud.district === 'The Outskirts') return 'outskirts';
  return s.hud.isNight ? 'slums-night' : 'slums-day';
}

export function useMusic(): void {
  useEffect(() => {
    useGameStore.setState({ musicVolume: loadMusicVolume() });
    const unlock = () => {
      music.start();
      sfx.setVolume(getSettings().sfxVolume);
      music.setVolume(useGameStore.getState().musicVolume);
      music.setMood(moodFor(useGameStore.getState()));
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // Every menu button confirms with a blip.
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest('button')) sfx.play('ui-confirm');
    };
    document.addEventListener('click', onClick, true);
    const unsubSettings = subscribeSettings(() => sfx.setVolume(getSettings().sfxVolume));
    const unsub = useGameStore.subscribe((s) => {
      music.setMood(moodFor(s));
      music.setVolume(s.musicVolume);
      music.setDucked(s.paused);
      if (s.paused || s.battle || s.screen !== 'game') sfx.setEngine(null);
    });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('click', onClick, true);
      unsubSettings();
      unsub();
    };
  }, []);
}
