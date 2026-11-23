import type { MissionDef } from '../missions/types';

/** Handcrafted missions for Milestone 2 (WORLD.md §5, Act I opening). */
export const MISSIONS: MissionDef[] = [
  {
    id: 'last-run',
    title: 'Last Run',
    summary: 'One more delivery before the end of the shift. What could go wrong?',
    requires: [],
    autoStart: true,
    onStart: [
      {
        type: 'message',
        speaker: 'Co-op Dispatch',
        pages: [
          '{player}, you still on shift? Good. One last pickup tonight — swing by the Co-op on the Slums side.',
          'Pays triple. Don’t ask why it pays triple.',
        ],
      },
    ],
    objectives: [
      {
        text: 'Pick up the package at the Vesper Courier Co-op',
        kind: 'inspect',
        target: 'Vesper Courier Co-op',
        onComplete: [
          {
            type: 'message',
            speaker: 'Co-op Dispatch',
            pages: [
              'Sealed capsule. FRAGILE, DO NOT OPEN, DO NOT LOSE. Client wants it at the Halcyon Outreach Kiosk, here in the Slums.',
              'It’s warm. Capsules shouldn’t be warm. Anyway! Off you go.',
            ],
          },
          { type: 'give-item', item: 'courier-capsule', qty: 1 },
        ],
      },
      {
        text: 'Deliver the capsule to the Halcyon Outreach Kiosk',
        kind: 'inspect',
        target: 'Halcyon Outreach Kiosk',
        onComplete: [
          {
            type: 'message',
            speaker: 'Sealed Capsule',
            pages: [
              'The capsule shudders in your hands. Every neon sign on the street flickers at once.',
              'CRACK. Something small, dark and fizzing with static tumbles out — and stares straight at you.',
              'The Glitchling has bonded with you! (It does not seem interested in a refund.)',
            ],
          },
          { type: 'take-item', item: 'courier-capsule', qty: 1 },
          { type: 'give-wildling', species: 'glitchling', level: 5 },
          { type: 'give-item', item: 'tin-snare', qty: 3 },
          { type: 'spawn-npc', npc: 'npc-aegis', near: 'Halcyon Outreach Kiosk' },
        ],
      },
      {
        text: 'Deal with the Halcyon agent outside the kiosk',
        kind: 'defeat',
        target: 'npc-aegis',
        onComplete: [
          { type: 'despawn-npc', npc: 'npc-aegis' },
          {
            type: 'message',
            speaker: 'Glitchling',
            pages: ['*bzzzt* The Glitchling flickers proudly. Somewhere, a streetlight explodes.', 'You should get off the street. The Saints run a clinic nearby.'],
          },
        ],
      },
      {
        text: 'Lie low at the Saint Ottilie Free Clinic',
        kind: 'inspect',
        target: 'Saint Ottilie Free Clinic',
        onComplete: [
          {
            type: 'message',
            speaker: 'Needle',
            pages: [
              "Halcyon property, huh? It's got a heartbeat, so it's nobody's property. Saints' rules.",
              "Stay out of trouble, {player}. Or at least get good at it. Take these — you'll be catching your own Wildlings soon enough.",
            ],
          },
        ],
      },
    ],
    rewards: [
      { type: 'give-item', item: 'tin-snare', qty: 5 },
      { type: 'give-item', item: 'patch-kit', qty: 3 },
      { type: 'give-money', amount: 150 },
      { type: 'reputation', faction: 'saints', delta: 15 },
      { type: 'reputation', faction: 'halcyon', delta: -10 },
      { type: 'spawn-npc', npc: 'npc-vik', near: 'Paper Moon Pawn' },
    ],
  },
  {
    id: 'binbandit-chase',
    title: 'Binbandit Chase',
    summary: "A Binbandit made off with Marisol's coin tin. Get it back.",
    requires: ['last-run'],
    giver: 'npc-marisol',
    offer: [
      '{player}! Thank the Saints. A Binbandit just snatched my coin tin — a whole night of skewer money!',
      'It ran off into the alleys. Masked little thief. Catch it and I will feed you for a week.',
    ],
    onStart: [{ type: 'spawn-quest-wildling', species: 'binbandit', level: 5, tag: 'coin-thief' }],
    objectives: [
      { text: 'Track down the Binbandit with the coin tin (it hides in alleys)', kind: 'resolve-tag', target: 'coin-thief', onComplete: [{ type: 'give-item', item: 'coin-tin', qty: 1 }] },
      {
        text: 'Return the coin tin to Marisol',
        kind: 'talk',
        target: 'npc-marisol',
        pages: ['My tin! Sticky, dented, and every coin still inside. You are a saint, {player}. Not a Gutter Saint. A real one.'],
        onComplete: [
          { type: 'take-item', item: 'coin-tin', qty: 1 },
          { type: 'remember', npc: 'npc-marisol', kind: 'helped', important: true },
        ],
      },
    ],
    rewards: [
      { type: 'give-money', amount: 150 },
      { type: 'give-item', item: 'coil-snare', qty: 2 },
      { type: 'reputation', faction: 'saints', delta: 8 },
    ],
  },
  {
    id: 'vik-challenge',
    title: "Vik's Challenge",
    summary: 'A cocky pit fighter wants to test your Glitchling.',
    requires: ['last-run'],
    giver: 'npc-vik',
    offer: ["Hey, courier. You've got a Wildling everybody's whispering about.", "I want a fight. Talk to me again when you're ready — and bring more than one Wildling if you're smart."],
    objectives: [{ text: 'Defeat Vik Torrance outside Paper Moon Pawn', kind: 'defeat', target: 'npc-vik' }],
    rewards: [
      { type: 'give-item', item: 'lull-snare', qty: 2 },
      { type: 'reputation', faction: 'iron-chain', delta: 12 },
    ],
  },
];
