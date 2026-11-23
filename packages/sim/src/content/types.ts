/** A conversation is a list of pages shown one after another. `{player}` is replaced with the player's name. */
export type Conversation = string[];

export type Temperament = 'timid' | 'steady' | 'tough';

export interface Appearance {
  skin: number;
  hair: number;
  top: number;
  bottom: number;
}

export interface NpcArchetype {
  id: string;
  /** Short human-readable role, e.g. "street vendor". */
  role: string;
  temperament: Temperament;
  /** Walking speed in tiles/second. */
  walkSpeed: number;
  dialogue: {
    greeting: Conversation[];
    night: Conversation[];
    /** Used while the NPC remembers being shoved by the player. */
    grudge: Conversation[];
  };
  /** Optional lines chosen by the player's standing with the NPC's faction. */
  factionDialogue?: { friendly: Conversation[]; hostile: Conversation[] };
  barks: {
    ambient: string[];
    night: string[];
    shoved: string[];
    alarmed: string[];
  };
}

export interface NpcDefinition {
  id: string;
  name: string;
  archetype: string;
  appearance: Appearance;
  /** 'start' NPCs exist from the beginning; 'mission' NPCs appear when a mission spawns them. */
  spawn?: 'start' | 'mission';
  /** Stands in place (guards, trainers waiting for a challenger). */
  stationary?: boolean;
  /** Building name to stand next to (stationary NPCs). */
  post?: string;
}

export interface TrainerDefinition {
  npcId: string;
  name: string;
  party: { species: string; level: number }[];
  ai: 'novice' | 'skilled';
  items: Record<string, number>;
  reward: number;
  /** Said before the battle starts. */
  challenge: Conversation;
  /** Said when talked to after being defeated. */
  defeated: Conversation;
}
