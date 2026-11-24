import type { BattleLog, SimEvent } from '@neon-wilds/sim';
import { sfx } from './sfx';

/** Which sound a simulation event makes (if any). Pure mapping; the engine handles timing. */
export function playEventSfx(event: SimEvent, playerVehicleId: string | null): void {
  switch (event.type) {
    case 'dialogue.opened':
    case 'building.inspected':
      sfx.play('talk');
      break;
    case 'npc.shoved':
      sfx.play('shove');
      break;
    case 'vehicle.crash':
      if (event.vehicleId === playerVehicleId || event.impact > 4) sfx.play('crash', Math.min(1.6, 0.6 + event.impact / 8));
      break;
    case 'vehicle.honk':
      sfx.play('horn');
      break;
    case 'vehicle.entered':
    case 'vehicle.exited':
      sfx.play('door');
      break;
    case 'vehicle.exploded':
      sfx.play('explosion');
      break;
    case 'wanted.changed':
      if (event.stars > 0) sfx.play('siren');
      break;
    case 'busted':
      sfx.play('faint');
      break;
    case 'achievement':
      sfx.play('achievement');
      break;
    case 'tip':
      sfx.play('tip');
      break;
    case 'chop-shop':
    case 'index.milestone':
    case 'respray':
      sfx.play('coin');
      break;
    case 'mission.completed':
      sfx.play('mission');
      break;
    case 'mission.started':
      sfx.play('tip');
      break;
    case 'wildling.received':
      sfx.cry(event.speciesId);
      break;
    default:
      break;
  }
}

/** Battle sounds, played in step with the battle text. */
export function playBattleSfx(e: BattleLog, foeSpecies: string | null): void {
  switch (e.t) {
    case 'damage':
      sfx.play(e.crit || e.effectiveness > 1 ? 'hit-super' : 'hit');
      break;
    case 'miss':
      sfx.play('miss');
      break;
    case 'faint':
      sfx.play('faint');
      break;
    case 'switch':
      if (e.side === 'enemy' && foeSpecies) sfx.cry(foeSpecies);
      break;
    case 'throw':
      sfx.play('throw');
      break;
    case 'shake':
      sfx.play('shake');
      break;
    case 'capture':
      sfx.play(e.success ? 'capture' : 'miss');
      break;
    case 'levelup':
      sfx.play('levelup');
      break;
    case 'evolve':
      sfx.play('evolve');
      break;
    default:
      break;
  }
}
