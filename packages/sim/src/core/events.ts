import type { BattleLog } from '../battle/types';

/**
 * Events are the *only* way the simulation talks to the outside world
 * (renderer, UI, audio, AI services). They are plain serialisable data,
 * collected per step and drained by the host.
 */
export type EmoteKind = 'none' | 'alarm' | 'anger' | 'chatter';

export type SimEvent =
  | { type: 'dialogue.opened'; npcId: string; speaker: string; pages: string[] }
  | { type: 'dialogue.closed'; npcId: string }
  | { type: 'bark'; actorId: string; text: string; emote: EmoteKind }
  | { type: 'npc.shoved'; npcId: string; byPlayer: boolean }
  | { type: 'npc.fled'; npcId: string }
  | { type: 'building.inspected'; buildingId: string; name: string; text: string }
  | { type: 'clock.hour'; hour: number }
  | { type: 'message'; speaker: string; pages: string[] }
  | { type: 'notice'; text: string }
  | { type: 'mission.started'; missionId: string; title: string }
  | { type: 'mission.updated'; missionId: string; objective: string }
  | { type: 'mission.completed'; missionId: string; title: string }
  | { type: 'battle.started'; battleId: string; kind: 'wild' | 'trainer'; intro: string }
  | { type: 'battle.log'; battleId: string; entries: BattleLog[] }
  | { type: 'battle.ended'; battleId: string; outcome: 'win' | 'lose' | 'fled' | 'captured' }
  | { type: 'shop.opened'; shopId: string }
  | { type: 'wildling.received'; speciesId: string; destination: 'party' | 'storage' }
  | { type: 'blackout'; lostMoney: number };

export type SimEventType = SimEvent['type'];

export class EventQueue {
  private events: SimEvent[] = [];

  push(event: SimEvent): void {
    this.events.push(event);
  }

  /** Returns and clears everything emitted since the last drain. */
  drain(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  get size(): number {
    return this.events.length;
  }
}
