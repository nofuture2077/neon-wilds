import type { DistrictDefinition } from '../world/district';
import type { NpcArchetype, NpcDefinition } from './types';

export const SLUMS: DistrictDefinition = {
  id: 'slums',
  name: 'The Slums',
  blocksX: 4,
  blocksY: 3,
  blockW: 18,
  blockH: 16,
  roadW: 5,
  parkBlock: { bx: 2, by: 2 },
  verticalStreets: ['Kettle Street', 'Rook Avenue', 'Gaslight Way', 'Ninth Spur', 'Tallow Street'],
  horizontalStreets: ['Cinder Row', 'Gutter Lane', 'Lantern Parade', 'Drain Street'],
  namedBuildings: [
    {
      name: 'Vesper Courier Co-op',
      kind: 'office',
      neon: 0xfff275,
      description:
        "The dispatch board flickers. Your name is still on tonight's roster — next to a delivery marked FRAGILE / DO NOT OPEN / DO NOT LOSE.",
    },
    {
      name: 'Glow Noodle',
      kind: 'shop',
      service: { kind: 'shop', shopId: 'glow-noodle' },
      neon: 0xff4fa3,
      description:
        "Steam curls from a cracked window. A handwritten sign: 'NO WILDLINGS ON THE COUNTER. YES, THAT MEANS YOU, PIP.'",
    },
    {
      name: 'Saint Ottilie Free Clinic',
      kind: 'clinic',
      service: { kind: 'clinic' },
      neon: 0x4fffb0,
      description:
        'A halo sprayed in silver paint marks the door — the sign of the Gutter Saints. People and Wildlings treated alike, no questions asked.',
    },
    {
      name: "Kasimir's Cables & Coils",
      kind: 'workshop',
      neon: 0x4fc3ff,
      description: "Racks of salvaged neon tubing. A painted promise: 'Fizzlet-proof wiring. Guaranteed. Mostly.'",
    },
    {
      name: 'The Drowned Lantern',
      kind: 'bar',
      neon: 0xffb347,
      description:
        "Bass thumps through the door. A chalkboard lists tonight's pit fights, but every name has been scrubbed out with a wet thumb.",
    },
    {
      name: 'Paper Moon Pawn',
      kind: 'shop',
      service: { kind: 'shop', shopId: 'paper-moon' },
      neon: 0xc77dff,
      description: 'Behind the grille: radios, rings, a cage with a broken lock. Everything has a price, the sign insists.',
    },
    {
      name: 'Halcyon Outreach Kiosk',
      kind: 'office',
      neon: 0xf0f6ff,
      description:
        "A spotless white storefront wedged between two ruins. The poster smiles: 'HALCYON BIOTECH — Building a Gentler City.' The door has three cameras.",
    },
    {
      name: 'Rustbucket Garage',
      kind: 'workshop',
      neon: 0xff6b35,
      description: 'Engine parts everywhere. Someone has chained a scooter to the drainpipe with three separate locks.',
    },
    {
      name: "Mother Rook's Kitchen",
      kind: 'shop',
      neon: 0xff5d5d,
      description: 'Free soup on Tuesdays. Free soup on the other days too, if you look hungry enough.',
    },
    {
      name: 'Warden Substation 14',
      kind: 'office',
      neon: 0x4f7fff,
      description:
        "Blue shutters, bolted. A Wildling Control notice is pasted over an older one: 'REPORT UNLICENSED CREATURES. REWARDS PAID.'",
    },
  ],
  residentialNames: [
    'Coldwater Flats',
    'Tenement No. 9',
    'Rooming House',
    'Boarded Rowhouse',
    'Stacked Containers',
    'Walk-up Apartments',
    'Kettle Street Lofts',
    'The Hive',
  ],
};

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a1e, 0xffdbac] as const;
const s = (i: number) => SKIN[i % SKIN.length] as number;

export const SLUMS_ARCHETYPES: NpcArchetype[] = [
  {
    id: 'gutter-saint',
    role: 'Gutter Saints runner',
    temperament: 'tough',
    walkSpeed: 2.4,
    dialogue: {
      greeting: [
        ["Saints look after the Slums, {player}. Wardens just count us.", 'You see a hurt Wildling, you bring it to Ottilie. Not to the kiosk. Never the kiosk.'],
        ['Heard a courier got jumped near the docks last week. Package went missing.', 'Funny thing. Nobody reported it.'],
        ["Mother Rook says the city's got a fever. Says the neon hums wrong lately.", "I don't hear it. But the strays do."],
      ],
      night: [["After dark the strays come out of the drains. Leave 'em be and they'll leave you be."]],
      grudge: [
        ["You've got a lot of nerve, talking to me after that.", 'Shove a Saint again and the whole street hears about it.'],
        ['Walk away, {player}. Slowly.'],
      ],
    },
    factionDialogue: {
      friendly: [
        ["Mother Rook's been asking about you, {player}. Good things, mostly.", 'Need patching up? Ottilie\u2019s door is always open for family.'],
        ["Halcyon posters went up on Lantern Parade again. We've been peeling them off.", 'Keep your eyes open for their vans. Wildlings go in, nothing comes out.'],
      ],
      hostile: [
        ["You've been making friends with the wrong people, {player}.", "Ottilie's clinic will still treat you. It'll just cost you now."],
        ['Saints remember. Every shove, every sold Wildling. Every single one.'],
      ],
    },
    barks: {
      ambient: ['Keep your head down.', 'Saints are watching.', 'Quiet night. Too quiet.'],
      night: ['Lights are humming again.', "Stay off Drain Street after midnight."],
      shoved: ['Hey! Watch it!', 'You want trouble?', "Do that again. I dare you."],
      alarmed: ['Oi! What was that?', 'Everybody easy.'],
    },
  },
  {
    id: 'street-vendor',
    role: 'street vendor',
    temperament: 'steady',
    walkSpeed: 2.0,
    dialogue: {
      greeting: [
        ['Skewers, two for a coin! Grilled, glazed, absolutely not Wildling.', '...Mostly not Wildling. Kidding! Kidding.'],
        ["Business is slow. Halcyon's handing out free meal tokens at their kiosk.", "Nothing's free in Vesper, {player}. Nothing."],
        ['You a courier? Then you know every shortcut. Ever seen the old tunnel under Rook Avenue?', 'They welded it shut last month. Who welds a tunnel?'],
      ],
      night: [["Night crowd tips better. Drunk crowd tips best.", 'Stay sharp — the pit fighters come out after ten.']],
      grudge: [["Oh, it's you. Mind the cart this time."], ['I remember faces. Especially rude ones.']],
    },
    barks: {
      ambient: ['Hot skewers!', 'Fresh from the grill!', 'Two for a coin!'],
      night: ['Last batch tonight!', 'Warm your hands, friend.'],
      shoved: ['My cart!', 'Hey, careful!'],
      alarmed: ['What now?', 'Not again...'],
    },
  },
  {
    id: 'night-worker',
    role: 'night-shift worker',
    temperament: 'timid',
    walkSpeed: 2.2,
    dialogue: {
      greeting: [
        ['Sorry — late for my shift at the cannery.', 'They dock pay by the minute now. The minute!'],
        ["Did you hear something scratching in the vents? Every night this week.", "My landlord says it's pipes. Pipes don't purr."],
      ],
      night: [["I always walk under the lamps. Something in the dark knows my name, I swear."]],
      grudge: [['Please — just leave me alone.'], ["I-I don't want any trouble."]],
    },
    barks: {
      ambient: ['So tired...', 'Two more hours.', 'Is it Friday yet?'],
      night: ['Under the lamps, under the lamps...', 'Was that a tail?'],
      shoved: ['Ah! Sorry! Sorry!', 'Please don’t!'],
      alarmed: ['Oh no, oh no.', 'Help!'],
    },
  },
  {
    id: 'old-timer',
    role: 'old-timer',
    temperament: 'steady',
    walkSpeed: 1.6,
    dialogue: {
      greeting: [
        ['Forty years ago there were no lights here. Just fog and Wildlings and fishermen.', 'Then the Board strung up the neon. Wildlings stayed out of the city after that.', 'Never did ask why.'],
        ["Your folks were couriers too, weren't they? Good people. Asked too many questions."],
        ['Kids these days catch Wildlings in cans. In my day we just argued with them.'],
      ],
      night: [["Listen. Hear that hum? That's the city breathing. Or the city holding its breath."]],
      grudge: [["I've been pushed around by better than you, kid."]],
    },
    barks: {
      ambient: ['Back in my day...', 'Mind the puddles.', 'Hmph.'],
      night: ['Too bright. Always too bright.', 'Hear that hum?'],
      shoved: ['Respect your elders!', 'Ow, my hip!'],
      alarmed: ['Eh? What happened?', 'Hooligans.'],
    },
  },
  {
    id: 'street-kid',
    role: 'street kid',
    temperament: 'timid',
    walkSpeed: 2.8,
    dialogue: {
      greeting: [
        ['I saw a Fizzlet chew through a whole power line! The whole block went dark and it just sat there. Glowing.'],
        ["Bet you can't find the secret door in the park. I found it. Not telling."],
        ["Are you the courier with the weird package? Everyone's talking about you, {player}."],
      ],
      night: [["Mom says come home before the lamps buzz. I don't listen."]],
      grudge: [["You're mean. I'm telling the Saints."]],
    },
    barks: {
      ambient: ['Wanna race?', 'I saw a Wildling!', 'Got any coins?'],
      night: ['Ooh, spooky.', "I'm not scared."],
      shoved: ['Waaah!', 'Hey! Bully!'],
      alarmed: ['Run!', 'Whoa!'],
    },
  },
  {
    id: 'tinkerer',
    role: 'scrap tinkerer',
    temperament: 'timid',
    walkSpeed: 2.1,
    dialogue: {
      greeting: [
        ["The Halcyon trucks dumped crates by the river last night. Real lab gear.", 'Somebody scratched the logo off every single one. Why bother, unless...'],
        ['Neon tubes have a frequency, you know. Most people never think about it.', "Wildlings think about it. They definitely think about it."],
      ],
      night: [['The tubes run hotter at night. I measured. Nobody listens to me.']],
      grudge: [["Hands off, please. I'm carrying delicate instruments."]],
    },
    barks: {
      ambient: ['Where did I put that coil...', 'Fascinating.', 'Hmm, eighty hertz.'],
      night: ['Hotter tonight. Interesting.', 'Readings are off again.'],
      shoved: ['My instruments!', 'Careful!'],
      alarmed: ['Was that a short?', 'Eek!'],
    },
  },
];

SLUMS_ARCHETYPES.push(
  {
    id: 'rival-trainer',
    role: 'pit fighter',
    temperament: 'tough',
    walkSpeed: 2.4,
    dialogue: { greeting: [['...']], night: [], grudge: [["Shove me again and we'll settle it in the pit."]] },
    barks: { ambient: ['Bored.', 'Anyone worth fighting around here?'], night: [], shoved: ['Watch it, courier.'], alarmed: ['Heh. Trouble.'] },
  },
  {
    id: 'aegis-agent',
    role: 'Halcyon Aegis agent',
    temperament: 'tough',
    walkSpeed: 2.2,
    dialogue: { greeting: [['Move along.']], night: [], grudge: [['That is assault on a Halcyon officer.']] },
    barks: { ambient: ['Perimeter secure.'], night: [], shoved: ['Hands off!'], alarmed: ['Report.'] },
  },
);

export const SLUMS_NPCS: NpcDefinition[] = [
  { id: 'npc-dez', name: 'Dez Okafor', archetype: 'gutter-saint', appearance: { skin: s(3), hair: 0x1b1b1b, top: 0x9b2335, bottom: 0x2b2b3a } },
  { id: 'npc-needle', name: 'Needle', archetype: 'gutter-saint', appearance: { skin: s(0), hair: 0xd7d7d7, top: 0x9b2335, bottom: 0x1f1f28 } },
  { id: 'npc-rafa', name: 'Rafa Duarte', archetype: 'gutter-saint', appearance: { skin: s(2), hair: 0x3a2412, top: 0x7d1f2c, bottom: 0x333344 } },
  { id: 'npc-marisol', name: 'Marisol Vey', archetype: 'street-vendor', appearance: { skin: s(1), hair: 0x5a2d0c, top: 0xf2a541, bottom: 0x3d405b } },
  { id: 'npc-ozzie', name: 'Ozzie Mbatha', archetype: 'street-vendor', appearance: { skin: s(4), hair: 0x111111, top: 0xe07a5f, bottom: 0x2f3e46 } },
  { id: 'npc-juno', name: 'Juno Park', archetype: 'night-worker', appearance: { skin: s(5), hair: 0x222222, top: 0x5c7a99, bottom: 0x22333b } },
  { id: 'npc-sable', name: 'Sable', archetype: 'night-worker', appearance: { skin: s(3), hair: 0x6b2fa0, top: 0x4a5568, bottom: 0x1a202c } },
  { id: 'npc-abernathy', name: 'Old Abernathy', archetype: 'old-timer', appearance: { skin: s(0), hair: 0xeeeeee, top: 0x6b705c, bottom: 0x3f4238 } },
  { id: 'npc-hollis', name: 'Hollis Crane', archetype: 'old-timer', appearance: { skin: s(2), hair: 0xbbbbbb, top: 0x8d6e63, bottom: 0x4e342e } },
  { id: 'npc-tamsin', name: 'Tamsin', archetype: 'street-kid', appearance: { skin: s(1), hair: 0xc1440e, top: 0x48cae4, bottom: 0x023e8a } },
  { id: 'npc-kit', name: 'Kit Ferro', archetype: 'street-kid', appearance: { skin: s(4), hair: 0x0b0b0b, top: 0x80ed99, bottom: 0x38a3a5 } },
  { id: 'npc-bram', name: 'Bram Kestrel', archetype: 'tinkerer', appearance: { skin: s(5), hair: 0xa0522d, top: 0x6d597a, bottom: 0x355070 } },
  { id: 'npc-wren', name: 'Wren Ishikawa', archetype: 'tinkerer', appearance: { skin: s(1), hair: 0x101010, top: 0x2a9d8f, bottom: 0x264653 } },
  { id: 'npc-priya', name: 'Priya Lund', archetype: 'night-worker', appearance: { skin: s(2), hair: 0x2b1a0e, top: 0xb5838d, bottom: 0x40394a } },
  { id: 'npc-aegis', name: 'Aegis Agent Kerr', archetype: 'aegis-agent', spawn: 'mission', stationary: true, appearance: { skin: s(0), hair: 0x1a1a1a, top: 0xe8ecf4, bottom: 0x2b2f3a } },
  { id: 'npc-vik', name: 'Vik Torrance', archetype: 'rival-trainer', spawn: 'mission', stationary: true, appearance: { skin: s(2), hair: 0xff6b35, top: 0x3a3a3a, bottom: 0x1c1c24 } },
];
