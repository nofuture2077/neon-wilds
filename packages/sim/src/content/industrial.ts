import type { DistrictDefinition } from '../world/district';
import type { NpcArchetype, NpcDefinition } from './types';

/** Industrial Zone (WORLD.md §2.3): smokestacks, rail yards, scrapyards and the Furnace Pits. */
export const INDUSTRIAL: DistrictDefinition = {
  id: 'industrial',
  name: 'Industrial Zone',
  style: 'industrial',
  blocksX: 4,
  blocksY: 3,
  blockW: 20,
  blockH: 16,
  roadW: 5,
  mergeChance: 0.5,
  parkBlock: { bx: 0, by: 2 },
  verticalStreets: ['Foundry Road', 'Rail Spur', 'Smelter Street', 'Gasworks Lane', 'Kettle Street'],
  horizontalStreets: ['Slag Row', 'Gutter Lane', 'Furnace Way', 'Coalyard Road'],
  exits: [{ to: 'slums', side: 'east', street: 'Gutter Lane' }],
  namedBuildings: [
    {
      name: 'The Furnace Pits',
      kind: 'bar',
      neon: 0xff6b35,
      description: 'Heat rolls out of the door with the roar of a crowd. Tonight’s card is chalked on a blast door.',
    },
    { name: 'Iron Chain Union Hall', kind: 'office', neon: 0xffb347, description: 'Banners from forty years of strikes. A Scrapjaw skull hangs over the door.' },
    { name: 'Halcyon Lab 7', kind: 'office', neon: 0x00e5ff, description: 'Razor wire, white walls, no windows. Something inside is humming at eighty hertz.' },
    {
      name: 'Scrapyard Exchange',
      kind: 'shop',
      neon: 0xd9b44a,
      service: { kind: 'shop', shopId: 'scrapyard' },
      description: 'Mountains of junk sorted by someone with a terrifying memory. "We buy coils. We sell coils. We are coils."',
    },
    { name: 'Rail Yard Canteen', kind: 'shop', neon: 0xff5d5d, description: 'Stew, coffee, and arguments about the pit card.' },
    { name: 'Foundry No. 3', kind: 'warehouse', neon: 0xffb347, mural: 'Above the furnace, blackened by soot: founders casting the first lamp posts. Into each mould they pour molten iron, and a single sleeping Wildling.',
      description: 'Still warm. A Kilnback sleeps against the furnace wall like it owns the place.' },
  ],
  residentialNames: ['Workers’ Terrace', 'Smelter Row Housing', 'Company Flats', 'Night-Shift Hostel'],
};

export const INDUSTRIAL_ARCHETYPES: NpcArchetype[] = [
  {
    id: 'factory-worker',
    role: 'factory worker',
    temperament: 'steady',
    walkSpeed: 2.2,
    dialogue: {
      greeting: [['Halcyon wants to automate Foundry 3. Hale says over his dead body. Hale is very much alive.'], ['Pit fights on Fridays. Every night is Friday down here.']],
      night: [['Shift change in ten. Nobody’s going home.']],
      grudge: [['Watch yourself, courier.']],
    },
    barks: { ambient: ['Union strong.', 'Back to the line.', 'Hot one tonight.'], night: ['Pit night!'], shoved: ['Hey!'], alarmed: ['What’s going on?'] },
  },
  {
    id: 'chain-enforcer',
    role: 'Iron Chain enforcer',
    temperament: 'tough',
    walkSpeed: 2.3,
    dialogue: {
      greeting: [['Respect is earned in the pit. Not out here.'], ['You want to fight? Furnace Pits. Sign the card.']],
      night: [['The crowd’s hungry tonight.']],
      grudge: [['Hale will hear you threw your weight around.']],
    },
    barks: { ambient: ['Keep moving.', 'Chain looks after its own.'], night: ['Fight night.'], shoved: ['Wrong person, friend.'], alarmed: ['Trouble!'] },
    factionDialogue: {
      friendly: [['Hale says you fight clean. That’s rare. Welcome, {player}.']],
      hostile: [['Hale’s got a long memory. So do I.']],
    },
  },
  {
    id: 'scrapper',
    role: 'scrapper',
    temperament: 'timid',
    walkSpeed: 2.1,
    dialogue: {
      greeting: [['Found a Scrapup in a washing machine once. It still follows me home.'], ['Lab 7 throws out the strangest things. Chips. Tiny ones. They hum.']],
      night: [['Best scrap is found at night. Fewer guards.']],
      grudge: [['Leave me alone, I’m just sorting.']],
    },
    barks: { ambient: ['Ooh, copper.', 'Scrap, scrap...', 'Mine!'], night: ['Shh.'], shoved: ['Ow!'], alarmed: ['Eep!'] },
  },
];

const S = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a1e] as const;
const s = (i: number) => S[i % S.length] as number;

export const INDUSTRIAL_NPCS: NpcDefinition[] = [
  { id: 'npc-strikebreaker', name: 'Contractor Voight', archetype: 'aegis-guard', spawn: 'mission', stationary: true, appearance: { skin: s(1), hair: 0x1a1a1a, top: 0xe8ecf4, bottom: 0x2b2f3a } },
  { id: 'npc-bookie', name: 'Crane', archetype: 'socialite', spawn: 'mission', stationary: true, appearance: { skin: s(0), hair: 0x111111, top: 0x6b705c, bottom: 0x1f1f28 } },
  { id: 'npc-hale', name: 'Brannoc Hale', archetype: 'chain-enforcer', stationary: true, post: 'Iron Chain Union Hall', appearance: { skin: s(3), hair: 0x3a2412, top: 0xff6b35, bottom: 0x2b2b3a } },
  { id: 'npc-sarr', name: 'Ines "Ledger" Sarr', archetype: 'chain-enforcer', stationary: true, post: 'The Furnace Pits', appearance: { skin: s(4), hair: 0x111111, top: 0x6b705c, bottom: 0x1f1f28 } },
  { id: 'npc-pit1', name: 'Pit Fighter Grit', archetype: 'chain-enforcer', spawn: 'mission', stationary: true, appearance: { skin: s(2), hair: 0xc1440e, top: 0x3a3a3a, bottom: 0x1c1c24 } },
  { id: 'npc-pit2', name: 'Pit Fighter Mags', archetype: 'chain-enforcer', spawn: 'mission', stationary: true, appearance: { skin: s(0), hair: 0xd7d7d7, top: 0x7d1f2c, bottom: 0x1c1c24 } },
  { id: 'npc-vik5', name: 'Vik Torrance', archetype: 'rival-trainer', spawn: 'mission', stationary: true, appearance: { skin: s(2), hair: 0xff6b35, top: 0x7d1f2c, bottom: 0x1c1c24 } },
  { id: 'npc-vik2', name: 'Vik Torrance', archetype: 'rival-trainer', spawn: 'mission', stationary: true, appearance: { skin: s(2), hair: 0xff6b35, top: 0x3a3a3a, bottom: 0x1c1c24 } },
  { id: 'npc-in-dale', name: 'Dale Okonkwo', archetype: 'factory-worker', appearance: { skin: s(4), hair: 0x111111, top: 0x5c7a99, bottom: 0x2f3e46 } },
  { id: 'npc-in-petra', name: 'Petra Novak', archetype: 'factory-worker', appearance: { skin: s(0), hair: 0xa0522d, top: 0x8d6e63, bottom: 0x22333b } },
  { id: 'npc-in-ash', name: 'Cinder Joe', archetype: 'scrapper', appearance: { skin: s(1), hair: 0x6b4a2a, top: 0x6b705c, bottom: 0x3d405b } },
  { id: 'npc-in-roza', name: 'Roza Kim', archetype: 'scrapper', appearance: { skin: s(5), hair: 0x111111, top: 0x2a9d8f, bottom: 0x264653 } },
];
