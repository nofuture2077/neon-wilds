/** The five competing factions plus the Wardens (law standing). See WORLD.md §3. */
export type FactionId = 'saints' | 'halcyon' | 'compact' | 'choir' | 'iron-chain' | 'wardens';

export interface FactionDef {
  id: FactionId;
  name: string;
  color: number;
  leader: string;
  motto: string;
  /** Factions that hold territory blocks in a district. */
  territorial: string[];
}

export const FACTIONS: FactionDef[] = [
  { id: 'saints', name: 'Gutter Saints', color: 0xc9d1e0, leader: 'Mother Rook', motto: "Nobody's coming to save us, so we save each other.", territorial: ['slums'] },
  { id: 'halcyon', name: 'Halcyon Biotech', color: 0x00e5ff, leader: 'Ilse Varga', motto: 'Progress is a gentler city.', territorial: ['slums'] },
  { id: 'compact', name: 'Tidewater Compact', color: 0x4fffb0, leader: 'Captain Oriel Danso', motto: 'Everything floats if the price is right.', territorial: [] },
  { id: 'choir', name: 'Verdant Choir', color: 0x6fd36f, leader: 'The Cantor', motto: 'The city was theirs first.', territorial: ['oldtown'] },
  { id: 'iron-chain', name: 'Iron Chain', color: 0xff6b35, leader: 'Brannoc Hale', motto: 'Strength is the only honest currency.', territorial: [] },
  { id: 'wardens', name: 'Vesper City Wardens', color: 0x4f7fff, leader: 'Commissioner Adaeze Kord', motto: 'Order, licensed and enforced.', territorial: [] },
];

export type RepTier = 'Hunted' | 'Distrusted' | 'Unknown' | 'Trusted' | 'Family';

export function repTier(rep: number): RepTier {
  if (rep <= -60) return 'Hunted';
  if (rep <= -20) return 'Distrusted';
  if (rep < 20) return 'Unknown';
  if (rep < 60) return 'Trusted';
  return 'Family';
}

/** Archetype → faction membership for NPCs. */
export const ARCHETYPE_FACTION: Record<string, FactionId> = {
  'gutter-saint': 'saints',
  'aegis-agent': 'halcyon',
  'aegis-guard': 'halcyon',
  'rival-trainer': 'iron-chain',
  smuggler: 'compact',
  'chain-enforcer': 'iron-chain',
  'choir-acolyte': 'choir',
  'tunnel-guide': 'compact',
};
