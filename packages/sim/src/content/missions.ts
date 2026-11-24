import type { MissionDef } from '../missions/types';

/** The founders' eight murals, by building (see `BuildingTemplate.mural`). */
export const MURALS = [
  'Bellfounders’ Tower',
  'Drowned Arcade',
  'Cistern Steps',
  'The Drowned Lantern',
  'Vesper Gazette',
  'The Drowned Bell',
  'Foundry No. 3',
  'Old Marsh Chapel',
] as const;
export const MURAL_COUNT = MURALS.length;

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

  {
    id: 'cargo',
    title: 'Cargo',
    summary: 'Captain Danso says Halcyon buys wild-caught Wildlings it claims to breed. Container 7 holds the proof.',
    requires: ['everyone-wants-it'],
    giver: 'npc-danso',
    offer: [
      'So you\u2019re the courier with the singing Wildling. Sit. I keep ledgers, {player}, and ledgers don\u2019t lie.',
      'Halcyon buys wild Wildlings from my crews by the hundred — then sells them as "lab-bred". Container 7 tonight. Get me its manifest.',
    ],
    onStart: [{ type: 'spawn-npc', npc: 'npc-dockwarden', near: 'Container Yard Office' }],
    objectives: [
      { text: 'Get past the Halcyon dock warden at the Container Yard Office', kind: 'defeat', target: 'npc-dockwarden', onComplete: [{ type: 'despawn-npc', npc: 'npc-dockwarden' }] },
      {
        text: 'Search the Container Yard Office',
        kind: 'inspect',
        target: 'Container Yard Office',
        onComplete: [
          {
            type: 'message',
            speaker: 'Container 7 manifest',
            pages: [
              '"42 wild Fizzlet — origin: SLUMS. Relabel: HALCYON-BRED. Tether on arrival."',
              'Clipped behind it: another page of the Lighting schematics, stamped V.C.T.',
            ],
          },
          { type: 'give-item', item: 'hush-fragment', qty: 1 },
        ],
      },
      {
        text: 'Bring the manifest to Captain Danso',
        kind: 'talk',
        target: 'npc-danso',
        pages: ['Read it to me. ...Forty-two. Relabelled. Tethered.', 'That manifest is worth a fortune — or a war. Your call, courier.'],
        onComplete: [
          {
            type: 'choice',
            speaker: 'Captain Oriel Danso',
            pages: ['What do we do with it?'],
            options: [
              {
                id: 'leverage',
                label: 'Keep it as leverage on Halcyon.',
                effects: [
                  { type: 'reputation', faction: 'compact', delta: 15 },
                  { type: 'give-money', amount: 600 },
                  { type: 'set-flag', flag: 'compact-leverage' },
                  { type: 'message', speaker: 'Captain Oriel Danso', pages: ['A wise investment. The Compact owes you, and the Compact pays its debts.'] },
                ],
              },
              {
                id: 'expose',
                label: 'Leak it to the Vesper Gazette.',
                effects: [
                  { type: 'reputation', faction: 'compact', delta: -5 },
                  { type: 'reputation', faction: 'halcyon', delta: -12 },
                  { type: 'reputation', faction: 'saints', delta: 6 },
                  { type: 'set-flag', flag: 'manifest-leaked' },
                  { type: 'message', speaker: 'Captain Oriel Danso', pages: ['Bad for business. Good for the city, maybe. I\u2019ll pretend I didn\u2019t see you.'] },
                ],
              },
            ],
          },
        ],
      },
    ],
    rewards: [{ type: 'set-flag', flag: 'fragment-compact' }],
  },

  {
    id: 'the-pit',
    title: 'The Pit',
    summary: 'Brannoc Hale says Halcyon is testing something in his pits. Fight your way to the final and see for yourself.',
    requires: ['everyone-wants-it'],
    giver: 'npc-hale',
    offer: [
      'Brannoc Hale. Iron Chain. I hear you fight with a Wildling that hums.',
      'Something\u2019s wrong in my pits. Fighters that don\u2019t flinch, don\u2019t bleed, don\u2019t stop. Win the card and bring me the prize — I want to see it up close.',
    ],
    onStart: [
      { type: 'spawn-npc', npc: 'npc-pit1', near: 'The Furnace Pits' },
      { type: 'spawn-npc', npc: 'npc-pit2', near: 'The Furnace Pits' },
      { type: 'spawn-npc', npc: 'npc-vik2', near: 'The Furnace Pits' },
    ],
    objectives: [
      { text: 'First bout: beat Pit Fighter Grit at the Furnace Pits', kind: 'defeat', target: 'npc-pit1' },
      { text: 'Semi-final: beat Pit Fighter Mags', kind: 'defeat', target: 'npc-pit2' },
      { text: 'Final: beat Vik Torrance', kind: 'defeat', target: 'npc-vik2' },
      {
        text: 'Bring the prize purse to Brannoc Hale at the Union Hall',
        kind: 'talk',
        target: 'npc-hale',
        pages: [
          'The prize is a tethered Scrapjaw in a cage. The chip behind its ear is Halcyon\u2019s. And look — the sponsor\u2019s envelope.',
          'Inside: a cheque from Halcyon Lab 7, and a page of old city schematics. They\u2019ve been paying my bookers to field their test subjects.',
        ],
        onComplete: [
          { type: 'give-item', item: 'hush-fragment', qty: 1 },
          {
            type: 'choice',
            speaker: 'Brannoc Hale',
            pages: ['The Chain needs that sponsor money, courier. Or it needs its dignity. Which is it?'],
            options: [
              {
                id: 'dignity',
                label: 'Tear up Halcyon\u2019s contract. Free the fighters.',
                effects: [
                  { type: 'reputation', faction: 'iron-chain', delta: 15 },
                  { type: 'reputation', faction: 'halcyon', delta: -10 },
                  { type: 'set-flag', flag: 'pits-freed' },
                  { type: 'message', speaker: 'Brannoc Hale', pages: ['Then the Chain stands with you. When you go up against whoever is behind this, call us.'] },
                ],
              },
              {
                id: 'money',
                label: 'Keep the money. Just stop the tethered fights.',
                effects: [
                  { type: 'reputation', faction: 'iron-chain', delta: 6 },
                  { type: 'give-money', amount: 700 },
                  { type: 'message', speaker: 'Brannoc Hale', pages: ['Pragmatic. I can respect that. Here — your cut.'] },
                ],
              },
            ],
          },
        ],
      },
    ],
    rewards: [
      { type: 'set-flag', flag: 'fragment-iron' },
      { type: 'spawn-npc', npc: 'npc-vik3', near: 'Glow Noodle' },
    ],
  },


  {
    id: 'founders-vault',
    title: 'The Founders’ Vault',
    summary: 'Brother Lark says the Old Town murals point to the Founders’ Vault — and that Thorn got there first.',
    requires: ['everyone-wants-it'],
    giver: 'npc-lark',
    offer: [
      'Peace, courier. Your Wildling sings in the right key. I can hear it from here.',
      'Before the Lighting, the founders painted the Wildlings on these walls — maps, the Cantor says, to a vault under the Civic Hall. The blueprints for the Hush are inside.',
      'But Thorn found the murals first. He wants more than the truth. Read the walls before he burns them.',
    ],
    onStart: [{ type: 'spawn-npc', npc: 'npc-thorn-acolyte', near: 'Founders’ Vault' }],
    objectives: [
      {
        text: 'Read the mural at Bellfounders’ Tower (Old Town)',
        kind: 'inspect',
        target: 'Bellfounders’ Tower',
        onComplete: [{ type: 'message', speaker: 'Mural', pages: ['A stag with branches for antlers stands in a marsh. Under it, a bell — and a waveform shaped like a ring.'] }],
      },
      {
        text: 'Read the mural in the Drowned Arcade',
        kind: 'inspect',
        target: 'Drowned Arcade',
        onComplete: [{ type: 'message', speaker: 'Mural', pages: ['Lamps on poles, each with a tiny Wildling curled asleep inside. The founders painted them smiling. Someone later scratched out the smiles.'] }],
      },
      {
        text: 'Read the mural on the Cistern Steps',
        kind: 'inspect',
        target: 'Cistern Steps',
        onComplete: [{ type: 'message', speaker: 'Mural', pages: ['Eight Wildlings in a circle, eyes pierced through the plaster. Through the holes: a draught, and the smell of old paper. "Under the Hall."'] }],
      },
      { text: 'Get past Thorn’s acolyte at the Founders’ Vault', kind: 'defeat', target: 'npc-thorn-acolyte', onComplete: [{ type: 'despawn-npc', npc: 'npc-thorn-acolyte' }] },
      {
        text: 'Open the Founders’ Vault',
        kind: 'inspect',
        target: 'Founders’ Vault',
        onComplete: [
          {
            type: 'message',
            speaker: 'Founders’ Vault',
            pages: [
              'Eight keyholes, eight carved Wildlings. The Glitchling hums at each one, and the bronze door sighs open.',
              'Inside: the original Lighting charter. The Hush was never a side effect — it is in the specification, signed by the first Civic Trust.',
              'On top of the dust, a fresh note in Thorn’s hand: "Substation 9. Midnight. Every lamp in Old Town and the Spire with it."',
            ],
          },
          { type: 'give-item', item: 'hush-fragment', qty: 1 },
          { type: 'spawn-npc', npc: 'npc-thorn', near: 'Old Town Substation' },
        ],
      },
      { text: 'Stop Thorn at the Old Town Substation', kind: 'defeat', target: 'npc-thorn' },
      {
        text: 'Bring Thorn before the Cantor at the Cathedral of Saint Verity',
        kind: 'talk',
        target: 'npc-cantor',
        pages: [
          'Thorn. And the courier with the Glitchling. And the founders’ own charter.',
          'So it is true. They built the cage on purpose. Three hundred years of lullabies.',
        ],
        onComplete: [
          { type: 'despawn-npc', npc: 'npc-thorn' },
          {
            type: 'choice',
            speaker: 'Seraphine Vale, the Cantor',
            pages: ['Thorn would have burned the grid tonight, and half of Old Town with it. Some of the Choir say he was right. What do you say, courier?'],
            options: [
              {
                id: 'restraint',
                label: 'The Choir must sing, not burn. Keep Thorn here and his charges with me.',
                effects: [
                  { type: 'reputation', faction: 'choir', delta: 15 },
                  { type: 'reputation', faction: 'wardens', delta: 5 },
                  { type: 'set-flag', flag: 'thorn-contained' },
                  { type: 'message', speaker: 'Seraphine Vale, the Cantor', pages: ['Then we sing. When the time comes to retune this city, the Choir will stand with you, {player}.'] },
                ],
              },
              {
                id: 'unleash',
                label: 'Thorn is right. Let the grid burn — just not tonight, and not here.',
                effects: [
                  { type: 'reputation', faction: 'choir', delta: 8 },
                  { type: 'reputation', faction: 'halcyon', delta: -10 },
                  { type: 'reputation', faction: 'wardens', delta: -8 },
                  { type: 'set-flag', flag: 'thorn-unleashed' },
                  { type: 'message', speaker: 'Thorn', pages: ['Not tonight. But soon. When you smash that controller, courier, every acolyte in Old Town will be cheering.'] },
                ],
              },
            ],
          },
        ],
      },
    ],
    rewards: [{ type: 'set-flag', flag: 'fragment-choir' }],
  },

  // ----------------------------------------------------------------------------------------------
  // Character arcs (WORLD.md §6).

  // Vik's rivalry: five battles in all, from rival to friend or bitter foe.
  {
    id: 'vik-noodles',
    title: 'Noodles, As Promised',
    summary: 'Vik is at Glow Noodle, pretending he isn’t waiting for you.',
    requires: ['the-pit'],
    giver: 'npc-vik3',
    offer: ['Oh. It’s you. I wasn’t waiting. I just like this stool.', 'Eat first, fight after. House rules. My house. Well, Mrs. Lin’s house.'],
    objectives: [
      { text: 'Spar with Vik outside Glow Noodle', kind: 'defeat', target: 'npc-vik3' },
      {
        text: 'Finish the noodles with Vik',
        kind: 'talk',
        target: 'npc-vik3',
        pages: [
          'Vik slurps loudly and doesn’t look at you. "Everyone at the Pits wants something from me. Hale wants a champion. The crowd wants blood."',
          '"You just... fight. And then you eat noodles. It’s weird. I like it."',
        ],
        onComplete: [
          {
            type: 'choice',
            speaker: 'Vik Torrance',
            pages: ['"So. Same time next week?"'],
            options: [
              {
                id: 'friend',
                label: 'Same time next week. Bring a better team.',
                effects: [
                  { type: 'set-flag', flag: 'vik-friend' },
                  { type: 'remember', npc: 'npc-vik3', kind: 'helped', important: true },
                  { type: 'message', speaker: 'Vik Torrance', pages: ['"...Yeah. Okay. Yeah." He grins like someone who has not done it in a while.'] },
                ],
              },
              {
                id: 'rival',
                label: 'Don’t get comfortable. I’m still better than you.',
                effects: [
                  { type: 'set-flag', flag: 'vik-rival' },
                  { type: 'message', speaker: 'Vik Torrance', pages: ['"Ha! There it is." He pays for both bowls and leaves without saying goodbye.'] },
                ],
              },
            ],
          },
        ],
      },
    ],
    rewards: [{ type: 'give-money', amount: 150 }],
  },
  {
    id: 'vik-high-ground',
    title: 'High Ground',
    summary: 'Vik wants a rematch on the Lumen Spire plaza. He says he has a sponsor now.',
    requires: ['vik-noodles'],
    giver: 'npc-vik3',
    offer: ['Downtown. Lumen Spire plaza. Tonight. I’ve got new gear, courier — a sponsor.', 'Don’t make that face. Everybody’s got a sponsor.'],
    onStart: [{ type: 'spawn-npc', npc: 'npc-vik4', near: 'Lumen Spire' }],
    objectives: [
      { text: 'Meet Vik on the Lumen Spire plaza (Downtown)', kind: 'defeat', target: 'npc-vik4' },
      {
        text: 'Ask Vik about his sponsor',
        kind: 'talk',
        target: 'npc-vik4',
        pages: [
          '"Halcyon. Lab 7. They want me in a commercial. And they want my team... upgraded. Little chips. Behind the ear."',
          '"They say the Wildlings won’t feel a thing. They say I’d never lose again."',
        ],
        onComplete: [
          {
            type: 'choice',
            speaker: 'Vik Torrance',
            pages: ['"Tell me I’m an idiot. Or don’t."'],
            options: [
              {
                id: 'talk-down',
                label: 'You saw the tethered fighters in the Pits. Don’t do that to your team.',
                when: { flags: ['vik-friend'] },
                effects: [
                  { type: 'set-flag', flag: 'vik-clean' },
                  { type: 'reputation', faction: 'halcyon', delta: -5 },
                  { type: 'message', speaker: 'Vik Torrance', pages: ['He’s quiet for a long time. Then he tears the Halcyon contract in half. "Hale’s going to love this."'] },
                ],
              },
              {
                id: 'let-him',
                label: 'Your team, your call.',
                effects: [
                  { type: 'set-flag', flag: 'vik-sponsored' },
                  { type: 'message', speaker: 'Vik Torrance', pages: ['"Right. My call." He pockets the contract. He doesn’t look happy about it.'] },
                ],
              },
            ],
          },
        ],
      },
    ],
    rewards: [{ type: 'despawn-npc', npc: 'npc-vik4' }],
  },
  {
    id: 'vik-title',
    title: 'Title Night',
    summary: 'The Furnace Pits championship: you against Vik, for the belt and for whatever comes after.',
    requires: ['vik-high-ground'],
    giver: 'npc-vik3',
    offer: ['Title night at the Pits. Hale says the winner keeps the belt.', 'Last time, courier. Everything I’ve got.'],
    onStart: [{ type: 'spawn-npc', npc: 'npc-vik5', near: 'The Furnace Pits' }],
    objectives: [
      { text: 'Fight Vik for the title at the Furnace Pits (Industrial Zone)', kind: 'defeat', target: 'npc-vik5' },
      {
        text: 'Talk to Vik after the fight',
        kind: 'talk',
        target: 'npc-vik5',
        pages: ['The crowd is still roaring. Vik sits on the edge of the pit with his team curled around him.'],
        onComplete: [
          {
            type: 'choice',
            speaker: 'Vik Torrance',
            pages: ['He looks up at you.'],
            options: [
              {
                id: 'friends',
                label: 'Good fight, partner.',
                when: { flags: ['vik-clean'] },
                effects: [
                  { type: 'set-flag', flag: 'vik-ally' },
                  { type: 'reputation', faction: 'iron-chain', delta: 10 },
                  { type: 'remember', npc: 'npc-vik5', kind: 'helped', important: true },
                  { type: 'message', speaker: 'Vik Torrance', pages: ['"Partner. Huh." He laughs. "When you go up against whoever’s behind those chips, I’m coming. Don’t argue."'] },
                ],
              },
              {
                id: 'bitter',
                label: 'Your chips didn’t help.',
                when: { notFlags: ['vik-clean'] },
                effects: [
                  { type: 'set-flag', flag: 'vik-bitter' },
                  { type: 'message', speaker: 'Vik Torrance', pages: ['"No. They didn’t." He doesn’t look at you, or at his team. "Get out of my pit."'] },
                ],
              },
            ],
          },
        ],
      },
    ],
    rewards: [{ type: 'give-money', amount: 600 }],
  },

  // Juno's courage.
  {
    id: 'juno-stray',
    title: 'Knock Knock',
    summary: 'Juno Park is hiding a stray Fizzlet, and Halcyon’s recall agents are going door to door.',
    requires: ['everyone-wants-it'],
    giver: 'npc-juno',
    offer: [
      'Please don’t tell anyone. There’s a Fizzlet in my kitchen. It was hurt, and it’s so small, and I...',
      'Halcyon is doing a "recall drive". An agent is working down the street toward my door. I can’t talk to people like that. Can you?',
    ],
    onStart: [{ type: 'spawn-npc', npc: 'npc-recall', near: 'Halcyon Outreach Kiosk' }],
    objectives: [
      { text: 'Stop the Halcyon recall agent near the Outreach Kiosk', kind: 'defeat', target: 'npc-recall' },
      {
        text: 'Tell Juno the street is clear',
        kind: 'talk',
        target: 'npc-juno',
        pages: ['Juno opens the door a crack. The Fizzlet is asleep in a teacup on her shoulder, sparking softly.', '"Is it over? What do I do now?"'],
        onComplete: [
          { type: 'despawn-npc', npc: 'npc-recall' },
          {
            type: 'choice',
            speaker: 'Juno Park',
            pages: ['"I could keep it. Or the Saints could take it somewhere safe. Or... I could just hand it in, before someone gets hurt."'],
            options: [
              {
                id: 'keep',
                label: 'Keep it. You’re braver than you think.',
                effects: [
                  { type: 'set-flag', flag: 'juno-brave' },
                  { type: 'reputation', faction: 'saints', delta: 6 },
                  { type: 'reputation', faction: 'halcyon', delta: -5 },
                  { type: 'remember', npc: 'npc-juno', kind: 'helped', important: true },
                  { type: 'message', speaker: 'Juno Park', pages: ['"Braver than I think." She tries the words out. "Okay. Okay! Its name is Teacup."'] },
                ],
              },
              {
                id: 'saints',
                label: 'Let the Saints take it somewhere safe.',
                effects: [
                  { type: 'set-flag', flag: 'juno-safe' },
                  { type: 'reputation', faction: 'saints', delta: 4 },
                  { type: 'remember', npc: 'npc-juno', kind: 'helped', important: true },
                  { type: 'message', speaker: 'Juno Park', pages: ['"That’s... sensible. Thank you." She looks relieved and a little sad.'] },
                ],
              },
              {
                id: 'surrender',
                label: 'Hand it in before you get hurt.',
                effects: [
                  { type: 'set-flag', flag: 'juno-afraid' },
                  { type: 'reputation', faction: 'halcyon', delta: 5 },
                  { type: 'message', speaker: 'Juno Park', pages: ['"Right. Of course." She closes the door very quietly.'] },
                ],
              },
            ],
          },
        ],
      },
    ],
    rewards: [],
  },

  // Bram's experiments.
  {
    id: 'bram-readings',
    title: 'Field Readings',
    summary: 'Bram Kestrel wants the hum measured at three very different places, to build something.',
    requires: ['everyone-wants-it'],
    giver: 'npc-bram',
    offer: [
      'The hum has a shape, courier. If I can measure it in three places — new grid, old grid, no grid — I can build its opposite.',
      'The Outreach Kiosk here, the old substation in Old Town, and that lighthouse out in the marsh. Hold the Glitchling up to each. It’ll know what to do.',
    ],
    objectives: [
      {
        text: 'Take a reading at the Halcyon Outreach Kiosk (The Slums)',
        kind: 'inspect',
        target: 'Halcyon Outreach Kiosk',
        onComplete: [{ type: 'message', speaker: 'Reading', pages: ['The Glitchling flickers in a tight, anxious rhythm. New grid: loud, clean, relentless.'] }],
      },
      {
        text: 'Take a reading at the Old Town Substation',
        kind: 'inspect',
        target: 'Old Town Substation',
        onComplete: [{ type: 'message', speaker: 'Reading', pages: ['Here the hum is older and slower, like something that has been singing so long it forgot the words.'] }],
      },
      {
        text: 'Take a reading at the Marsh Lighthouse (The Outskirts)',
        kind: 'inspect',
        target: 'Marsh Lighthouse',
        onComplete: [
          {
            type: 'message',
            speaker: 'Reading',
            pages: ['The Glitchling goes quiet, then hums a note of its own. Up the lighthouse wall, the fresh V.C.T. cable buzzes back at it — a backup transmitter, hidden out here.'],
          },
        ],
      },
      {
        text: 'Bring the readings to Bram Kestrel (The Slums)',
        kind: 'talk',
        target: 'npc-bram',
        pages: [
          'Bram spreads the readings across his workbench and laughs out loud. "It’s a ring. A closed loop. And every loop has a counter-note."',
          'He hands you a tuning fork made from a bent street-lamp bracket. "Strike it near the grid controller. Not to break it — to retune it."',
        ],
        onComplete: [
          { type: 'give-item', item: 'tuning-fork', qty: 1 },
          { type: 'set-flag', flag: 'bram-fork' },
          { type: 'remember', npc: 'npc-bram', kind: 'helped', important: true },
        ],
      },
    ],
    rewards: [{ type: 'give-money', amount: 200 }],
  },

  // The Harbor legend.
  {
    id: 'drowned-ferry',
    title: 'The Drowned Ferry',
    summary: 'Captain Danso has heard Saltmaw is real, and asleep in a ferry that sank at the old berths.',
    requires: ['cargo'],
    giver: 'npc-danso',
    offer: [
      'Every sailor in the Drowned Bell swears they’ve seen Saltmaw. Usually around the fourth drink.',
      'But my divers came back white as paper last week. Something huge, asleep in the old ferry wreck. Find out what. Quietly.',
    ],
    objectives: [
      {
        text: 'Ask around Fishmonger Row (Harbor District)',
        kind: 'inspect',
        target: 'Fishmonger Row',
        onComplete: [{ type: 'message', speaker: 'Old fishmonger', pages: ['"The Marisol? Sank at berth nine before the Lighting. Nets still come up torn there. Torn from the inside."'] }],
      },
      {
        text: 'Find the Marisol in the Compact’s ledgers',
        kind: 'inspect',
        target: 'Compact Counting House',
        onComplete: [{ type: 'message', speaker: 'Compact ledger', pages: ['"Ferry MARISOL — lost at berth 9, all hands safe. Cargo: none. Note in the margin, older ink: ‘Do not dredge. It is sleeping.’"'] }],
      },
      {
        text: 'Go down to berth nine behind the Container Yard Office',
        kind: 'inspect',
        target: 'Container Yard Office',
        onComplete: [
          { type: 'message', speaker: 'Berth nine', pages: ['The water at berth nine is very still. Then it isn’t. A shape like a sunken hull lifts out of the harbour — and opens its eyes.'] },
          { type: 'spawn-quest-wildling', species: 'saltmaw', level: 36, tag: 'saltmaw' },
        ],
      },
      {
        text: 'Face Saltmaw',
        kind: 'resolve-tag',
        target: 'saltmaw',
        onComplete: [
          {
            type: 'message',
            speaker: 'Saltmaw',
            pages: ['Saltmaw sinks back beneath the surface, slow and unhurried, as if it has seen everything it needed to see. A ring of bubbles spreads across the harbour.'],
          },
        ],
      },
      {
        text: 'Report to Captain Danso',
        kind: 'talk',
        target: 'npc-danso',
        pages: ['"Real. It’s real." Danso closes her ledger very gently. "Then the harbour has a guardian, and nobody — not Halcyon, not us — dredges berth nine. Ever."'],
        onComplete: [
          { type: 'reputation', faction: 'compact', delta: 12 },
          { type: 'set-flag', flag: 'saltmaw-found' },
        ],
      },
    ],
    rewards: [{ type: 'give-money', amount: 500 }],
  },

  // ----------------------------------------------------------------------------------------------
  // Faction questlines (WORLD.md §6): three missions per faction after its Act II arc, for players
  // the faction trusts, ending in a finale that makes the player one of its champions.

  // Gutter Saints.
  {
    id: 'saints-soup-run',
    title: 'Soup Run',
    summary: 'Dez needs the Saints’ soup and medicine taken round the Slums before the night shift starts.',
    requires: ['tethered'],
    minRep: { saints: 20 },
    giver: 'npc-dez',
    offer: ['Family helps family, and family carries soup. Three stops, courier.', 'Rustbucket Garage, Paper Moon Pawn, and the clinic. Don’t spill.'],
    objectives: [
      { text: 'Drop soup at Rustbucket Garage', kind: 'inspect', target: 'Rustbucket Garage', onComplete: [{ type: 'message', speaker: 'Rustbucket Garage', pages: ['The mechanics cheer. Somebody’s Scrapup tries to drink straight from the pot.'] }] },
      { text: 'Drop soup at Paper Moon Pawn', kind: 'inspect', target: 'Paper Moon Pawn', onComplete: [{ type: 'message', speaker: 'Paper Moon Pawn', pages: ['The pawnbroker pretends not to want any, then takes two bowls.'] }] },
      { text: 'Bring the medicine to Saint Ottilie Free Clinic', kind: 'inspect', target: 'Saint Ottilie Free Clinic', onComplete: [{ type: 'message', speaker: 'Needle', pages: ['"Bandages, antiseptic, and... is this soup? Bless you."'] }] },
      { text: 'Report back to Dez', kind: 'talk', target: 'npc-dez', pages: ['"Every stop fed. You know what that is, courier? That’s a neighbourhood."'], onComplete: [{ type: 'reputation', faction: 'saints', delta: 6 }] },
    ],
    rewards: [{ type: 'give-item', item: 'patch-kit', qty: 3 }],
  },
  {
    id: 'saints-grey-van',
    title: 'The Grey Van',
    summary: 'A Halcyon capture van is cruising the Slums at night, scooping up strays. Dez wants it stopped.',
    requires: ['saints-soup-run'],
    minRep: { saints: 25 },
    giver: 'npc-dez',
    offer: ['Grey van, no plates, Halcyon tyres. It parks by the Outreach Kiosk and waits for strays.', 'Stop the driver, then calm whatever they caught before it bolts into traffic.'],
    onStart: [{ type: 'spawn-npc', npc: 'npc-van-driver', near: 'Halcyon Outreach Kiosk' }],
    objectives: [
      {
        text: 'Stop the van driver near the Halcyon Outreach Kiosk',
        kind: 'defeat',
        target: 'npc-van-driver',
        onComplete: [
          { type: 'despawn-npc', npc: 'npc-van-driver' },
          { type: 'message', speaker: 'The grey van', pages: ['The back doors bang open. A terrified Cindertail bolts out, sparks flying from its tail.'] },
          { type: 'spawn-quest-wildling', species: 'cindertail', level: 14, tag: 'van-stray' },
        ],
      },
      { text: 'Calm the frightened Cindertail', kind: 'resolve-tag', target: 'van-stray' },
      { text: 'Tell Dez the van is empty', kind: 'talk', target: 'npc-dez', pages: ['"One van down. They’ll send another. And we’ll be here."'], onComplete: [{ type: 'reputation', faction: 'saints', delta: 6 }, { type: 'reputation', faction: 'halcyon', delta: -6 }] },
    ],
    rewards: [{ type: 'give-money', amount: 250 }],
  },
  {
    id: 'saints-hold-the-line',
    title: 'Hold the Line',
    summary: 'Halcyon is sending an Aegis squad to clear Mother Rook’s Kitchen. The Saints will not move.',
    requires: ['saints-grey-van'],
    minRep: { saints: 30 },
    giver: 'npc-dez',
    offer: ['They’re coming for the Kitchen, courier. Eviction notice, Aegis escort, the whole show.', 'Mother Rook won’t leave. So we stand in front of her.'],
    onStart: [{ type: 'spawn-npc', npc: 'npc-aegis-captain', near: "Mother Rook's Kitchen" }, { type: 'spawn-npc', npc: 'npc-rook', near: "Mother Rook's Kitchen" }],
    objectives: [
      { text: 'Face the Aegis captain at Mother Rook’s Kitchen', kind: 'defeat', target: 'npc-aegis-captain', onComplete: [{ type: 'despawn-npc', npc: 'npc-aegis-captain' }] },
      {
        text: 'Talk to Mother Rook',
        kind: 'talk',
        target: 'npc-rook',
        pages: ['Mother Rook ladles soup into a bowl and puts it in your hands. "Nobody’s coming to save us, {player}. So we saved each other. You were part of that."', '"There’s a seat at this table with your name scratched into it. That’s Saints’ law."'],
        onComplete: [{ type: 'set-flag', flag: 'saints-champion' }, { type: 'reputation', faction: 'saints', delta: 15 }],
      },
    ],
    rewards: [{ type: 'give-item', item: 'med-spray', qty: 3 }, { type: 'give-money', amount: 400 }],
  },

  // Halcyon Biotech.
  {
    id: 'halcyon-field-test',
    title: 'Field Test',
    summary: 'Halcyon wants sensor readings collected from its outposts across the city.',
    requires: ['recovered-asset'],
    minRep: { halcyon: 20 },
    giver: 'npc-dt-guard1',
    offer: ['Ms. Varga is pleased with you, courier. Routine work: sensor packs from three outposts.', 'The Field Camp in the Outskirts, Halcyon Shipping at the harbour, and Lab 7. Don’t open them.'],
    objectives: [
      { text: 'Collect the sensor pack at the Halcyon Field Camp (The Outskirts)', kind: 'inspect', target: 'Halcyon Field Camp' },
      { text: 'Collect the sensor pack at Halcyon Shipping (Harbor District)', kind: 'inspect', target: 'Halcyon Shipping' },
      { text: 'Collect the sensor pack at Halcyon Lab 7 (Industrial Zone)', kind: 'inspect', target: 'Halcyon Lab 7' },
      { text: 'Deliver the sensor packs to Aegis Guard Park', kind: 'talk', target: 'npc-dt-guard1', pages: ['"All three, sealed. Good. You’d be surprised how many couriers get curious."'], onComplete: [{ type: 'reputation', faction: 'halcyon', delta: 6 }] },
    ],
    rewards: [{ type: 'give-money', amount: 350 }],
  },
  {
    id: 'halcyon-rogue-asset',
    title: 'Rogue Asset',
    summary: 'A chipped Gearhound has slipped its tether. Halcyon wants it recovered before the Gazette notices.',
    requires: ['halcyon-field-test'],
    minRep: { halcyon: 25 },
    giver: 'npc-dt-guard1',
    offer: ['Asset GH-114 has gone off-network. Chipped Gearhound, very fast, very confused.', 'It was last seen near here. Bring it down gently. It’s company property, and it’s scared.'],
    onStart: [{ type: 'spawn-quest-wildling', species: 'gearhound', level: 24, tag: 'rogue-asset' }],
    objectives: [
      { text: 'Recover the rogue Gearhound', kind: 'resolve-tag', target: 'rogue-asset' },
      { text: 'Report to Aegis Guard Park', kind: 'talk', target: 'npc-dt-guard1', pages: ['"Recovered. Quietly. Ms. Varga wants to meet you in person, courier. That doesn’t happen often."'], onComplete: [{ type: 'reputation', faction: 'halcyon', delta: 6 }] },
    ],
    rewards: [{ type: 'give-item', item: 'coil-snare', qty: 3 }],
  },
  {
    id: 'halcyon-audit',
    title: 'Internal Audit',
    summary: 'Ilse Varga suspects the Vesper Civic Trust has a man inside Halcyon. She wants you to find him.',
    requires: ['halcyon-rogue-asset'],
    minRep: { halcyon: 30 },
    giver: 'npc-dt-guard1',
    offer: ['Ms. Varga will see you at the Wellness Clinic. Go now.'],
    onStart: [{ type: 'spawn-npc', npc: 'npc-varga', near: 'Halcyon Wellness Clinic' }, { type: 'spawn-npc', npc: 'npc-auditor', near: 'Halcyon Flagship Store' }],
    objectives: [
      {
        text: 'Meet Ilse Varga at the Halcyon Wellness Clinic',
        kind: 'talk',
        target: 'npc-varga',
        pages: ['"Someone has been rewriting LANTERN’s specifications at night. Not my engineers. An auditor the Trust insisted on: Mr. Pell."', '"He’s at the Flagship Store. Find out what he’s carrying."'],
      },
      { text: 'Confront the auditor at the Halcyon Flagship Store', kind: 'defeat', target: 'npc-auditor', onComplete: [{ type: 'despawn-npc', npc: 'npc-auditor' }, { type: 'message', speaker: 'Pell’s ledger', pages: ['Pages of changes to LANTERN, each signed V.C.T. The last line: "Phase two: Halo earpieces. Citizens, not Wildlings."'] }] },
      {
        text: 'Bring Pell’s ledger to Ilse Varga',
        kind: 'talk',
        target: 'npc-varga',
        pages: ['Varga reads the last page twice. For a moment she looks very tired. "I built LANTERN to stop Wildling attacks. Not this."'],
        onComplete: [
          {
            type: 'choice',
            speaker: 'Ilse Varga',
            pages: ['"I can bury this and keep Halcyon safe. Or I can stand against the Trust and lose everything. What would you do?"'],
            options: [
              {
                id: 'stand',
                label: 'Stand against the Trust. People will follow you.',
                effects: [{ type: 'set-flag', flag: 'varga-turned' }, { type: 'set-flag', flag: 'halcyon-champion' }, { type: 'reputation', faction: 'halcyon', delta: 15 }, { type: 'message', speaker: 'Ilse Varga', pages: ['"Then I’ll need someone I trust at the Spire when it happens. That’s you, {player}."'] }],
              },
              {
                id: 'bury',
                label: 'Protect the company. Bury it.',
                effects: [{ type: 'set-flag', flag: 'halcyon-champion' }, { type: 'reputation', faction: 'halcyon', delta: 10 }, { type: 'give-money', amount: 800 }, { type: 'message', speaker: 'Ilse Varga', pages: ['"Pragmatic." She locks the ledger in a drawer. "Halcyon remembers its friends."'] }],
              },
            ],
          },
        ],
      },
    ],
    rewards: [{ type: 'despawn-npc', npc: 'npc-varga' }],
  },

  // Tidewater Compact.
  {
    id: 'compact-tunnel-run',
    title: 'Tunnel Run',
    summary: 'Danso wants a package moved through the Old Town tunnels without the Wardens noticing.',
    requires: ['cargo'],
    minRep: { compact: 20 },
    giver: 'npc-danso',
    offer: ['A crate of medicine for the Choir, through the tunnels. The Wardens tax everything that moves above ground.', 'Pick it up at the Night Market, take it to the Tunnel Guides’ Guild in Old Town. No questions, no detours.'],
    objectives: [
      { text: 'Pick up the crate at the Night Market', kind: 'inspect', target: 'Night Market' },
      { text: 'Deliver it to the Tunnel Guides’ Guild (Old Town)', kind: 'inspect', target: 'Tunnel Guides’ Guild', onComplete: [{ type: 'message', speaker: 'Tunnel Guides’ Guild', pages: ['A guide signs for the crate with an anchor and a wink. "Through the old cistern. Wardens never look down."'] }] },
      { text: 'Report to Captain Danso', kind: 'talk', target: 'npc-danso', pages: ['"Clean run. The Choir owes us a favour now, and I collect favours."'], onComplete: [{ type: 'reputation', faction: 'compact', delta: 6 }, { type: 'reputation', faction: 'choir', delta: 3 }] },
    ],
    rewards: [{ type: 'give-money', amount: 300 }],
  },
  {
    id: 'compact-customs',
    title: 'Customs',
    summary: 'A Warden customs officer has impounded a Compact boat at Halcyon’s berth. Danso wants it back.',
    requires: ['compact-tunnel-run'],
    minRep: { compact: 25 },
    giver: 'npc-danso',
    offer: ['Officer Brack impounded the Gull, berth four, outside Halcyon Shipping. Halcyon tipped him off.', 'Convince him otherwise. Firmly.'],
    onStart: [{ type: 'spawn-npc', npc: 'npc-customs', near: 'Halcyon Shipping' }],
    objectives: [
      { text: 'Deal with Officer Brack at Halcyon Shipping', kind: 'defeat', target: 'npc-customs', onComplete: [{ type: 'despawn-npc', npc: 'npc-customs' }, { type: 'reputation', faction: 'wardens', delta: -5 }] },
      { text: 'Tell Captain Danso the Gull is free', kind: 'talk', target: 'npc-danso', pages: ['"The Gull sails tonight. Halcyon will be furious. Good."'], onComplete: [{ type: 'reputation', faction: 'compact', delta: 6 }] },
    ],
    rewards: [{ type: 'give-money', amount: 400 }],
  },
  {
    id: 'compact-auction',
    title: 'The Midnight Auction',
    summary: 'Halcyon’s buyer is bidding for a crate of tethered Wildlings at the Night Market. Outbid him the Compact way.',
    requires: ['compact-customs'],
    minRep: { compact: 30 },
    giver: 'npc-danso',
    offer: ['The Night Market auction is tonight. Halcyon sent a buyer for lot nine: twelve tethered Wildlings.', 'We don’t sell living things that can’t say no. Make sure he goes home empty-handed.'],
    onStart: [{ type: 'world-event', id: 'night-market' }, { type: 'spawn-npc', npc: 'npc-bidder', near: 'Night Market' }],
    objectives: [
      { text: 'Beat Halcyon’s buyer at the Night Market', kind: 'defeat', target: 'npc-bidder', onComplete: [{ type: 'despawn-npc', npc: 'npc-bidder' }] },
      {
        text: 'Bring lot nine to Captain Danso',
        kind: 'talk',
        target: 'npc-danso',
        pages: ['Danso cuts the tether chips out herself, one by one. "Twelve free Wildlings and one very angry corporation. Best night’s work in years."', '"You’re crew now, {player}. Compact crew. That means something on every dock from here to the marsh."'],
        onComplete: [{ type: 'set-flag', flag: 'compact-champion' }, { type: 'reputation', faction: 'compact', delta: 15 }, { type: 'reputation', faction: 'halcyon', delta: -8 }],
      },
    ],
    rewards: [{ type: 'give-money', amount: 800 }],
  },

  // Verdant Choir.
  {
    id: 'choir-pilgrimage',
    title: 'Pilgrimage',
    summary: 'Brother Lark asks you to walk the pilgrims’ road from the Cathedral to the marsh.',
    requires: ['founders-vault'],
    minRep: { choir: 20 },
    giver: 'npc-lark',
    offer: ['Every acolyte walks the road once: Cathedral, Waystation, Marsh Chapel. You’ve done more for us than most of them.', 'Walk it. Listen. Come back and tell me what you heard.'],
    objectives: [
      { text: 'Begin at the Cathedral of Saint Verity', kind: 'inspect', target: 'Cathedral of Saint Verity' },
      { text: 'Rest at the Choir Waystation (The Outskirts)', kind: 'inspect', target: 'Choir Waystation' },
      { text: 'End at the Old Marsh Chapel', kind: 'inspect', target: 'Old Marsh Chapel', onComplete: [{ type: 'message', speaker: 'Old Marsh Chapel', pages: ['No neon here. Just frogs, wind in the reeds, and under it all a low round note, like a bell that never stopped ringing.'] }] },
      { text: 'Tell Brother Lark what you heard', kind: 'talk', target: 'npc-lark', pages: ['"A bell that never stopped. Yes." Lark smiles. "Most pilgrims only hear frogs."'], onComplete: [{ type: 'reputation', faction: 'choir', delta: 6 }] },
    ],
    rewards: [{ type: 'give-item', item: 'cleanse-tab', qty: 3 }],
  },
  {
    id: 'choir-open-cages',
    title: 'Open the Cages',
    summary: 'Halcyon’s field team in the Outskirts has filled its cages. The Choir wants them empty.',
    requires: ['choir-pilgrimage'],
    minRep: { choir: 25 },
    giver: 'npc-lark',
    offer: ['The Field Camp caught a family of Fernfoxes this week. Cages, tags, chips.', 'No fire, no bombs — I am not Thorn. Just open the cages.'],
    onStart: [{ type: 'spawn-npc', npc: 'npc-field-boss', near: 'Halcyon Field Camp' }],
    objectives: [
      { text: 'Get past the field team leader at the Halcyon Field Camp', kind: 'defeat', target: 'npc-field-boss', onComplete: [{ type: 'despawn-npc', npc: 'npc-field-boss' }] },
      { text: 'Open the cages', kind: 'inspect', target: 'Halcyon Field Camp', onComplete: [{ type: 'message', speaker: 'Halcyon Field Camp', pages: ['The latches are stiff. The Fernfoxes are not. They are gone into the reeds before the last cage door stops swinging.'] }, { type: 'reputation', faction: 'halcyon', delta: -8 }] },
      { text: 'Tell Brother Lark', kind: 'talk', target: 'npc-lark', pages: ['"Gently done. The Cantor will want to see you."'], onComplete: [{ type: 'reputation', faction: 'choir', delta: 6 }] },
    ],
    rewards: [{ type: 'give-money', amount: 300 }],
  },
  {
    id: 'choir-canticle',
    title: 'Canticle',
    summary: 'The Wardens are raiding the Cathedral. The Cantor will not stop the service.',
    requires: ['choir-open-cages'],
    minRep: { choir: 30 },
    giver: 'npc-lark',
    offer: ['Wardens at the Cathedral doors. Commissioner Kord calls it a "crackdown on unlicensed gatherings".', 'The Cantor is still singing. Please, go.'],
    onStart: [{ type: 'spawn-npc', npc: 'npc-raid-captain', near: 'Cathedral of Saint Verity' }],
    objectives: [
      { text: 'Turn back the Warden raid at the Cathedral', kind: 'defeat', target: 'npc-raid-captain', onComplete: [{ type: 'despawn-npc', npc: 'npc-raid-captain' }, { type: 'reputation', faction: 'wardens', delta: -6 }] },
      {
        text: 'Speak with the Cantor',
        kind: 'talk',
        target: 'npc-cantor',
        pages: ['The Cantor finishes the verse before she turns around. "They will come back. They always do. But tonight the song was not interrupted."', '"Walk in green, {player}. You are one of the Choir now, whatever you believe."'],
        onComplete: [{ type: 'set-flag', flag: 'choir-champion' }, { type: 'reputation', faction: 'choir', delta: 15 }],
      },
    ],
    rewards: [{ type: 'give-item', item: 'lull-snare', qty: 3 }],
  },

  // Iron Chain.
  {
    id: 'chain-picket-line',
    title: 'Picket Line',
    summary: 'Halcyon wants to automate Foundry No. 3. Hale wants to know which way the workers lean.',
    requires: ['the-pit'],
    minRep: { 'iron-chain': 20 },
    giver: 'npc-hale',
    offer: ['Halcyon’s offering the foundry robots and the workers a payout. Some of them want to take it.', 'Talk to the canteen and the foundry floor. Then tell me if we strike.'],
    objectives: [
      { text: 'Listen at the Rail Yard Canteen', kind: 'inspect', target: 'Rail Yard Canteen', onComplete: [{ type: 'message', speaker: 'Rail Yard Canteen', pages: ['"Robots don’t pay rent in Workers’ Terrace," says one. "Payout pays my daughter’s clinic," says another. Nobody finishes their stew.'] }] },
      { text: 'Walk the floor of Foundry No. 3', kind: 'inspect', target: 'Foundry No. 3', onComplete: [{ type: 'message', speaker: 'Foundry No. 3', pages: ['Under the furnace mural, the night shift has chalked a single word: STAY.'] }] },
      {
        text: 'Report to Brannoc Hale at the Union Hall',
        kind: 'talk',
        target: 'npc-hale',
        pages: ['"Well? What does my foundry want?"'],
        onComplete: [
          {
            type: 'choice',
            speaker: 'Brannoc Hale',
            pages: ['"Strike, and Halcyon brings in strikebreakers. Deal, and we keep half the jobs and lose the other half."'],
            options: [
              { id: 'strike', label: 'Strike. The floor wants to stay.', effects: [{ type: 'set-flag', flag: 'foundry-strike' }, { type: 'reputation', faction: 'iron-chain', delta: 8 }, { type: 'reputation', faction: 'halcyon', delta: -6 }] },
              { id: 'deal', label: 'Take the deal. Keep the clinic money coming.', effects: [{ type: 'set-flag', flag: 'foundry-deal' }, { type: 'reputation', faction: 'iron-chain', delta: 4 }, { type: 'give-money', amount: 300 }] },
            ],
          },
        ],
      },
    ],
    rewards: [],
  },
  {
    id: 'chain-strikebreakers',
    title: 'Strikebreakers',
    summary: 'Halcyon has hired contractors to clear the foundry gates. The Chain needs a fighter at the line.',
    requires: ['chain-picket-line'],
    minRep: { 'iron-chain': 25 },
    giver: 'npc-hale',
    offer: ['Contractors at the foundry gate, with Halcyon dogs. Strike or deal, they’re pushing.', 'Stand at the line with us.'],
    onStart: [{ type: 'spawn-npc', npc: 'npc-strikebreaker', near: 'Foundry No. 3' }],
    objectives: [
      { text: 'Hold the gate of Foundry No. 3', kind: 'defeat', target: 'npc-strikebreaker', onComplete: [{ type: 'despawn-npc', npc: 'npc-strikebreaker' }] },
      { text: 'Report to Brannoc Hale', kind: 'talk', target: 'npc-hale', pages: ['"The gate held. The Chain stood up, and the city saw it."'], onComplete: [{ type: 'reputation', faction: 'iron-chain', delta: 6 }, { type: 'reputation', faction: 'halcyon', delta: -5 }] },
    ],
    rewards: [{ type: 'give-money', amount: 350 }],
  },
  {
    id: 'chain-crooked-card',
    title: 'The Crooked Card',
    summary: 'Somebody is fixing fights at the Furnace Pits. Ledger Sarr has a name: the bookie, Crane.',
    requires: ['chain-strikebreakers'],
    minRep: { 'iron-chain': 30 },
    giver: 'npc-hale',
    offer: ['Ledger says the numbers don’t add up. Fighters throwing bouts, money flowing to one bookie.', 'Crane works the Pits on fight nights. Beat his ringer, and bring me his book.'],
    onStart: [{ type: 'spawn-npc', npc: 'npc-bookie', near: 'The Furnace Pits' }],
    objectives: [
      { text: 'Beat Crane’s ringer at the Furnace Pits', kind: 'defeat', target: 'npc-bookie', onComplete: [{ type: 'despawn-npc', npc: 'npc-bookie' }, { type: 'message', speaker: 'Crane’s book', pages: ['Every fixed bout is listed, with a payment beside it. The payer’s initials: V.C.T. The Trust has been buying the Pits for years.'] }] },
      {
        text: 'Bring the book to Brannoc Hale',
        kind: 'talk',
        target: 'npc-hale',
        pages: ['Hale reads it and shuts it very gently. "Strength is the only honest currency. These people counterfeited it."', '"You fight clean, you stand at the line, you bring me the truth. You’re Chain, {player}. Wear it."'],
        onComplete: [{ type: 'set-flag', flag: 'chain-champion' }, { type: 'reputation', faction: 'iron-chain', delta: 15 }],
      },
    ],
    rewards: [{ type: 'give-money', amount: 700 }],
  },

  // ----------------------------------------------------------------------------------------------
  // Secret: the Hollow (WORLD.md §5 endings). All eight founders' murals point to the grove.
  {
    id: 'the-hollow',
    title: 'The Hollow',
    summary: 'The eight founders’ murals form a map. It ends at an overgrown gatehouse in the Outskirts.',
    requires: ['everyone-wants-it'],
    requiresFlags: MURALS.map((m) => `mural:${m}`),
    blockedByFlags: ['act1-sold'],
    autoStart: true,
    onStart: [
      {
        type: 'message',
        speaker: 'The founders’ murals',
        pages: [
          'Laid out in your head, the eight murals line up like streets on a map: a stag, a bell, lamps with sleeping Wildlings, a lighthouse on a marsh.',
          'Every road in them leads out of the city, to a gate swallowed by roots. The Glitchling has gone very still, listening.',
        ],
      },
    ],
    objectives: [
      {
        text: 'Find the Hollow Gate in the Outskirts',
        kind: 'inspect',
        target: 'The Hollow Gate',
        onComplete: [
          {
            type: 'message',
            speaker: 'The Hollow',
            pages: [
              'Past the gatehouse the trees close overhead and the neon glow of the city simply stops, as if someone drew a line.',
              'Something huge moves between the trunks. Branches, not antlers. It has been waiting a very long time.',
            ],
          },
          { type: 'spawn-quest-wildling', species: 'hollowstag', level: 32, tag: 'hollowstag' },
        ],
      },
      {
        text: 'Face Hollowstag in the grove',
        kind: 'resolve-tag',
        target: 'hollowstag',
        onComplete: [
          {
            type: 'choice',
            speaker: 'Hollowstag',
            pages: ['The stag lowers its head to the Glitchling and begins to hum: a low, round note, the shape of a ring. The Glitchling answers, flickering in time.'],
            options: [
              {
                id: 'sing',
                label: 'Let the Glitchling sing with it.',
                effects: [
                  { type: 'evolve-wildling', from: 'glitchling', into: 'resonant', learn: 'harmonic-chord' },
                  { type: 'set-flag', flag: 'hollow-song' },
                  { type: 'reputation', faction: 'choir', delta: 10 },
                  {
                    type: 'message',
                    speaker: 'The Hollow',
                    pages: ['The two voices braid together. When the song ends, the Glitchling is gone, and in its place something steadier glows: the Resonant. It knows the marsh song now. So, somehow, do you.'],
                  },
                ],
              },
              {
                id: 'silence',
                label: 'Keep the Glitchling quiet. Some songs aren’t yours to sing.',
                effects: [
                  { type: 'set-flag', flag: 'hollow-refused' },
                  { type: 'message', speaker: 'The Hollow', pages: ['The stag watches you for a long moment, then turns back into the trees. The hum fades. The city’s glow returns.'] },
                ],
              },
            ],
          },
        ],
      },
    ],
    rewards: [{ type: 'set-flag', flag: 'hollow-found' }],
  },

  // ----------------------------------------------------------------------------------------------
  // Act III — the Quiet.
  {
    id: 'the-quiet',
    title: 'The Quiet',
    summary: 'Three fragments show the truth: the Lighting is a cage. Ashgrave waits at the Lumen Spire.',
    requires: ['everyone-wants-it'],
    requiresItems: { 'hush-fragment': 3 },
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
                when: { notFlags: ['act1-sold'], anyOf: [{ flags: ['wren-turned'] }, { flags: ['pits-freed'] }, { flags: ['thorn-contained'] }, { flags: ['vik-ally'] }, { flags: ['bram-fork'] }, { flags: ['varga-turned'] }, { flags: ['compact-champion'] }, { flags: ['choir-champion'] }, { flags: ['chain-champion'] }, { minRep: { saints: 30 } }] },
                effects: [{ type: 'ending', id: 'chorus' }],
              },
              {
                id: 'the-hollow',
                label: 'Let the Resonant sing the marsh song into the grid.',
                when: { flags: ['hollow-song'] },
                effects: [{ type: 'ending', id: 'the-hollow' }],
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
