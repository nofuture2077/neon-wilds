/** The eight elemental types of Vesper City (GDD §6.1). */
export const ELEMENTS = ['spark', 'blaze', 'tide', 'bloom', 'toxic', 'alloy', 'shade', 'rubble'] as const;
export type ElementType = (typeof ELEMENTS)[number];

const STRONG: Record<ElementType, ElementType[]> = {
  spark: ['tide', 'alloy'],
  blaze: ['bloom', 'alloy'],
  tide: ['blaze', 'rubble', 'toxic'],
  bloom: ['tide', 'rubble'],
  toxic: ['bloom', 'tide'],
  alloy: ['rubble', 'shade'],
  shade: ['spark', 'shade'],
  rubble: ['spark', 'blaze', 'toxic'],
};

const WEAK: Record<ElementType, ElementType[]> = {
  spark: ['spark', 'bloom', 'rubble'],
  blaze: ['blaze', 'tide', 'rubble'],
  tide: ['tide', 'bloom'],
  bloom: ['blaze', 'bloom', 'toxic', 'alloy'],
  toxic: ['toxic', 'rubble', 'alloy'],
  alloy: ['blaze', 'tide', 'alloy'],
  shade: ['alloy', 'blaze'],
  rubble: ['bloom', 'alloy'],
};

/** Multiplier for a single attacking type against a single defending type. */
export function typeMultiplier(attack: ElementType, defend: ElementType): number {
  if (STRONG[attack].includes(defend)) return 2;
  if (WEAK[attack].includes(defend)) return 0.5;
  return 1;
}

/** Combined multiplier against a (possibly dual-typed) defender. */
export function effectiveness(attack: ElementType, defender: readonly ElementType[]): number {
  return defender.reduce((m, t) => m * typeMultiplier(attack, t), 1);
}

export const ELEMENT_COLORS: Record<ElementType, number> = {
  spark: 0xffd23f,
  blaze: 0xff6b35,
  tide: 0x4fa3ff,
  bloom: 0x6fd36f,
  toxic: 0xb36bff,
  alloy: 0xa8b0c0,
  shade: 0x7a5cff,
  rubble: 0xb08a5a,
};
