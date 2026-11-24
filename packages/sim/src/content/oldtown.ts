import type { DistrictDefinition } from '../world/district';
import type { NpcArchetype, NpcDefinition } from './types';

/**
 * Old Town (WORLD.md §2.4): cobblestones, gas lamps, cathedral spires and
 * collapsed arcades. The least neon in the city; the Verdant Choir's home,
 * with the Compact's smuggling tunnels underneath.
 */
export const OLDTOWN: DistrictDefinition = {
  id: 'oldtown',
  name: 'Old Town',
  style: 'oldtown',
  blocksX: 4,
  blocksY: 3,
  blockW: 16,
  blockH: 14,
  roadW: 5,
  parkBlock: { bx: 1, by: 1 },
  verticalStreets: ['Bellfounders’ Walk', 'Vellum Lane', 'Chandlers’ Row', 'Cloister Street', 'Mason’s Steps'],
  horizontalStreets: ['Ivy Street', 'Lamplighter Road', 'Old Arcade', 'Rook Avenue North', 'Verity Close'],
  namedBuildings: [
    {
      name: 'Cathedral of Saint Verity',
      kind: 'office',
      neon: 0x6fd36f,
      description: 'Half the nave has fallen in and ivy holds up the rest. Inside, the Verdant Choir sings to something that sings back.',
    },
    {
      name: 'Choir Apothecary',
      kind: 'shop',
      neon: 0x9be89b,
      service: { kind: 'shop', shopId: 'choir-apothecary' },
      description: 'Jars of moss, bark and bottled rain. "Donations welcome. Haggling is a sin."',
    },
    {
      name: 'Founders’ Vault',
      kind: 'warehouse',
      neon: 0xd9b44a,
      description: 'A bronze door under the old Civic Hall, green with age. Eight carved Wildlings circle the lock. Their eyes are keyholes.',
    },
    {
      name: 'Bellfounders’ Tower',
      kind: 'warehouse',
      neon: 0xffc46b,
      mural: 'A stag with branches for antlers stands in a marsh. Under it, a bell, and a waveform shaped like a ring.',
      description: 'The bells were melted down for the Lighting. The tower still hums when the wind is right.',
    },
    { name: 'Drowned Arcade', kind: 'shop', neon: 0x7ff6ff, mural: 'Lamps on poles, each with a tiny Wildling curled asleep inside. The founders painted them smiling. Someone later scratched out the smiles.',
      description: 'A shopping arcade from before the Lighting, flooded to the ankles. Murals peel along the walls.' },
    { name: 'Cistern Steps', kind: 'workshop', neon: 0x6fd36f, mural: 'Eight Wildlings in a circle, eyes pierced through the plaster. Through the holes, a draught and the smell of old paper: “Under the Hall.”',
      description: 'Stone steps down to the old cistern. Somebody keeps the candles lit.' },
    { name: 'Old Town Substation', kind: 'warehouse', neon: 0x00e5ff, description: 'Substation 9. A Halcyon padlock on a door that is three hundred years older than Halcyon.' },
    {
      name: 'Gaslight Antiques',
      kind: 'shop',
      neon: 0xffb347,
      service: { kind: 'shop', shopId: 'gaslight-antiques' },
      description: 'Clocks, compasses and snares older than the city charter. The owner remembers every price ever paid.',
    },
    { name: 'Tunnel Guides’ Guild', kind: 'office', neon: 0x4fffb0, description: '"Tours daily. Routes nightly. Questions never." A Compact anchor is chalked on the step.' },
  ],
  residentialNames: ['Cloister Lodgings', 'Lamplighters’ Row', 'Verity Almshouses', 'The Old Printworks', 'Ivy Court', 'Chapter House Flats'],
};

export const OLDTOWN_ARCHETYPES: NpcArchetype[] = [
  {
    id: 'choir-acolyte',
    role: 'Verdant Choir acolyte',
    temperament: 'steady',
    walkSpeed: 1.8,
    dialogue: {
      greeting: [['Can you hear it? Under the neon. A note held for three hundred years.'], ['The Wildlings were here before the first brick. We are only guests.']],
      night: [['The Hush is loudest at night. Listen. No — with your feet.']],
      grudge: [['Even the Choir’s patience has an end, courier.']],
    },
    barks: { ambient: ['Mmmm...', 'Peace, friend.', 'Listen.'], night: ['The city sleeps. Not them.'], shoved: ['Gently!'], alarmed: ['The grid is angry!'] },
    factionDialogue: {
      friendly: [['Brother Lark speaks well of you, {player}. Walk in green.']],
      hostile: [['You trade in living things. The Choir remembers.']],
    },
  },
  {
    id: 'antiquarian',
    role: 'antiquarian',
    temperament: 'timid',
    walkSpeed: 1.6,
    dialogue: {
      greeting: [['That doorknob is older than the Lighting. Don’t touch it.'], ['Eight murals, they say. I’ve found five. The other three are under somebody’s wallpaper.']],
      night: [['Gas lamps are the only honest light left in this city.']],
      grudge: [['I have catalogued you, courier. Under "rude".']],
    },
    barks: { ambient: ['Fascinating.', 'Pre-charter, surely.', 'Hm. Forgery.'], night: ['Mind the cobbles.'], shoved: ['My spectacles!'], alarmed: ['Oh dear, oh dear.'] },
  },
  {
    id: 'tunnel-guide',
    role: 'tunnel guide',
    temperament: 'tough',
    walkSpeed: 2.2,
    dialogue: {
      greeting: [['Tours at noon. Other things at midnight. You look like a midnight person.'], ['Every street up here has a twin down there. Some of them go to the sea.']],
      night: [['Busy night below. Don’t follow me.']],
      grudge: [['The tunnels are dark, courier. People get lost.']],
    },
    barks: { ambient: ['Watch your step.', 'Lantern’s low.', 'Down we go.'], night: ['Quiet now.'], shoved: ['Easy.'], alarmed: ['Wardens!'] },
    factionDialogue: {
      friendly: [['Danso says you’re good for it. Need a route, just ask.']],
      hostile: [['The Compact doesn’t guide people it doesn’t trust.']],
    },
  },
];

const S = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a1e] as const;
const s = (i: number) => S[i % S.length] as number;

export const OLDTOWN_NPCS: NpcDefinition[] = [
  { id: 'npc-raid-captain', name: 'Warden Captain Hollis', archetype: 'office-worker', spawn: 'mission', stationary: true, appearance: { skin: s(2), hair: 0x3a2412, top: 0x4f7fff, bottom: 0x2b2f3a } },
  { id: 'npc-cantor', name: 'Seraphine Vale, the Cantor', archetype: 'choir-acolyte', stationary: true, post: 'Cathedral of Saint Verity', appearance: { skin: s(1), hair: 0xd9d2c0, top: 0x2f6b3a, bottom: 0x1d2b22 } },
  { id: 'npc-lark', name: 'Brother Lark', archetype: 'choir-acolyte', stationary: true, post: 'Choir Apothecary', appearance: { skin: s(3), hair: 0x6b4a2a, top: 0x6fa36f, bottom: 0x3a4a3a } },
  { id: 'npc-thorn-acolyte', name: 'Thorn’s Acolyte', archetype: 'choir-acolyte', spawn: 'mission', stationary: true, appearance: { skin: s(0), hair: 0x2a1d10, top: 0x1f3d2c, bottom: 0x141c18 } },
  { id: 'npc-thorn', name: 'Thorn', archetype: 'choir-acolyte', spawn: 'mission', stationary: true, appearance: { skin: s(4), hair: 0x111111, top: 0x24402a, bottom: 0x101410 } },
  { id: 'npc-ot-mira', name: 'Sister Mira', archetype: 'choir-acolyte', appearance: { skin: s(2), hair: 0x8d5524, top: 0x4a7a4a, bottom: 0x2a3a2a } },
  { id: 'npc-ot-calder', name: 'Professor Calder', archetype: 'antiquarian', appearance: { skin: s(0), hair: 0xe0e0e0, top: 0x6b4f3a, bottom: 0x3a2f28 } },
  { id: 'npc-ot-wynn', name: 'Old Wynn', archetype: 'antiquarian', appearance: { skin: s(5), hair: 0xc0c0c0, top: 0x3a3a5a, bottom: 0x2a2a3a } },
  { id: 'npc-ot-bex', name: 'Bex Lantern', archetype: 'tunnel-guide', appearance: { skin: s(2), hair: 0xc1440e, top: 0x2a9d8f, bottom: 0x264653 } },
  { id: 'npc-ot-rafe', name: 'Rafe Moller', archetype: 'tunnel-guide', appearance: { skin: s(1), hair: 0x3a2412, top: 0x4f5d75, bottom: 0x2d3142 } },
];
