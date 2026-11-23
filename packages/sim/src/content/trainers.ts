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
