/**
 * Ability model.
 *
 * Each (student, skill) pair holds a Gaussian belief about ability on the
 * shared logit scale: mean `mu`, variance `variance`. Every scored answer is
 * evidence that updates the belief with a one-step Bayesian (Laplace /
 * Kalman-style) update of a 3-parameter logistic IRT model:
 *
 *   P(correct) = c + (1 - c) * sigmoid(theta - b)
 *
 * b is the item difficulty and c the chance of guessing (1 / options for a
 * multiple-choice item, 0 for typed answers). This gives three things a plain
 * success counter cannot:
 *  - a hard item answered correctly moves the estimate more than an easy one;
 *  - a lucky guess on a 2-option item barely counts;
 *  - `variance` is an honest "how sure are we" number (confidence).
 *
 * Variance grows with time away from a skill, so the system re-checks skills
 * that were not practiced for a while instead of trusting old evidence.
 */

export interface AbilityState {
  mu: number;
  variance: number;
  /** Total evidence weight received. */
  evidence: number;
  /** ms epoch of the last update, or null if never practiced. */
  updatedAt: number | null;
}

export const PRIOR_VARIANCE = 1.5 * 1.5;
const MIN_VARIANCE = 0.05;
/** Variance added per day without practice. */
const DRIFT_PER_DAY = 0.004;
const MU_LIMIT = 4.5;
const DAY = 86_400_000;

export function priorAbility(mu = -0.5): AbilityState {
  return { mu, variance: PRIOR_VARIANCE, evidence: 0, updatedAt: null };
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function pCorrect(theta: number, b: number, c = 0): number {
  return c + (1 - c) * sigmoid(theta - b);
}

/**
 * Probability of success averaged over the current uncertainty. Uses the
 * probit approximation, so an uncertain estimate predicts closer to 50%.
 */
export function expectedSuccess(state: Pick<AbilityState, 'mu' | 'variance'>, b: number, c = 0): number {
  const k = 1 / Math.sqrt(1 + (Math.PI * state.variance) / 8);
  return c + (1 - c) * sigmoid(k * (state.mu - b));
}

/** Widen the belief for time passed since the last update. */
export function applyDrift(state: AbilityState, now: number): AbilityState {
  if (state.updatedAt === null || now <= state.updatedAt) return state;
  const days = (now - state.updatedAt) / DAY;
  const variance = Math.min(PRIOR_VARIANCE, state.variance + DRIFT_PER_DAY * days);
  return { ...state, variance };
}

export interface Observation {
  /** Item difficulty on the logit scale. */
  b: number;
  /** Guess probability. */
  c: number;
  /** Outcome in [0, 1]. 1 = clean success, 0 = failure, fractions for partial credit. */
  score: number;
  /** Evidence weight in (0, 1]. Lower for suspected guesses or weak evidence. */
  weight: number;
  at: number;
}

export function updateAbility(prev: AbilityState, obs: Observation): AbilityState {
  const s = applyDrift(prev, obs.at);
  const w = clamp(obs.weight, 0, 1);
  if (w === 0) return { ...s, updatedAt: obs.at };

  const c = clamp(obs.c, 0, 0.95);
  const y = clamp(obs.score, 0, 1);
  const p2 = sigmoid(s.mu - obs.b);
  const p = c + (1 - c) * p2;

  // 3PL score function and Fisher information (a = 1).
  const ratio = (p - c) / ((1 - c) * p);
  const gradient = ratio * (y - p);
  const info = Math.max(1e-6, ratio * ratio * p * (1 - p));

  const variance = Math.max(MIN_VARIANCE, 1 / (1 / s.variance + w * info));
  const mu = clamp(s.mu + variance * w * gradient, -MU_LIMIT, MU_LIMIT);
  return { mu, variance, evidence: s.evidence + w, updatedAt: obs.at };
}

/** 0 = we know nothing beyond the prior, 1 = very sure. */
export function confidence(state: Pick<AbilityState, 'variance'>): number {
  const c = 1 - Math.sqrt(state.variance / PRIOR_VARIANCE);
  return clamp(c, 0, 1);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
