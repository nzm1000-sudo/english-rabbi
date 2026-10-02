import type { Accent, Speaker } from './types';

/**
 * Named neural voices used for generated audio (pre-rendered files or the
 * home server). Ids are Kokoro-82M voice names (Apache-2.0). One profile per
 * accent keeps the accent consistent across a learning path; speaker B is
 * the second voice for dialogues.
 */
export const NEURAL_VOICES: Record<Accent, Record<Speaker, string>> = {
  'en-US': { A: 'af_heart', B: 'am_michael' },
  'en-GB': { A: 'bf_emma', B: 'bm_george' },
};

/** Speaking-rate multipliers. Slow is generated slower by the engine, not stretched. */
export const RATE_FACTOR = { slow: 0.8, normal: 1, fast: 1.15 } as const;
