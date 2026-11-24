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
    rewards: [{ type: 'set-flag', flag: 'fragment-iron' }],
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
                when: { notFlags: ['act1-sold'], anyOf: [{ flags: ['wren-turned'] }, { flags: ['pits-freed'] }, { flags: ['thorn-contained'] }, { minRep: { saints: 30 } }] },
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
