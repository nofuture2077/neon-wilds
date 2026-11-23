import type { DistrictDefinition } from '../world/district';
import type { NpcArchetype, NpcDefinition } from './types';

/** Neon Downtown (WORLD.md §2.2): Halcyon's glass towers, strict grid, wide avenues. */
export const DOWNTOWN: DistrictDefinition = {
  id: 'downtown',
  name: 'Neon Downtown',
  style: 'downtown',
  blocksX: 4,
  blocksY: 3,
  blockW: 22,
  blockH: 18,
  roadW: 5,
  mergeChance: 0.08,
  parkBlock: { bx: 3, by: 0 },
  verticalStreets: ['Meridian Avenue', 'Varga Boulevard', 'Glass Street', 'Lumen Way', 'Harbor Approach'],
  horizontalStreets: ['Skyline Drive', 'Prism Row', 'Lantern Parade', 'Founders Street'],
  exits: [{ to: 'slums', side: 'west', street: 'Lantern Parade' }],
  namedBuildings: [
    {
      name: 'Halcyon Flagship Store',
      kind: 'shop',
      neon: 0x00e5ff,
      service: { kind: 'shop', shopId: 'halcyon-store' },
      description: 'White marble, soft music, licensed Wildlings in glass cases. Every one of them is asleep. All of them, at once.',
    },
    {
      name: 'Halcyon Wellness Clinic',
      kind: 'clinic',
      neon: 0x7ff6ff,
      service: { kind: 'clinic' },
      description: 'Fast, spotless and expensive. The receptionist asks if your Wildlings are licensed before she asks if they are hurt.',
    },
    { name: 'The Prism Club', kind: 'bar', neon: 0xff3fa4, description: 'A queue of influencers and their designer Wildlings. The bouncer has a Gearhound with a diamond collar.' },
    {
      name: 'Lumen Spire',
      kind: 'office',
      neon: 0xfff1d6,
      description: 'The tallest tower in Vesper. The lobby directory lists forty floors. The elevator has forty-one buttons.',
    },
    { name: 'Wardens Central', kind: 'office', neon: 0x4f7fff, description: 'Wardens headquarters. Commissioner Kord’s light is on. It is always on.' },
    { name: 'Chrome & Co. Motors', kind: 'shop', neon: 0xffb347, description: 'Showroom cars behind bulletproof glass. A sign: "Test drives by appointment only."' },
    { name: 'Vesper Gazette', kind: 'office', neon: 0xc77dff, description: 'The front page in the window: HALCYON PLEDGES SAFER STREETS. Below the fold: COURIER ATTACKED IN SLUMS.' },
    { name: 'Sky Noodle Bar', kind: 'shop', neon: 0xff5d5d, service: { kind: 'shop', shopId: 'sky-noodle' }, description: 'Same noodles as Glow Noodle, triple the price, and a view.' },
  ],
  residentialNames: ['Meridian Residences', 'Glasshouse Apartments', 'Skyline Lofts', 'The Panorama', 'Varga Tower', 'Cobalt Court'],
};

export const DOWNTOWN_ARCHETYPES: NpcArchetype[] = [
  {
    id: 'office-worker',
    role: 'office worker',
    temperament: 'timid',
    walkSpeed: 2.6,
    dialogue: {
      greeting: [["Sorry, I'm in a hurry. The quarterly Wildling compliance report won't file itself."], ['Have you tried the Halo earpiece? I sleep so much better now. I barely dream.']],
      night: [['Overtime again. The Spire never sleeps.']],
      grudge: [["I'm calling building security."]],
    },
    barks: { ambient: ['Synergy.', 'Per my last memo...', 'Coffee.'], night: ['So tired.'], shoved: ['Excuse you!', 'Rude!'], alarmed: ['Security!', 'Oh my.'] },
  },
  {
    id: 'socialite',
    role: 'socialite',
    temperament: 'steady',
    walkSpeed: 2.0,
    dialogue: {
      greeting: [['Darling, is that a *Slums* Wildling? How rustic.'], ['The Prism Club has a strict no-strays policy. Licensed only, sweetie.']],
      night: [['The Spire lights look like stars, don’t they? Real stars are so... grey.']],
      grudge: [['Do you know who my father is?']],
    },
    barks: { ambient: ['Fabulous.', 'Ugh, the Slums smell.', 'Where is my driver?'], night: ['Afterparty!'], shoved: ['How dare you!'], alarmed: ['Eek!'] },
  },
  {
    id: 'busker',
    role: 'busker',
    temperament: 'steady',
    walkSpeed: 2.0,
    dialogue: {
      greeting: [['I play the old marsh songs. Funny thing — the Wildlings in the glass cases wake up when I do.'], ['Coins welcome. Requests ignored.']],
      night: [['The acoustics are better at night. Fewer Halo earpieces humming.']],
      grudge: [['Mind the guitar, friend.']],
    },
    barks: { ambient: ['♪ la la la ♪', 'An old song for you...', 'Tips appreciated!'], night: ['♪ marsh lights ♪'], shoved: ['My guitar!'], alarmed: ['Whoa!'] },
  },
  {
    id: 'aegis-guard',
    role: 'Halcyon Aegis guard',
    temperament: 'tough',
    walkSpeed: 2.2,
    dialogue: {
      greeting: [['Move along, citizen.'], ['This sector is under Halcyon stewardship. Enjoy your safety.']],
      night: [['Curfew for unlicensed Wildlings is midnight.']],
      grudge: [['You are now on a watchlist.']],
    },
    barks: { ambient: ['Perimeter secure.', 'Stay safe, citizen.'], night: ['Night shift.'], shoved: ['Assaulting Aegis personnel!'], alarmed: ['Report incoming.'] },
  },
];

const S = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a1e] as const;
const s = (i: number) => S[i % S.length] as number;

export const DOWNTOWN_NPCS: NpcDefinition[] = [
  { id: 'npc-dt-ines', name: 'Ines Calder', archetype: 'office-worker', appearance: { skin: s(0), hair: 0x2b1a0e, top: 0x2f3e46, bottom: 0x1f1f28 } },
  { id: 'npc-dt-oren', name: 'Oren Vasquez', archetype: 'office-worker', appearance: { skin: s(3), hair: 0x111111, top: 0x5c7a99, bottom: 0x22333b } },
  { id: 'npc-dt-mika', name: 'Mika Holloway', archetype: 'office-worker', appearance: { skin: s(5), hair: 0xa0522d, top: 0x6b705c, bottom: 0x2b2b3a } },
  { id: 'npc-dt-celeste', name: 'Celeste Duvall', archetype: 'socialite', appearance: { skin: s(1), hair: 0xe8c66a, top: 0xff3fa4, bottom: 0xf0f6ff } },
  { id: 'npc-dt-rex', name: 'Rex Montague', archetype: 'socialite', appearance: { skin: s(2), hair: 0x111111, top: 0xb37dff, bottom: 0x1a1a24 } },
  { id: 'npc-dt-sol', name: 'Sol', archetype: 'busker', appearance: { skin: s(4), hair: 0x3a2412, top: 0xf2a541, bottom: 0x3d405b } },
  { id: 'npc-dt-guard1', name: 'Aegis Guard Park', archetype: 'aegis-guard', appearance: { skin: s(1), hair: 0x1a1a1a, top: 0xe8ecf4, bottom: 0x2b2f3a } },
  { id: 'npc-dt-guard2', name: 'Aegis Guard Moreau', archetype: 'aegis-guard', appearance: { skin: s(3), hair: 0x1a1a1a, top: 0xe8ecf4, bottom: 0x2b2f3a } },
];
