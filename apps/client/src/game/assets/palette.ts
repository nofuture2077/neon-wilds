/**
 * Art-direction palette: dusk-toned concrete and asphalt so neon reads
 * strongly at night. Every procedural asset pulls from here.
 */
export const PALETTE = {
  asphalt: 0x1f1b2a,
  asphaltLight: 0x29243a,
  asphaltDark: 0x17141f,
  laneYellow: 0xb8902c,
  zebra: 0xb9b3c9,
  concrete: 0x3b3548,
  concreteDark: 0x302a3c,
  concreteLight: 0x474056,
  curb: 0x6e6585,
  curbShadow: 0x15121c,
  curbNeon: 0xff3fa4,
  alley: 0x231e2b,
  alleyDark: 0x1a1621,
  grass: 0x1f3d2c,
  grassLight: 0x2a5238,
  grassDark: 0x173024,
  plaza: 0x4a3f4f,
  plazaDark: 0x3b3240,
  water: 0x1b2f5a,
  waterLight: 0x3a64a8,
  void: 0x07060c,
  outline: 0x0c0a12,
} as const;

/** Neon colours used for signs, windows and lamps. */
export const NEON = [0xff3fa4, 0x00e5ff, 0xffb347, 0xb37dff, 0x4fffb0, 0xff5d5d] as const;

/** Roof palettes, indexed by `Building.style`. */
export const ROOF_STYLES = [
  { base: 0x2c2638, edge: 0x4a4060, dark: 0x1f1a28, wall: 0x362c46, wallDark: 0x1d1726 },
  { base: 0x232029, edge: 0x3d3747, dark: 0x17151c, wall: 0x2e2839, wallDark: 0x18141e },
  { base: 0x3a2630, edge: 0x5c3b4a, dark: 0x281a21, wall: 0x442a37, wallDark: 0x24161d },
  { base: 0x1f2c34, edge: 0x33505c, dark: 0x151f25, wall: 0x25343e, wallDark: 0x141b21 },
  { base: 0x33293a, edge: 0x564663, dark: 0x231c29, wall: 0x3b3044, wallDark: 0x201a26 },
  { base: 0x29203a, edge: 0x4b3a6b, dark: 0x1c1628, wall: 0x312546, wallDark: 0x1a1426 },
] as const;

/** Old Town roofs and walls: slate, terracotta and moss over stone and brick. */
export const OLD_STYLES = [
  { base: 0x3a3440, edge: 0x5a5262, dark: 0x26222c, wall: 0x5a4c44, wallDark: 0x2e2620 },
  { base: 0x5a2e26, edge: 0x7a4436, dark: 0x3a1c16, wall: 0x6a5446, wallDark: 0x342820 },
  { base: 0x2e3a2e, edge: 0x46583f, dark: 0x1e281e, wall: 0x4e4a44, wallDark: 0x28241f },
  { base: 0x463a44, edge: 0x665666, dark: 0x2e262e, wall: 0x5e4a3e, wallDark: 0x30241e },
  { base: 0x4a2a22, edge: 0x6a3c30, dark: 0x301a14, wall: 0x54483e, wallDark: 0x2a221c },
  { base: 0x303436, edge: 0x4c5254, dark: 0x202426, wall: 0x605448, wallDark: 0x322a22 },
] as const;

export const CAR_COLORS = [0xe0559a, 0x8fb4d9, 0xe8b830, 0x3a3346, 0xc9c4d6, 0xc0563a] as const;

/** Character-creation choices. */
export const SKIN_TONES = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a1e] as const;
export const HAIR_COLORS = [0x111111, 0x5a3214, 0xa0522d, 0xe8c66a, 0xd7d7d7, 0xff3fa4] as const;
export const JACKET_COLORS = [0x00e5ff, 0xff3fa4, 0xffd23f, 0x7cff4f, 0xff6b35, 0xb37dff] as const;
export const PANTS_COLORS = [0x222233, 0x3d405b, 0x4a3b2a, 0x1f3b2f] as const;
