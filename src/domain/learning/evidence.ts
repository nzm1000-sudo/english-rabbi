import type { ItemOutcome, ItemSnapshot } from './events';
import type { ReviewGrade } from './srs';

/**
 * Turns a raw outcome into learning evidence.
 *
 * This is where behaviour signals are interpreted: hints, repeated attempts,
 * slow answers, suspected guesses, skips. The function is pure and versioned
 * so that a better interpretation can be replayed over old events.
 */
// 2: a wrong first try is graded Again even when later solved (docs/research/learning-science.md, change 1).
export const EVIDENCE_MODEL_VERSION = 2;

export type EvidenceFlag =
  | 'clean'
  | 'after-hint'
  | 'after-retry'
  | 'after-explanation'
  | 'revealed'
  | 'skipped'
  | 'slow'
  | 'fast'
  | 'possible-guess'
  | 'hesitant';

export interface Evidence {
  /** 0..1 outcome used by the ability model. */
  score: number;
  /** 0..1 trust in this observation. */
  weight: number;
  /** Spaced repetition grade, or null to leave the schedule unchanged. */
  grade: ReviewGrade | null;
  flags: EvidenceFlag[];
  xp: number;
}

export function toEvidence(item: ItemSnapshot, o: ItemOutcome, predicted?: number): Evidence {
  const flags: EvidenceFlag[] = [];

  if (o.skipped) {
    return { score: 0, weight: 0.25, grade: null, flags: ['skipped'], xp: 0 };
  }
  if (o.revealed || !o.finalCorrect) {
    return { score: 0, weight: 1, grade: 'again', flags: ['revealed'], xp: 1 };
  }

  const retries = Math.max(0, o.attempts.length - 1);
  let score = 1;
  score -= 0.25 * o.hintsUsed;
  score -= 0.2 * retries;
  if (o.explanationShown) score -= 0.3;
  score = Math.max(0.15, score);

  if (o.hintsUsed > 0) flags.push('after-hint');
  if (retries > 0) flags.push('after-retry');
  if (o.explanationShown) flags.push('after-explanation');

  const helped = o.hintsUsed > 0 || retries > 0 || o.explanationShown;
  let weight = 1;
  // A wrong first try means the memory failed, even if the learner then found
  // the answer (by a hint or by eliminating options): bring it back soon.
  // Grading it Hard would lengthen the interval of a mature card instead.
  // A hint alone, with no wrong answer, is a weak but real recall: Hard.
  let grade: ReviewGrade = retries > 0 || o.explanationShown ? 'again' : helped ? 'hard' : 'good';

  // Response time. Listening items include audio time, so they get more room.
  const room = item.modality === 'listen' ? 2 : 1;
  const slow = o.responseMs > 3 * room * item.estimatedMs;
  const fast = o.responseMs < 0.4 * item.estimatedMs;

  if (!helped && slow) {
    flags.push('slow');
    score = Math.min(score, 0.85);
    grade = 'hard';
  }

  if (!helped && fast) {
    flags.push('fast');
    // A fast, clean recall of a typed answer is strong memory.
    if (item.interaction === 'typed') grade = 'easy';
  }

  // Suspected guess: a very fast correct pick on a choice item we expected
  // the learner to find hard.
  if (
    item.interaction === 'choice' &&
    !helped &&
    o.responseMs < Math.max(1500, 0.2 * item.estimatedMs) &&
    (predicted ?? 1) < 0.5
  ) {
    flags.push('possible-guess');
    weight = 0.4;
    grade = 'hard';
  }

  if (o.answerChanges >= 2) {
    flags.push('hesitant');
    weight *= 0.85;
  }

  if (flags.length === 0) flags.push('clean');
  const xp = helped ? 5 : 10;
  return { score, weight, grade, flags, xp };
}
