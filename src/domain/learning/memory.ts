/**
 * Learner memory: long-lived observations about how a student learns.
 *
 * Mistake patterns are keyed by misconception id (from the content
 * catalog, e.g. "quantifiers.much-many"). A pattern is "active" while
 * recent mistakes outweigh recent successful repairs. Active patterns drive
 * item selection and teacher notes.
 */
export interface MistakeExample {
  itemId: string;
  answer: string;
  at: number;
}

export interface MistakePattern {
  misconceptionId: string;
  count: number;
  /** Decaying weight of recent mistakes minus repairs. */
  activeScore: number;
  firstSeenAt: number;
  lastSeenAt: number;
  /** Correct answers in a row on items targeting this misconception. */
  repairStreak: number;
  examples: MistakeExample[];
}

const HALF_LIFE_DAYS = 21;
const MAX_EXAMPLES = 5;
const DAY = 86_400_000;

export function decayedScore(p: Pick<MistakePattern, 'activeScore' | 'lastSeenAt'>, now: number): number {
  const days = Math.max(0, (now - p.lastSeenAt) / DAY);
  return p.activeScore * Math.pow(0.5, days / HALF_LIFE_DAYS);
}

export function recordMistake(prev: MistakePattern | undefined, misconceptionId: string, ex: MistakeExample): MistakePattern {
  if (!prev) {
    return {
      misconceptionId,
      count: 1,
      activeScore: 1,
      firstSeenAt: ex.at,
      lastSeenAt: ex.at,
      repairStreak: 0,
      examples: [ex],
    };
  }
  return {
    ...prev,
    count: prev.count + 1,
    activeScore: decayedScore(prev, ex.at) + 1,
    lastSeenAt: ex.at,
    repairStreak: 0,
    examples: [...prev.examples, ex].slice(-MAX_EXAMPLES),
  };
}

export function recordRepair(prev: MistakePattern, at: number): MistakePattern {
  return {
    ...prev,
    activeScore: Math.max(0, decayedScore(prev, at) - 0.5),
    lastSeenAt: at,
    repairStreak: prev.repairStreak + 1,
  };
}

/** A pattern is worth acting on when it repeated and is not yet repaired. */
export function isActive(p: MistakePattern, now: number): boolean {
  return p.count >= 2 && decayedScore(p, now) >= 1 && p.repairStreak < 3;
}
