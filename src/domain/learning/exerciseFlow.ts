import type { AttemptRecord, ItemOutcome } from './events';

/**
 * Exercise flow: the "don't give the answer too fast" policy.
 *
 * After each wrong answer the learner gets the next help step:
 *   hint 1 -> hint 2 -> explanation -> answer revealed.
 * A near miss (spelling) gets one free retry without advancing the ladder.
 * The learner may also ask for the next hint at any time.
 */
export type Phase = 'answering' | 'retry' | 'solved' | 'revealed' | 'skipped';

export interface FlowState {
  phase: Phase;
  attempts: AttemptRecord[];
  hintsShown: number;
  explanationShown: boolean;
  nearMissUsed: boolean;
  answerChanges: number;
  replays: number;
  startedAt: number;
  endedAt?: number;
  /** What the last answer triggered, for the UI. */
  lastHelp?: 'hint' | 'explanation' | 'reveal' | 'spelling';
}

export type FlowAction =
  | { type: 'submit'; attempt: AttemptRecord }
  | { type: 'hint' }
  | { type: 'reveal'; at: number }
  | { type: 'skip'; at: number }
  | { type: 'change-selection' }
  | { type: 'replay' };

export function initialFlow(startedAt: number): FlowState {
  return {
    phase: 'answering',
    attempts: [],
    hintsShown: 0,
    explanationShown: false,
    nearMissUsed: false,
    answerChanges: 0,
    replays: 0,
    startedAt,
  };
}

export function isFinished(s: FlowState): boolean {
  return s.phase === 'solved' || s.phase === 'revealed' || s.phase === 'skipped';
}

export function flowReducer(s: FlowState, a: FlowAction, hintCount: number): FlowState {
  if (isFinished(s) && a.type !== 'replay') return s;
  switch (a.type) {
    case 'change-selection':
      return { ...s, answerChanges: s.answerChanges + 1 };
    case 'replay':
      return { ...s, replays: s.replays + 1 };
    case 'skip':
      return { ...s, phase: 'skipped', endedAt: a.at };
    case 'reveal':
      return { ...s, phase: 'revealed', endedAt: a.at, lastHelp: 'reveal' };
    case 'hint':
      return advanceHelp(s, hintCount, s.startedAt, false);
    case 'submit': {
      const attempts = [...s.attempts, a.attempt];
      if (a.attempt.correct) {
        return { ...s, attempts, phase: 'solved', endedAt: a.attempt.atMs };
      }
      if (a.attempt.nearMiss && !s.nearMissUsed) {
        return { ...s, attempts, phase: 'retry', nearMissUsed: true, lastHelp: 'spelling' };
      }
      return advanceHelp({ ...s, attempts }, hintCount, a.attempt.atMs, true);
    }
  }
}

function advanceHelp(s: FlowState, hintCount: number, at: number, afterWrong: boolean): FlowState {
  if (s.hintsShown < hintCount) {
    return { ...s, phase: 'retry', hintsShown: s.hintsShown + 1, lastHelp: 'hint' };
  }
  if (!s.explanationShown) {
    return { ...s, phase: 'retry', explanationShown: true, lastHelp: 'explanation' };
  }
  // Only a wrong answer after all help reveals the answer.
  // Asking for more help when none is left changes nothing.
  if (!afterWrong) return s;
  return { ...s, phase: 'revealed', endedAt: at, lastHelp: 'reveal' };
}

export function toOutcome(s: FlowState): ItemOutcome {
  const end = s.endedAt ?? s.startedAt;
  return {
    finalCorrect: s.phase === 'solved',
    attempts: s.attempts,
    hintsUsed: s.hintsShown,
    explanationShown: s.explanationShown,
    revealed: s.phase === 'revealed',
    skipped: s.phase === 'skipped',
    responseMs: Math.max(0, end - s.startedAt),
    answerChanges: s.answerChanges,
    replays: s.replays,
  };
}
