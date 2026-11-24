import type { DistrictDefinition } from '../world/district';
import type { NpcArchetype, NpcDefinition } from './types';

/** Harbor District (WORLD.md §2.5): cranes, containers, fog horns, the Compact's Night Market. */
export const HARBOR: DistrictDefinition = {
  id: 'harbor',
  name: 'Harbor District',
  style: 'harbor',
  waterfront: true,
  blocksX: 4,
  blocksY: 3,
  blockW: 20,
  blockH: 16,
  roadW: 5,
  mergeChance: 0.3,
  parkBlock: { bx: 3, by: 0 },
  verticalStreets: ['Ropewalk', 'Brine Street', 'Anchor Lane', 'Lighthouse Road', 'Breakwater'],
  horizontalStreets: ['Customs Road', 'Prism Row', 'Quay Street', 'Seawall'],
  exits: [{ to: 'downtown', side: 'west', street: 'Prism Row' }],
  namedBuildings: [
    {
      name: 'Night Market',
      kind: 'shop',
      neon: 0x4fffb0,
      service: { kind: 'shop', shopId: 'night-market' },
      description: 'Tarps, lanterns, and cages under the crane. "No names, no licences, no refunds."',
    },
    {
      name: 'Compact Counting House',
      kind: 'office',
      neon: 0xffb347,
      description: 'Ledgers stacked to the ceiling. A brass plaque: "Debts are paid. Crews come first."',
    },
    {
      name: 'Container Yard Office',
      kind: 'warehouse',
      neon: 0xff6b35,
      description: 'Manifests flap on a clipboard nailed to the door. One container number is circled in red: 7.',
    },
    { name: 'Halcyon Shipping', kind: 'office', neon: 0x00e5ff, description: 'Spotless white offices among the rust. The blinds are always down.' },
    { name: 'The Drowned Bell', kind: 'bar', neon: 0xc77dff, mural: 'On the cellar wall, wet with harbour damp: Saltmaw rising from the bay, and a lighthouse on the far shore of a marsh that is not there any more.',
      description: 'Sailors’ bar. They ring the bell every time someone swears they saw Saltmaw.' },
    { name: 'Fishmonger Row', kind: 'shop', neon: 0x7ff6ff, description: 'Ice, scales and haggling. A Puddlefin watches from a bucket, unimpressed.' },
  ],
  residentialNames: ['Dockers’ Bunkhouse', 'Seawall Tenement', 'Net Loft', 'Harbor Flats', 'Rope Street Row'],
};

export const HARBOR_ARCHETYPES: NpcArchetype[] = [
  {
    id: 'docker',
    role: 'docker',
    temperament: 'steady',
    walkSpeed: 2.3,
    dialogue: {
      greeting: [['Containers in, containers out. Nobody asks what’s inside. That’s the job.'], ['Halcyon ships don’t pay docking fees. Funny, that.']],
      night: [['Night shift pays double. Night cargo pays triple.']],
      grudge: [['Shove me again and you go in the water.']],
    },
    barks: { ambient: ['Heave!', 'Mind the crane!', 'Fog’s coming in.'], night: ['Quiet cargo tonight.'], shoved: ['Oi!'], alarmed: ['Wardens?'] },
  },
  {
    id: 'smuggler',
    role: 'Compact smuggler',
    temperament: 'tough',
    walkSpeed: 2.4,
    dialogue: {
      greeting: [['Looking to buy, sell, or swim?'], ['Captain Danso keeps the books. You keep your mouth shut. Simple.']],
      night: [['Best deals happen after midnight.']],
      grudge: [['You owe the Compact now. We always collect.']],
    },
    barks: { ambient: ['Psst.', 'Fresh stock.', 'No questions.'], night: ['Lanterns low.'], shoved: ['Bad move.'], alarmed: ['Scatter!'] },
    factionDialogue: {
      friendly: [['Captain says you’re good for it. Night Market’s open to you, friend.']],
      hostile: [['Captain Danso remembers debts. Yours is overdue.']],
    },
  },
  {
    id: 'fishmonger',
    role: 'fishmonger',
    temperament: 'steady',
    walkSpeed: 1.9,
    dialogue: {
      greeting: [['Fresh catch! Mind the Gutterjaw in the bucket — it bites.'], ['Saw something huge under the pier last week. Ten metres. Saltmaw, the old ones say.']],
      night: [['The fog brings the big ones up.']],
      grudge: [['No fish for you.']],
    },
    barks: { ambient: ['Fresh fish!', 'Squid! Squid!', 'Cheap today!'], night: ['Last of the catch!'], shoved: ['My ice!'], alarmed: ['What now?'] },
  },
];

const S = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a1e] as const;
const s = (i: number) => S[i % S.length] as number;

export const HARBOR_NPCS: NpcDefinition[] = [
  { id: 'npc-customs', name: 'Officer Brack', archetype: 'office-worker', spawn: 'mission', stationary: true, appearance: { skin: s(3), hair: 0x1a1a1a, top: 0x4f7fff, bottom: 0x2b2f3a } },
  { id: 'npc-bidder', name: 'Mr. Quill', archetype: 'socialite', spawn: 'mission', stationary: true, appearance: { skin: s(0), hair: 0xe8c66a, top: 0xf0f6ff, bottom: 0x1a1a24 } },
  { id: 'npc-danso', name: 'Captain Oriel Danso', archetype: 'smuggler', stationary: true, post: 'Compact Counting House', appearance: { skin: s(4), hair: 0xbbbbbb, top: 0x1f3b2f, bottom: 0x2b2b3a } },
  { id: 'npc-gilt', name: '"Gilt" Marlo', archetype: 'smuggler', stationary: true, post: 'Night Market', appearance: { skin: s(2), hair: 0xe8c66a, top: 0xd9b44a, bottom: 0x2b1d14 } },
  { id: 'npc-fen', name: 'Fen Halloway', archetype: 'smuggler', appearance: { skin: s(0), hair: 0x6b4a2a, top: 0x2f5856, bottom: 0x1a202c } },
  { id: 'npc-hb-ola', name: 'Ola Brandt', archetype: 'docker', appearance: { skin: s(1), hair: 0xa0522d, top: 0xe07a5f, bottom: 0x2f3e46 } },
  { id: 'npc-hb-kwame', name: 'Kwame Osei', archetype: 'docker', appearance: { skin: s(4), hair: 0x111111, top: 0xf2a541, bottom: 0x22333b } },
  { id: 'npc-hb-ruth', name: 'Ruth Lindqvist', archetype: 'fishmonger', appearance: { skin: s(0), hair: 0xd7d7d7, top: 0x5c7a99, bottom: 0x3d405b } },
  { id: 'npc-hb-tomas', name: 'Tomas Reyes', archetype: 'docker', appearance: { skin: s(2), hair: 0x2b1a0e, top: 0x6b705c, bottom: 0x1f1f28 } },
  { id: 'npc-dockwarden', name: 'Dock Warden Hask', archetype: 'aegis-guard', spawn: 'mission', stationary: true, appearance: { skin: s(1), hair: 0x111111, top: 0xe8ecf4, bottom: 0x1a1d26 } },
];
