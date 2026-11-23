import type { ItemDef } from '../creatures/model';

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  (
    [
      { id: 'tin-snare', name: 'Tin Snare', category: 'snare', price: 60, snare: { multiplier: 1 }, description: 'A capture can soldered from scrap. Gets the job done.' },
      { id: 'coil-snare', name: 'Coil Snare', category: 'snare', price: 150, snare: { multiplier: 1.5, bonusVs: ['spark', 'alloy'] }, description: 'Copper-wound snare. Extra effective on Spark and Alloy Wildlings.' },
      { id: 'lull-snare', name: 'Lull Snare', category: 'snare', price: 150, snare: { multiplier: 1, sleepingBonus: 3 }, description: 'Hums a lullaby. Much better against weakened or disoriented targets.' },
      { id: 'patch-kit', name: 'Patch Kit', category: 'medicine', price: 50, heal: 25, description: 'Bandages and antiseptic. Restores 25 HP.' },
      { id: 'med-spray', name: 'Med Spray', category: 'medicine', price: 140, heal: 70, description: 'Saint Ottilie’s own mix. Restores 70 HP.' },
      { id: 'cleanse-tab', name: 'Cleanse Tab', category: 'medicine', price: 80, cures: true, description: 'Cures any status condition.' },
      { id: 'courier-capsule', name: 'Sealed Capsule', category: 'key', price: 0, description: 'FRAGILE / DO NOT OPEN / DO NOT LOSE. It is warm, and it hums.' },
      { id: 'hush-fragment', name: 'Hush Fragment', category: 'key', price: 0, description: 'A page of the original Lighting schematics. The waveform printed on it is a perfect circle — a halo.' },
      { id: 'coin-tin', name: 'Marisol’s Coin Tin', category: 'key', price: 0, description: 'Dented, sticky, and full of small change.' },
    ] satisfies ItemDef[]
  ).map((i) => [i.id, i]),
);

/** Shop inventories keyed by shop id (referenced from building templates). */
export const SHOPS: Record<string, { name: string; items: string[] }> = {
  'paper-moon': { name: 'Paper Moon Pawn', items: ['tin-snare', 'coil-snare', 'lull-snare', 'patch-kit', 'cleanse-tab'] },
  'glow-noodle': { name: 'Glow Noodle', items: ['patch-kit', 'med-spray'] },
  'halcyon-store': { name: 'Halcyon Flagship Store', items: ['coil-snare', 'lull-snare', 'med-spray', 'cleanse-tab'] },
  'sky-noodle': { name: 'Sky Noodle Bar', items: ['med-spray', 'patch-kit'] },
};
