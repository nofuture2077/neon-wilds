/**
 * First-time tips (the in-game guide). Each tip fires once, the first time its
 * situation comes up, and is remembered in the save as a `tip:<id>` flag.
 * Pure data and a pure check; the simulation supplies the situation.
 */
export interface GuideSituation {
  flags: Readonly<Record<string, boolean>>;
  /** The opening mission is done and the player has a Wildling. */
  started: boolean;
  wildNearby: boolean;
  inWildBattle: boolean;
  snares: number;
  partyHurt: boolean;
  inVehicle: boolean;
  wanted: boolean;
  /** Region id the player is standing in. */
  region: string;
}

export interface Tip {
  id: string;
  title: string;
  text: string;
}

const DISTRICT_TIPS: Record<string, Omit<Tip, 'id'>> = {
  downtown: { title: 'Neon Downtown', text: 'Halcyon’s glass towers and the Lumen Spire. Expensive shops, Wardens on every corner, and Wattbugs swarming the signs at dusk.' },
  harbor: { title: 'Harbor District', text: 'Docks, containers and the Compact’s Night Market, which sells what nobody else will. Tide Wildlings by the water.' },
  industrial: { title: 'Industrial Zone', text: 'Foundries, scrapyards and the Furnace Pits. The Scrapyard Exchange buys stolen cars for parts. Tough Alloy and Blaze Wildlings.' },
  oldtown: { title: 'Old Town', text: 'Cobbles, gas lamps and the Verdant Choir. Look closely at old walls: the founders painted murals here. Shade Wildlings come out at night.' },
  outskirts: { title: 'The Outskirts', text: 'Where the city gives up and the forest comes back. Few people, rare Wildlings in the grass, and stories about a grove nobody can find.' },
};

/** The next tip to show, if any. Order matters: the most useful tip in the moment comes first. */
export function nextTip(s: GuideSituation): Tip | null {
  const candidates: Array<[boolean, Tip]> = [
    [
      s.inWildBattle,
      { id: 'wild-battle', title: 'Catching a Wildling', text: 'Weaken it with Fight, then choose Snare. The lower its health, the better your odds. Run gets you out of the battle.' },
    ],
    [s.started && s.wanted, { id: 'wanted', title: 'Wanted', text: 'The Wardens are after you. Break line of sight until they give up, or drive into Rustbucket Garage in the Slums for a respray (100₵).' }],
    [
      s.started && s.inVehicle,
      {
        id: 'driving',
        title: 'Wheels',
        text: 'Cars are about twice as fast as running, and Vesper is big. Express jobs on the Co-op board pay double if you make the deadline, and the Scrapyard Exchange (Industrial Zone) buys stolen cars for parts.',
      },
    ],
    [
      s.started && s.wildNearby,
      { id: 'catching', title: 'Wild Wildlings', text: 'That creature is a wild Wildling. Walk into it, or let it come to you, to start a battle. Sprinting scares the shy ones away.' },
    ],
    [
      s.started,
      {
        id: 'job-board',
        title: 'Finding work',
        text: 'Inspect the Vesper Courier Co-op for its job board: paid deliveries and requests. People and faction leaders across the city offer missions too. Your active mission and its marker are always on screen; the pause menu (Esc) lists the rest.',
      },
    ],
    [s.started && s.snares === 0, { id: 'snares-out', title: 'Out of Snares', text: 'Buy more at Paper Moon Pawn (Slums), Gaslight Antiques (Old Town) or the Night Market (Harbor District).' }],
    [s.started && s.partyHurt, { id: 'clinic', title: 'Healing', text: 'Saint Ottilie Free Clinic in the Slums heals your Wildlings for free. Patch Kits and Med Sprays work anywhere, even mid-battle.' }],
  ];
  for (const [when, tip] of candidates) if (when && !s.flags[`tip:${tip.id}`]) return tip;
  const d = DISTRICT_TIPS[s.region];
  if (s.started && d && !s.flags[`tip:district-${s.region}`]) return { id: `district-${s.region}`, ...d };
  return null;
}
