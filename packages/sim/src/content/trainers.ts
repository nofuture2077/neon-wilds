import type { TrainerDefinition } from './types';

export const TRAINERS: Record<string, TrainerDefinition> = {
  'npc-aegis': {
    npcId: 'npc-aegis',
    name: 'Agent Kerr',
    party: [{ species: 'scrapup', level: 4 }],
    ai: 'novice',
    items: {},
    reward: 120,
    challenge: [
      'Halcyon Aegis. That capsule is company property, courier.',
      "...And so, apparently, is whatever just crawled out of it. Hand it over. Or don't — I'd enjoy the paperwork less.",
    ],
    defeated: ['This isn’t over. Halcyon remembers its property.'],
  },
  'npc-handler': {
    npcId: 'npc-handler',
    name: 'Handler Voss',
    party: [
      { species: 'scrapup', level: 11 },
      { species: 'gearhound', level: 14 },
    ],
    ai: 'skilled',
    items: { 'patch-kit': 1 },
    reward: 260,
    challenge: [
      'Those strays are tagged Halcyon assets. Step away from the van.',
      'Fine. Let’s see how a courier handles a tethered Gearhound. It doesn’t feel pain anymore — we made sure of that.',
    ],
    defeated: ['The tether... it’s flickering. That wasn’t supposed to happen.'],
  },
  'npc-ashgrave': {
    npcId: 'npc-ashgrave',
    name: 'Corvin Ashgrave',
    party: [
      { species: 'neonyx', level: 18 },
      { species: 'gearhound', level: 19 },
      { species: 'heistcoon', level: 21 },
    ],
    ai: 'skilled',
    items: { 'med-spray': 2 },
    reward: 800,
    challenge: [
      'Forty years ago this city was fog, fear and teeth. We gave it light. We gave it quiet.',
      'You want to tear that down for a glitching pet? Very well. Let me show you what order looks like.',
    ],
    defeated: ['...So the Glitchling can hear the Hush. And it sings back. Then the choice is yours, courier.'],
  },
  'npc-vik': {
    npcId: 'npc-vik',
    name: 'Vik Torrance',
    party: [
      { species: 'pebblet', level: 6 },
      { species: 'cindertail', level: 7 },
    ],
    ai: 'skilled',
    items: { 'patch-kit': 1 },
    reward: 300,
    challenge: [
      "So you're the courier with the glitchy pet. Name's Vik. Iron Chain pit champion. Well — junior champion.",
      "Everyone's talking about your Wildling. Let's see if it's worth the gossip.",
    ],
    defeated: [
      "Tch. Lucky. Next time I won't hold back.",
      "...Hey. If you ever want to fight for real, the Furnace Pits are in the Industrial Zone. Tell them Vik sent you.",
    ],
  },
};
