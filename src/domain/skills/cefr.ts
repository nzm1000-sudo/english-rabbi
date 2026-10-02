/**
 * CEFR scale and its mapping to the internal ability scale.
 *
 * All abilities and item difficulties live on one logit scale ("theta").
 * B1 is centered at 0. One CEFR band is one logit wide. This keeps the
 * ability model (IRT-style) and the human-readable levels consistent.
 */
export const CEFR_LEVELS = ['PreA1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

const CENTER: Record<CefrLevel, number> = {
  PreA1: -3,
  A1: -2,
  A2: -1,
  B1: 0,
  B2: 1,
  C1: 2,
  C2: 3,
};

export function levelCenter(level: CefrLevel): number {
  return CENTER[level];
}

/**
 * Converts an authored level plus a 0..1 within-level difficulty to theta.
 * difficulty 0.5 is the center of the band; 0 and 1 are its edges.
 */
export function itemTheta(level: CefrLevel, difficulty: number): number {
  const d = Math.min(1, Math.max(0, difficulty));
  return CENTER[level] + (d - 0.5);
}

export function thetaToLevel(theta: number): CefrLevel {
  let best: CefrLevel = 'PreA1';
  for (const level of CEFR_LEVELS) {
    if (theta >= CENTER[level] - 0.5) best = level;
  }
  return best;
}

/** Position inside the band, 0..1. Used for "A2 (high)" style labels. */
export function positionInLevel(theta: number): number {
  const level = thetaToLevel(theta);
  const p = theta - (CENTER[level] - 0.5);
  return Math.min(1, Math.max(0, p));
}

export function compareLevels(a: CefrLevel, b: CefrLevel): number {
  return CEFR_LEVELS.indexOf(a) - CEFR_LEVELS.indexOf(b);
}
