import { MISSIONS } from '../content/missions';
import type { SimEvent } from '../core/events';
import type { ProgressionState } from '../progression';
import type { Effect, MissionDef, MissionRuntime, ObjectiveDef } from './types';

/** What the mission runtime needs from the simulation. */
export interface MissionHost {
  progression: ProgressionState;
  applyEffect(effect: Effect): void;
  emit(event: SimEvent): void;
}

/** Handcrafted missions plus this save's generated ones. */
export function missionDef(id: string, p: ProgressionState): MissionDef {
  const def = MISSIONS.find((m) => m.id === id) ?? p.generated.find((m) => m.id === id);
  if (!def) throw new Error(`Unknown mission "${id}"`);
  return def;
}

export function currentObjective(rt: MissionRuntime, p: ProgressionState): ObjectiveDef | null {
  if (rt.status !== 'active') return null;
  return missionDef(rt.id, p).objectives[rt.objective] ?? null;
}

function isCompleted(p: ProgressionState, id: string): boolean {
  return p.missions.some((m) => m.id === id && m.status === 'completed');
}

function isKnown(p: ProgressionState, id: string): boolean {
  return p.missions.some((m) => m.id === id);
}

function requirementsMet(p: ProgressionState, def: MissionDef): boolean {
  return def.requires.every((r) => isCompleted(p, r));
}

export function startMission(host: MissionHost, def: MissionDef): void {
  if (isKnown(host.progression, def.id)) return;
  host.progression.missions.push({ id: def.id, status: 'active', objective: 0, deadline: def.generated?.deadlineMinutes ?? null });
  host.progression.board = host.progression.board.filter((id) => id !== def.id);
  host.emit({ type: 'mission.started', missionId: def.id, title: def.title });
  for (const e of def.onStart ?? []) host.applyEffect(e);
}

/** Start every auto-start mission whose requirements are now met. */
export function checkAutoStart(host: MissionHost): void {
  for (const def of MISSIONS) {
    if (def.autoStart && !isKnown(host.progression, def.id) && requirementsMet(host.progression, def)) startMission(host, def);
  }
}

/** A mission this NPC can offer right now, if any. */
export function offerFrom(p: ProgressionState, npcId: string): MissionDef | null {
  const handcrafted = MISSIONS.find((m) => m.giver === npcId && !m.autoStart && !isKnown(p, m.id) && requirementsMet(p, m));
  if (handcrafted) return handcrafted;
  return p.generated.find((m) => m.giver === npcId && p.board.includes(m.id) && !isKnown(p, m.id)) ?? null;
}

/** Fail missions whose deadline has passed. */
export function checkDeadlines(host: MissionHost, now: number): void {
  for (const rt of host.progression.missions) {
    if (rt.status !== 'active' || rt.deadline == null || now <= rt.deadline) continue;
    rt.status = 'failed';
    const def = missionDef(rt.id, host.progression);
    for (const e of def.generated?.onFail ?? []) host.applyEffect(e);
    host.emit({ type: 'mission.failed', missionId: def.id, title: def.title });
  }
}

function advance(host: MissionHost, rt: MissionRuntime): void {
  const def = missionDef(rt.id, host.progression);
  const obj = def.objectives[rt.objective];
  for (const e of obj?.onComplete ?? []) host.applyEffect(e);
  rt.objective++;
  if (rt.objective >= def.objectives.length) {
    rt.status = 'completed';
    for (const e of def.rewards) host.applyEffect(e);
    host.emit({ type: 'mission.completed', missionId: def.id, title: def.title });
    checkAutoStart(host);
  } else {
    host.emit({ type: 'mission.updated', missionId: def.id, objective: def.objectives[rt.objective]!.text });
  }
}

/** Try to complete an active objective of the given kind/target. Returns the completed objective, if any. */
export function trigger(host: MissionHost, kind: ObjectiveDef['kind'], target: string): ObjectiveDef | null {
  for (const rt of host.progression.missions) {
    const obj = currentObjective(rt, host.progression);
    if (obj && obj.kind === kind && obj.target === target) {
      advance(host, rt);
      return obj;
    }
  }
  return null;
}

/** Does an active objective currently target this (kind, target)? */
export function isObjective(p: ProgressionState, kind: ObjectiveDef['kind'], target: string): boolean {
  return p.missions.some((rt) => {
    const obj = currentObjective(rt, p);
    return !!obj && obj.kind === kind && obj.target === target;
  });
}
