import type { DistrictDefinition } from '../world/district';
import type { NpcArchetype, NpcDefinition } from './types';

/**
 * The Outskirts (WORLD.md §2.6): where the city gives up and the old forest
 * and marsh come back. Pilgrim camps, hermits, lost Halcyon field teams and
 * the Hollow, an ancient grove behind an overgrown gatehouse.
 */
export const OUTSKIRTS: DistrictDefinition = {
  id: 'outskirts',
  name: 'The Outskirts',
  style: 'outskirts',
  blocksX: 3,
  blocksY: 3,
  blockW: 24,
  blockH: 20,
  roadW: 5,
  parkBlock: { bx: 1, by: 1 },
  verticalStreets: ['Old Mill Road', 'Ferry Track', 'Reedway', 'Pilgrims’ Path'],
  horizontalStreets: ['Marsh Road', 'Lantern Track', 'Thicket Lane', 'Far Ring Road'],
  namedBuildings: [
    {
      name: 'Marsh Lighthouse',
      kind: 'warehouse',
      neon: 0xfff1d6,
      description: 'A lighthouse with no sea in sight: the marsh was a bay once. The lamp turns, though nobody has climbed the stairs in years. Fresh cable runs up the side, stamped V.C.T.',
    },
    {
      name: 'The Hollow Gate',
      kind: 'warehouse',
      neon: 0x6fd36f,
      description: 'A gatehouse swallowed by roots. Beyond it the trees are older than the city, and the air hums in a key the neon never reaches.',
    },
    {
      name: 'Hermit’s Trading Post',
      kind: 'shop',
      neon: 0xd9b44a,
      service: { kind: 'shop', shopId: 'hermit' },
      description: 'A shack of driftwood and road signs. "No coins. Well. Some coins."',
    },
    {
      name: 'Choir Waystation',
      kind: 'shop',
      neon: 0x9be89b,
      service: { kind: 'shop', shopId: 'waystation' },
      description: 'Pilgrims rest here on the way to the Hollow, though none of them have found it. Tea, bandages and very long songs.',
    },
    {
      name: 'Halcyon Field Camp',
      kind: 'office',
      neon: 0x00e5ff,
      description: 'Prefab huts, white tarps and capture cages. A whiteboard: "WEEK 6. TARGET NOT SIGHTED. MORALE: SEE ABOVE."',
    },
    {
      name: 'Old Marsh Chapel',
      kind: 'warehouse',
      neon: 0xffc46b,
      description: 'A chapel older than Old Town, half sunk into the reeds.',
      mural:
        'The eighth mural, on the chapel’s last standing wall: the stag again, in a ring of trees, singing to a small flickering creature curled in its antlers. Beneath it the founders wrote: "It sang first. Let it sing last." An arrow of painted roots points toward the Hollow Gate.',
    },
    {
      name: 'Squatters’ Mill',
      kind: 'workshop',
      neon: 0xff6b35,
      description: 'A water mill with no water. People live in every room, including the wheel.',
    },
  ],
  residentialNames: ['Boarded Farmhouse', 'Pilgrim Lodge', 'Hermit’s Hut', 'Reed Cottage', 'Caravan Lot'],
};

export const OUTSKIRTS_ARCHETYPES: NpcArchetype[] = [
  {
    id: 'pilgrim',
    role: 'Choir pilgrim',
    temperament: 'timid',
    walkSpeed: 1.6,
    dialogue: {
      greeting: [['We walk until we hear it. Some of us have been walking for years.'], ['The Hollow is real. My grandmother saw the stag. She saw a lot of things, but she saw the stag.']],
      night: [['Listen. No neon out here. Just the marsh, breathing.']],
      grudge: [['Even pilgrims have limits, courier.']],
    },
    barks: {
      ambient: ['Walk in green.', 'Mmm...', 'Is that it? No.'],
      night: ['Hush. Listen.'],
      shoved: ['Oh!'],
      alarmed: ['Run to the waystation!'],
    },
    factionDialogue: {
      friendly: [['The Cantor speaks of you, {player}. The marsh will too.']],
      hostile: [['You walk out here with a trader’s eyes.']],
    },
  },
  {
    id: 'hermit',
    role: 'hermit',
    temperament: 'steady',
    walkSpeed: 1.5,
    dialogue: {
      greeting: [['City folk. You always look up for the lights. Look down. The roots know more.'], ['Fernfoxes stole my boots again. Both pairs. They don’t even wear them.']],
      night: [['Out here, the dark is just dark. Restful, isn’t it?']],
      grudge: [['Go back to your neon.']],
    },
    barks: {
      ambient: ['Hm.', 'Roots and rain.', 'Mind the bog.'],
      night: ['Owls tonight.'],
      shoved: ['Rude!'],
      alarmed: ['Not again!'],
    },
  },
  {
    id: 'field-tech',
    role: 'Halcyon field technician',
    temperament: 'timid',
    walkSpeed: 2,
    dialogue: {
      greeting: [['Six weeks looking for a "large Shade-Bloom specimen". The scanner just plays whale noises.'], ['If you see a stag with branches for antlers, you didn’t. Corporate policy.']],
      night: [['The camp generator is the only light for miles. Everything comes to look at it.']],
      grudge: [['I’m filing an incident report about you.']],
    },
    barks: {
      ambient: ['Signal’s gone again.', 'Mud. Everywhere.', 'Calibrating...'],
      night: ['What was that?'],
      shoved: ['Hey! Equipment!'],
      alarmed: ['Containment breach!'],
    },
    factionDialogue: {
      friendly: [['Varga says you’re reliable. Out here that means you have a torch.']],
      hostile: [['You’re on our incident board, courier.']],
    },
  },
];

const S = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a1e] as const;
const s = (i: number) => S[i % S.length] as number;

export const OUTSKIRTS_NPCS: NpcDefinition[] = [
  { id: 'npc-field-boss', name: 'Field Lead Okafor-Shaw', archetype: 'field-tech', spawn: 'mission', stationary: true, appearance: { skin: s(4), hair: 0x1a1a1a, top: 0xe8ecf4, bottom: 0x2b2f3a } },
  {
    id: 'npc-orla',
    name: 'Orla the Hermit',
    archetype: 'hermit',
    stationary: true,
    post: 'Hermit’s Trading Post',
    appearance: { skin: s(2), hair: 0xbbbbbb, top: 0x6b705c, bottom: 0x3a3226 },
  },
  {
    id: 'npc-os-tamsin',
    name: 'Pilgrim Tamsin',
    archetype: 'pilgrim',
    appearance: { skin: s(1), hair: 0x6b4a2a, top: 0x6fa36f, bottom: 0x3a4a3a },
  },
  {
    id: 'npc-os-ezra',
    name: 'Pilgrim Ezra',
    archetype: 'pilgrim',
    appearance: { skin: s(4), hair: 0x111111, top: 0x4a7a4a, bottom: 0x2a3a2a },
  },
  {
    id: 'npc-os-lin',
    name: 'Technician Lin',
    archetype: 'field-tech',
    appearance: { skin: s(0), hair: 0x1a1a1a, top: 0xe8ecf4, bottom: 0x2b2f3a },
  },
  {
    id: 'npc-os-baptiste',
    name: 'Technician Baptiste',
    archetype: 'field-tech',
    appearance: { skin: s(3), hair: 0x3a2412, top: 0xe8ecf4, bottom: 0x2b2f3a },
  },
  {
    id: 'npc-os-moss',
    name: 'Old Moss',
    archetype: 'hermit',
    appearance: { skin: s(5), hair: 0xd7d7d7, top: 0x5a4a3a, bottom: 0x2a2420 },
  },
];
