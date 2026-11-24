import { repTier } from '../content/factions';
import type { ProgressionState } from '../progression';
import type { NpcState } from '../state';
import type { EndingId } from './types';

/**
 * Ending epilogue assembled from world state (WORLD.md §5): the authored
 * ending text plus slides that reflect what this player actually did.
 */
const ENDINGS: Record<EndingId, { title: string; text: string; slums: string }> = {
  chorus: {
    title: 'The Chorus',
    text: 'The Glitchling sings into the grid, and the Hush becomes a harmony. Neon still burns over Vesper, but it no longer whispers "obey". Wildlings walk the streets in daylight; nobody quite knows the rules yet. That is the point.',
    slums: 'Fizzlets nest in the street lamps of Cinder Row. Mother Rook complains about the noise and feeds them anyway.',
  },
  'lights-out': {
    title: 'Lights Out',
    text: 'The controller dies in a shower of sparks, and every sign in the city goes dark at once. In the silence, the marsh comes back: Wildlings in the drains, on the roofs, in the subway. Vesper is free, and it is afraid.',
    slums: 'The Slums burn candles for a month. The Saints run the only working clinic for miles.',
  },
  'the-quiet': {
    title: 'The Quiet',
    text: 'You keep the controls. The upgrade goes live, and Vesper becomes the calmest city in the world. Nobody fights, nobody shouts, nobody runs. From the top of the Lumen Spire, it is very beautiful. From the street, it is very quiet.',
    slums: 'The Slums are orderly now. Halos glow behind every ear. Dez stopped arguing with anyone.',
  },
  'the-hollow': {
    title: 'The Hollow',
    text: 'The Resonant sings the marsh song into the grid, the way the stag sang it first. The Hush does not break; it loosens, note by note, like a knot untied. Over the following years the Outskirts grow back toward the city, and nobody in Vesper is quite sure where the forest ends any more.',
    slums: 'Moss grows over the Slums’ rooftops. Mother Rook swears the Fizzlets in the street lamps have started to hum along.',
  },
  'vargas-city': {
    title: "Varga's City",
    text: 'Ilse Varga takes the controls and the Trust takes the fall. Halcyon promises stewardship, transparency, safety. Licences for every Wildling, clinics on every corner, and a price tag on all of it.',
    slums: 'A gleaming Halcyon clinic replaces the Saint Ottilie Free Clinic. The Saints keep a back door open anyway.',
  },
};

export interface EpilogueInput {
  progression: ProgressionState;
  npcs: readonly NpcState[];
  /** Block controllers of the Slums. */
  slumsControllers: Record<string, string | null>;
  playerName: string;
}

export function buildEpilogue(id: EndingId, input: EpilogueInput): { title: string; slides: { heading: string; text: string }[] } {
  const e = ENDINGS[id];
  const p = input.progression;
  const saintsBlocks = Object.values(input.slumsControllers).filter((c) => c === 'saints').length;
  const halcyonBlocks = Object.values(input.slumsControllers).filter((c) => c === 'halcyon').length;
  const helped = input.npcs.filter((n) => n.memory.some((m) => m.kind === 'helped' && !m.secondhand)).map((n) => n.name);
  const glitch = p.flags['act1-sold']
    ? 'The Glitchling hums in a sealed room under Lumen Spire. Sometimes the lights on that floor flicker in time with it.'
    : p.party.some((w) => w.speciesId === 'glitchling') || p.storage.some((w) => w.speciesId === 'glitchling')
      ? `The Glitchling stays at ${input.playerName}'s side, flickering happily whenever the neon hums.`
      : 'Nobody knows where the Glitchling went. Couriers swear they still see it on rooftops.';
  const slides = [
    { heading: 'Vesper City', text: e.text },
    {
      heading: 'The Slums',
      text: `${e.slums} By the end, the Saints held ${saintsBlocks} block${saintsBlocks === 1 ? '' : 's'} and Halcyon ${halcyonBlocks}.`,
    },
    {
      heading: 'The Gutter Saints',
      text: `They remember ${input.playerName} as ${saintsLine(repTier(p.reputation.saints ?? 0))}.`,
    },
    { heading: 'Halcyon Biotech', text: halcyonLine(repTier(p.reputation.halcyon ?? 0), p.flags['wren-turned'] === true) },
    { heading: 'The Glitchling', text: glitch },
    {
      heading: 'Wildlings',
      text: `${p.index.caught.length} species caught, ${p.index.seen.length} seen. ${p.index.caught.length >= 10 ? 'The Index is the most complete in the city.' : 'Plenty still roam the rooftops.'}`,
    },
  ];
  if (helped.length) slides.push({ heading: 'People you helped', text: `${helped.slice(0, 5).join(', ')} will tell stories about the courier who showed up when it mattered.` });
  slides.push({ heading: 'The Wardens', text: wardensLine(repTier(p.reputation.wardens ?? 0)) });
  return { title: e.title, slides };
}

function saintsLine(tier: string): string {
  if (tier === 'Family' || tier === 'Trusted') return 'family — there is always a bowl of soup with their name on it';
  if (tier === 'Hunted' || tier === 'Distrusted') return 'the courier who sold out the strays';
  return 'a stranger who passed through';
}

function halcyonLine(tier: string, wrenTurned: boolean): string {
  const wren = wrenTurned ? ' Dr. Wren testifies before the city council; he finally sleeps at night.' : '';
  if (tier === 'Family' || tier === 'Trusted') return `Halcyon sends a fruit basket every year. Nobody eats it.${wren}`;
  if (tier === 'Hunted' || tier === 'Distrusted') return `Halcyon's lawyers are still drafting the lawsuit.${wren}`;
  return `Halcyon updates its brochures and carries on.${wren}`;
}

function wardensLine(tier: string): string {
  if (tier === 'Hunted' || tier === 'Distrusted') return 'Sergeant Pell keeps a photo of you pinned above his desk. Commissioner Kord quietly takes it down.';
  return 'Commissioner Kord closes the Lighting file and opens a much bigger one.';
}
