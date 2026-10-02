import { levelCenter } from '../skills/cefr';
import { getSkill } from '../skills/taxonomy';
import { confidence, expectedSuccess, type AbilityState } from './ability';

export type MasteryStatus = 'unseen' | 'learning' | 'developing' | 'mastered';
export type Trend = 'improving' | 'stable' | 'declining' | 'unknown';
export type ParentLabel = 'strong' | 'improving' | 'medium' | 'needs-work' | 'not-assessed';

export interface HistoryPoint {
  day: string;
  mu: number;
}

/**
 * Probability of solving a typical item of this skill at the skill's own
 * level. For a domain root ("grammar") the caller passes the target level.
 */
export function masteryProbability(state: Pick<AbilityState, 'mu' | 'variance'>, skillId: string, levelOverride?: number): number {
  const skill = getSkill(skillId);
  const b = levelOverride ?? (skill ? levelCenter(skill.level) + 0.25 : 0);
  return expectedSuccess(state, b);
}

export function masteryStatus(state: AbilityState, skillId: string, levelOverride?: number): MasteryStatus {
  if (state.evidence < 0.5) return 'unseen';
  const m = masteryProbability(state, skillId, levelOverride);
  if (m >= 0.85 && confidence(state) >= 0.45) return 'mastered';
  if (m >= 0.6) return 'developing';
  return 'learning';
}

/** Compares the latest estimate to the one about `days` days earlier. */
export function trend(history: HistoryPoint[], days = 14): Trend {
  if (history.length < 2) return 'unknown';
  const last = history[history.length - 1]!;
  const cutoff = shiftDay(last.day, -days);
  let ref = history[0]!;
  for (const h of history) {
    if (h.day <= cutoff) ref = h;
  }
  const delta = last.mu - ref.mu;
  if (delta > 0.25) return 'improving';
  if (delta < -0.25) return 'declining';
  return 'stable';
}

export function parentLabel(state: AbilityState | undefined, skillId: string, history: HistoryPoint[], levelOverride?: number): ParentLabel {
  if (!state || state.evidence < 2) return 'not-assessed';
  const status = masteryStatus(state, skillId, levelOverride);
  if (status === 'mastered') return 'strong';
  if (trend(history) === 'improving') return 'improving';
  if (masteryProbability(state, skillId, levelOverride) < 0.5) return 'needs-work';
  return 'medium';
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
