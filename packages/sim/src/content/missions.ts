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

  // ----------------------------------------------------------------------------------------------
  // Act I (continued) — the hum and the first decision.
  {
    id: 'the-hum',
    title: 'The Hum',
    summary: 'Bram Kestrel thinks the neon is doing something to the Wildlings. And to your Glitchling.',
    requires: ['last-run'],
    giver: 'npc-bram',
    offer: [
      "{player}! Your Glitchling — it flickers in time with the signs. Eighty hertz. Same as the hum I've been measuring for months.",
      "Meet me at Kasimir's. I want to put it next to my detector. For science. Mostly.",
    ],
    objectives: [
      {
        text: "Bring the Glitchling to Kasimir's Cables & Coils",
        kind: 'inspect',
        target: "Kasimir's Cables & Coils",
        onComplete: [
          {
            type: 'message',
            speaker: 'Bram Kestrel',
            pages: [
              'The needle hits the red line. The Glitchling shrieks — and every tube on the block bursts into sparks.',
              'The neon is broadcasting something. A frequency. The Glitchling hears it... and just answered it.',
            ],
          },
          { type: 'world-event', id: 'blackout' },
          { type: 'spawn-quest-wildling', species: 'neonyx', level: 8, tag: 'frenzy' },
        ],
      },
      { text: 'A frenzied Neonyx is loose in the blackout — calm it (battle or catch it)', kind: 'resolve-tag', target: 'frenzy' },
      {
        text: 'Tell Bram what happened',
        kind: 'talk',
        target: 'npc-bram',
        pages: ['When the grid went down, the Wildlings went *wild*. Like something holding them was let go.', 'Someone built the neon to keep them quiet, {player}. To keep everyone quiet.'],
      },
    ],
    rewards: [
      { type: 'set-flag', flag: 'knows-hum' },
      { type: 'give-item', item: 'med-spray', qty: 2 },
    ],
  },
  {
    id: 'everyone-wants-it',
    title: 'Everyone Wants It',
    summary: 'The Saints, Halcyon and your own conscience all have plans for the Glitchling.',
    requires: ['the-hum'],
    autoStart: true,
    onStart: [
      { type: 'spawn-npc', npc: 'npc-rook', near: "Mother Rook's Kitchen" },
      {
        type: 'message',
        speaker: 'Voicemail — Ilse Varga, Halcyon',
        pages: [
          '{player}, this is Ilse Varga. That Wildling is the most important thing my company has ever made. It is also dangerous.',
          'Bring it to any Halcyon kiosk. Fifteen hundred credits, no questions, no Wardens. Think about it.',
        ],
      },
    ],
    objectives: [
      {
        text: "Talk to Mother Rook at her kitchen",
        kind: 'talk',
        target: 'npc-rook',
        pages: [
          "So you're the courier everyone is whispering about. Sit. Eat. Then listen.",
          'Halcyon wants your little friend. The Saints will hide it if you ask — but hiding is all we can promise.',
        ],
        onComplete: [
          {
            type: 'choice',
            speaker: 'Mother Rook',
            pages: ['Whatever you choose, choose it with your whole chest. What will you do with the Glitchling?'],
            options: [
              {
                id: 'saints',
                label: 'Keep it with the Saints.',
                effects: [
                  { type: 'set-flag', flag: 'act1-saints' },
                  { type: 'reputation', faction: 'saints', delta: 15 },
                  { type: 'reputation', faction: 'halcyon', delta: -10 },
                  { type: 'message', speaker: 'Mother Rook', pages: ['Then you are family, {player}. Family gets fed, and family gets protected.'] },
                ],
              },
              {
                id: 'independent',
                label: 'Nobody owns it. We stay independent.',
                effects: [
                  { type: 'set-flag', flag: 'act1-independent' },
                  { type: 'reputation', faction: 'saints', delta: 3 },
                  { type: 'message', speaker: 'Mother Rook', pages: ['Hm. Free as a stray. The streets will test that, {player}.'] },
                ],
              },
              {
                id: 'sell',
                label: 'Sell it to Halcyon.',
                effects: [
                  { type: 'set-flag', flag: 'act1-sold' },
                  { type: 'take-wildling', species: 'glitchling' },
                  { type: 'give-money', amount: 1500 },
                  { type: 'give-wildling', species: 'scrapup', level: 8 },
                  { type: 'reputation', faction: 'saints', delta: -30 },
                  { type: 'reputation', faction: 'halcyon', delta: 20 },
                  { type: 'message', speaker: 'Mother Rook', pages: ['...I see. Get out of my kitchen.', 'Somewhere downtown, a capsule is being sealed again. Halcyon throws in a "licensed" Scrapup as a thank-you.'] },
                ],
              },
            ],
          },
        ],
      },
    ],
    rewards: [{ type: 'set-flag', flag: 'act1-done' }],
  },

  // ----------------------------------------------------------------------------------------------
  // Act II — faction arcs. Each yields a Hush Fragment.
  {
    id: 'tethered',
    title: 'Tethered',
    summary: 'Dez says Halcyon vans are collecting strays from the Slums. Nobody has seen one come back.',
    requires: ['everyone-wants-it'],
    blockedByFlags: ['act1-sold'],
    giver: 'npc-dez',
    offer: ["A Halcyon handler is loading strays into a van on Drain Street. Tonight.", "Mother Rook says you're the one who can stop him. Go."],
    onStart: [{ type: 'spawn-npc', npc: 'npc-handler', near: 'Paper Moon Pawn' }],
    objectives: [
      { text: 'Stop Handler Voss and free the strays', kind: 'defeat', target: 'npc-handler', onComplete: [{ type: 'despawn-npc', npc: 'npc-handler' }] },
      {
        text: 'Bring what you found to Mother Rook',
        kind: 'talk',
        target: 'npc-rook',
        pages: [
          'A chip behind the ear. Tuned to the neon. They are not *training* Wildlings, {player}. They are tuning them.',
          'And this page was in the van’s glovebox. Old Lighting schematics. Keep it. Something tells me there are more.',
        ],
        onComplete: [{ type: 'give-item', item: 'hush-fragment', qty: 1 }],
      },
    ],
    rewards: [
      { type: 'reputation', faction: 'saints', delta: 12 },
      { type: 'reputation', faction: 'halcyon', delta: -10 },
      { type: 'set-flag', flag: 'fragment-saints' },
    ],
  },
  {
    id: 'recovered-asset',
    title: 'Recovered Asset',
    summary: 'Someone inside Halcyon wants to talk — a scientist at the Wellness Clinic, Downtown.',
    requires: ['everyone-wants-it'],
    autoStart: true,
    onStart: [
      {
        type: 'message',
        speaker: 'Unknown sender',
        pages: ["You don't know me. I designed the capsule your Wildling hatched from.", 'Halcyon Wellness Clinic, Downtown. Ask for Dr. Wren. Come alone.'],
      },
    ],
    objectives: [
      {
        text: 'Find Dr. Tobias Wren at the Halcyon Wellness Clinic (Downtown)',
        kind: 'talk',
        target: 'npc-wren',
        pages: [
          'Project LANTERN. We put chips in Wildlings so they obey the grid. Ilse thinks it will end Wildling attacks.',
          "She doesn't know who's paying for it. The Vesper Civic Trust. Corvin Ashgrave. He wants to upgrade the Hush — to reach Halo earpieces. To reach *people*.",
        ],
        onComplete: [
          {
            type: 'choice',
            speaker: 'Dr. Tobias Wren',
            pages: ['I can give you the schematic page I stole. Or you can hand me to Halcyon security and collect a bonus. Your call.'],
            options: [
              {
                id: 'ally',
                label: 'Help me stop Ashgrave.',
                effects: [
                  { type: 'set-flag', flag: 'wren-turned' },
                  { type: 'give-item', item: 'hush-fragment', qty: 1 },
                  { type: 'message', speaker: 'Dr. Tobias Wren', pages: ['Thank you. I’ll feed you what I can from the inside. Be careful.'] },
                ],
              },
              {
                id: 'report',
                label: 'Report him to Halcyon.',
                effects: [
                  { type: 'set-flag', flag: 'wren-reported' },
                  { type: 'give-item', item: 'hush-fragment', qty: 1 },
                  { type: 'give-money', amount: 500 },
                  { type: 'reputation', faction: 'halcyon', delta: 15 },
                  { type: 'message', speaker: 'Aegis security', pages: ['Wren is led away. His schematic page ends up in your hands anyway — nobody thinks to check a courier.'] },
                ],
              },
            ],
          },
        ],
      },
    ],
    rewards: [{ type: 'set-flag', flag: 'fragment-halcyon' }],
  },

  {
    id: 'loyal-employee',
    title: 'Loyal Employee',
    summary: 'Halcyon wants the Saints\u2019 copy of the old schematics. Dez carries it everywhere.',
    requires: ['everyone-wants-it'],
    requiresFlags: ['act1-sold'],
    giver: 'npc-dt-guard1',
    offer: ['Ms. Varga appreciates your cooperation, courier. One more job.', 'The Gutter Saints have a page of old Lighting schematics. Their runner Dez carries it. Bring it to us.'],
    objectives: [
      {
        text: 'Get the schematic page from Dez (The Slums)',
        kind: 'talk',
        target: 'npc-dez',
        pages: ['You sold the Glitchling, and now you want *this*?', 'Take it. It\u2019s just paper. But the Slums will remember what you are.'],
        onComplete: [
          { type: 'give-item', item: 'hush-fragment', qty: 1 },
          { type: 'reputation', faction: 'saints', delta: -10 },
          { type: 'reputation', faction: 'halcyon', delta: 8 },
        ],
      },
    ],
    rewards: [{ type: 'give-money', amount: 400 }],
  },

  // ----------------------------------------------------------------------------------------------
  // Act III — the Quiet.
  {
    id: 'the-quiet',
    title: 'The Quiet',
    summary: 'Two fragments show the truth: the Lighting is a cage. Ashgrave waits at the Lumen Spire.',
    requires: ['everyone-wants-it'],
    requiresItems: { 'hush-fragment': 2 },
    autoStart: true,
    onStart: [
      { type: 'spawn-npc', npc: 'npc-ashgrave', near: 'Lumen Spire' },
      {
        type: 'message',
        speaker: 'Hush Fragments',
        pages: [
          'Laid side by side, the fragments complete the waveform: the Hush. Every neon tube in Vesper sings it.',
          'At the bottom, a signature: V.C.T. — Vesper Civic Trust. And a date for the "upgrade": tonight.',
        ],
      },
    ],
    objectives: [
      { text: 'Confront Corvin Ashgrave at the Lumen Spire (Downtown)', kind: 'defeat', target: 'npc-ashgrave' },
      {
        text: 'Decide the fate of the Hush',
        kind: 'talk',
        target: 'npc-ashgrave',
        pages: ['The grid controller is behind me. Every light in the city answers to it. Go on, courier — decide what kind of city this is.'],
        onComplete: [
          {
            type: 'choice',
            speaker: 'The Lumen Spire',
            pages: ['The controller hums. The Glitchling flickers, waiting.'],
            options: [
              {
                id: 'chorus',
                label: 'Retune the grid with the Glitchling — let humans and Wildlings share the city.',
                when: { notFlags: ['act1-sold'], anyOf: [{ flags: ['wren-turned'] }, { minRep: { saints: 30 } }] },
                effects: [{ type: 'ending', id: 'chorus' }],
              },
              { id: 'lights-out', label: 'Smash the controller. Lights out — let everything run free.', effects: [{ type: 'ending', id: 'lights-out' }] },
              {
                id: 'vargas-city',
                label: 'Hand the controls to Ilse Varga and Halcyon.',
                when: { minRep: { halcyon: 20 } },
                effects: [{ type: 'ending', id: 'vargas-city' }],
              },
              { id: 'the-quiet', label: 'Take the controls yourself. The city will be quiet. Obedient. Yours.', effects: [{ type: 'ending', id: 'the-quiet' }] },
            ],
          },
        ],
      },
    ],
    rewards: [{ type: 'set-flag', flag: 'story-complete' }],
  },
];
