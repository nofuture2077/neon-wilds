export type Effect =
  | { type: 'message'; speaker: string; pages: string[] }
  | { type: 'give-item'; item: string; qty: number }
  | { type: 'take-item'; item: string; qty: number }
  | { type: 'give-money'; amount: number }
  | { type: 'give-wildling'; species: string; level: number }
  | { type: 'spawn-npc'; npc: string; near: string }
  | { type: 'despawn-npc'; npc: string }
  | { type: 'start-trainer-battle'; npc: string }
  | { type: 'spawn-quest-wildling'; species: string; level: number; tag: string }
  | { type: 'set-flag'; flag: string }
  | { type: 'reputation'; faction: string; delta: number }
  | { type: 'remember'; npc: string; kind: 'helped' | 'saw-battle-win'; important: boolean }
  | { type: 'take-wildling'; species: string };

export type ObjectiveKind = 'inspect' | 'talk' | 'defeat' | 'resolve-tag' | 'capture' | 'disrupt';

export interface ObjectiveDef {
  text: string;
  kind: ObjectiveKind;
  /** Building name (inspect), NPC id (talk/defeat) or quest tag (resolve-tag). */
  target: string;
  /** For talk objectives: the conversation shown when the objective completes. */
  pages?: string[];
  onComplete?: Effect[];
}

export interface MissionDef {
  id: string;
  title: string;
  summary: string;
  /** Mission ids that must be completed first. */
  requires: string[];
  /** Starts automatically when requirements are met; otherwise offered by `giver`. */
  autoStart?: boolean;
  giver?: string;
  offer?: string[];
  onStart?: Effect[];
  objectives: ObjectiveDef[];
  rewards: Effect[];
  /** Present on procedurally generated missions. */
  generated?: {
    template: string;
    /** Absolute in-game minute by which it must be done, or null. */
    deadlineMinutes: number | null;
    /** Effects applied if the mission fails (e.g. reputation loss). */
    onFail: Effect[];
    reward: string;
  };
}

export interface MissionRuntime {
  id: string;
  status: 'active' | 'completed' | 'failed';
  objective: number;
  /** Absolute in-game minute deadline (generated missions). */
  deadline?: number | null;
}
