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

/**
 * Voices of the pre-rendered files (tools/tts-prerender). American English is
 * recorded with Microsoft's neural voices, which sound clearer than Kokoro.
 * Andrew is the main voice (owner's choice), Jenny the second in dialogues;
 * British English is not pre-rendered, so it keeps the Kokoro names.
 */
export const PRERENDER_VOICES: Record<Accent, Record<Speaker, string>> = {
  'en-US': { A: 'en-US-AndrewNeural', B: 'en-US-JennyNeural' },
  'en-GB': NEURAL_VOICES['en-GB'],
};

/** Speaking-rate multipliers. Slow is generated slower by the engine, not stretched. */
export const RATE_FACTOR = { slower: 0.65, slow: 0.8, normal: 1, fast: 1.15 } as const;
