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
  | { type: 'message'; speaker: string; pages: string[]; choices?: { id: string; label: string }[] }
  | { type: 'game.ending'; ending: string; title: string; slides: { heading: string; text: string }[] }
  | { type: 'notice'; text: string }
  | { type: 'mission.started'; missionId: string; title: string }
  | { type: 'mission.updated'; missionId: string; objective: string }
  | { type: 'mission.completed'; missionId: string; title: string }
  | { type: 'mission.failed'; missionId: string; title: string }
  | { type: 'board.opened' }
  | { type: 'district.entered'; districtId: string; name: string }
  | { type: 'battle.started'; battleId: string; kind: 'wild' | 'trainer'; intro: string }
  | { type: 'battle.log'; battleId: string; entries: BattleLog[] }
  | { type: 'battle.ended'; battleId: string; outcome: 'win' | 'lose' | 'fled' | 'captured' }
  | { type: 'shop.opened'; shopId: string }
  | { type: 'wildling.received'; speciesId: string; destination: 'party' | 'storage' }
  | { type: 'blackout'; lostMoney: number }
  | { type: 'vehicle.entered'; vehicleId: string; how: 'own' | 'stolen' | 'carjacked' }
  | { type: 'vehicle.exited'; vehicleId: string }
  | { type: 'vehicle.crash'; vehicleId: string; impact: number }
  | { type: 'vehicle.honk'; vehicleId: string }
  | { type: 'vehicle.wrecked'; vehicleId: string }
  | { type: 'vehicle.exploded'; vehicleId: string; x: number; y: number }
  | { type: 'wanted.changed'; stars: number }
  | { type: 'territory.changed'; blockId: string; controller: string | null; previous: string | null }
  | { type: 'reputation.changed'; faction: string; delta: number; value: number }
  | { type: 'faction.operation'; faction: string; action: string; blockId: string | null; status: 'started' | 'completed' | 'disrupted' }
  | { type: 'weather.changed'; weather: 'clear' | 'drizzle' | 'rain' | 'storm' }
  | { type: 'world.event'; id: string; status: 'started' | 'ended'; title: string; text: string }
  | { type: 'busted'; lostMoney: number }
  | { type: 'respray'; vehicleId: string; cost: number }
  | { type: 'crime'; kind: CrimeKind; x: number; y: number; severity: number; witnessed: boolean };

export type CrimeKind = 'vehicle-theft' | 'carjacking' | 'hit-pedestrian' | 'assault' | 'assault-officer' | 'property-damage';

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
