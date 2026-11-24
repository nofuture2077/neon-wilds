import { SPECIES } from './content/wildlings';
import type { ProgressionState } from './progression';

/** Lifetime counters kept in the save (local statistics; there is no online leaderboard). */
export interface PlayerStats {
  battlesWon: number;
  captures: number;
  carsStolen: number;
  carsSold: number;
  timesBusted: number;
  /** Distance in tiles. */
  walked: number;
  driven: number;
  /** Distinct street scenes looked at. */
  scenesLooked: number;
}

export function newStats(): PlayerStats {
  return { battlesWon: 0, captures: 0, carsStolen: 0, carsSold: 0, timesBusted: 0, walked: 0, driven: 0, scenesLooked: 0 };
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  /** Hidden until unlocked (spoilers). */
  secret?: boolean;
  unlocked(p: ProgressionState): boolean;
}

const done = (p: ProgressionState, id: string) => p.missions.some((m) => m.id === id && m.status === 'completed');
const catchable = Object.values(SPECIES).filter((s) => s.captureRate > 0 && s.rarity !== 'legendary').map((s) => s.id);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-catch', title: 'First Catch', description: 'Catch a wild Wildling.', unlocked: (p) => p.stats.captures >= 1 },
  { id: 'collector', title: 'Collector', description: 'Catch 10 different species.', unlocked: (p) => p.index.caught.length >= 10 },
  { id: 'naturalist', title: 'Naturalist', description: 'Catch 20 different species.', unlocked: (p) => p.index.caught.length >= 20 },
  { id: 'complete-index', title: 'The Whole City', description: 'Catch every species that can be caught in the wild.', unlocked: (p) => catchable.every((id) => p.index.caught.includes(id)) },
  { id: 'brawler', title: 'Street Brawler', description: 'Win 50 battles.', unlocked: (p) => p.stats.battlesWon >= 50 },
  { id: 'trainer-ladder', title: 'Climbed the Card', description: 'Beat 15 different trainers.', unlocked: (p) => p.defeatedTrainers.length >= 15 },
  { id: 'all-districts', title: 'Courier of Vesper', description: 'Set foot in all six districts.', unlocked: (p) => ['slums', 'downtown', 'harbor', 'industrial', 'oldtown', 'outskirts'].every((r) => p.flags[`visited:${r}`]) },
  { id: 'marathon', title: 'Marathon', description: 'Walk 10,000 tiles.', unlocked: (p) => p.stats.walked >= 10000 },
  { id: 'road-warrior', title: 'Road Warrior', description: 'Drive 10,000 tiles.', unlocked: (p) => p.stats.driven >= 10000 },
  { id: 'grand-theft', title: 'Borrowed, Technically', description: 'Steal 10 cars.', unlocked: (p) => p.stats.carsStolen >= 10 },
  { id: 'chop-chop', title: 'Chop Chop', description: 'Sell 5 stolen cars at the Scrapyard Exchange.', unlocked: (p) => p.stats.carsSold >= 5 },
  { id: 'busted', title: 'Known to the Wardens', description: 'Get busted.', unlocked: (p) => p.stats.timesBusted >= 1 },
  { id: 'street-life', title: 'Street Life', description: 'Stop and look at 20 street scenes.', unlocked: (p) => p.stats.scenesLooked >= 20 },
  { id: 'murals', title: 'Founders’ Eyes', description: 'Find all eight founders’ murals.', unlocked: (p) => Object.keys(p.flags).filter((f) => f.startsWith('mural:')).length >= 8 },
  { id: 'fragments', title: 'Three Doors', description: 'Collect three Hush Fragments.', unlocked: (p) => (p.inventory['hush-fragment'] ?? 0) >= 3 || done(p, 'the-quiet') },
  { id: 'saints-champion', title: 'Family', description: 'Become a champion of the Gutter Saints.', unlocked: (p) => !!p.flags['saints-champion'] },
  { id: 'halcyon-champion', title: 'Valued Asset', description: 'Become a champion of Halcyon Biotech.', unlocked: (p) => !!p.flags['halcyon-champion'] },
  { id: 'compact-champion', title: 'Crew', description: 'Become a champion of the Tidewater Compact.', unlocked: (p) => !!p.flags['compact-champion'] },
  { id: 'choir-champion', title: 'Walk in Green', description: 'Become a champion of the Verdant Choir.', unlocked: (p) => !!p.flags['choir-champion'] },
  { id: 'chain-champion', title: 'Wear the Chain', description: 'Become a champion of the Iron Chain.', unlocked: (p) => !!p.flags['chain-champion'] },
  { id: 'vik-friend', title: 'Partner', description: 'Finish Vik’s rivalry as friends.', unlocked: (p) => !!p.flags['vik-ally'] },
  { id: 'brave-juno', title: 'Braver Than You Think', description: 'Help Juno keep the stray.', unlocked: (p) => !!p.flags['juno-brave'] },
  { id: 'saltmaw', title: 'Berth Nine', description: 'Find Saltmaw.', secret: true, unlocked: (p) => !!p.flags['saltmaw-found'] },
  { id: 'resonant', title: 'It Sang First', description: 'Let the Glitchling sing with Hollowstag.', secret: true, unlocked: (p) => !!p.flags['hollow-song'] },
  { id: 'ending-chorus', title: 'The Chorus', description: 'Reach the Chorus ending.', unlocked: (p) => !!p.flags['ending-chorus'] },
  { id: 'ending-lights-out', title: 'Lights Out', description: 'Reach the Lights Out ending.', unlocked: (p) => !!p.flags['ending-lights-out'] },
  { id: 'ending-the-quiet', title: 'The Quiet', description: 'Reach the Quiet ending.', unlocked: (p) => !!p.flags['ending-the-quiet'] },
  { id: 'ending-vargas-city', title: 'Varga’s City', description: 'Reach Varga’s City ending.', unlocked: (p) => !!p.flags['ending-vargas-city'] },
  { id: 'ending-the-hollow', title: 'The Hollow', description: 'Reach the secret ending.', secret: true, unlocked: (p) => !!p.flags['ending-the-hollow'] },
];

/** Achievements unlocked since the last check; marks them in the save. */
export function checkAchievements(p: ProgressionState): AchievementDef[] {
  const fresh: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (p.flags[`ach:${a.id}`] || !a.unlocked(p)) continue;
    p.flags[`ach:${a.id}`] = true;
    fresh.push(a);
  }
  return fresh;
}
