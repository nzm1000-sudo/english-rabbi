import type { Accent } from '@/domain/student/student';
import type { SpeechVoice, VoiceQuality } from '../types';

/**
 * Ranks the device's built-in voices for language learning. Browsers expose
 * no quality field, so we infer it from names. Novelty voices (macOS/iOS
 * "Bells", "Zarvox"...) are excluded: they are actively harmful for learning.
 */
const NOVELTY = new Set([
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news', 'jester', 'organ',
  'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox', 'deranged', 'hysterical', 'pipe organ', 'junior', 'ralph', 'fred', 'kathy',
]);

/** Voices known to sound reasonably natural on Apple, Google and Microsoft platforms. */
const KNOWN_GOOD = ['samantha', 'ava', 'zoe', 'evan', 'nathan', 'allison', 'susan', 'tom', 'daniel', 'serena', 'kate', 'arthur', 'jamie', 'stephanie', 'martha', 'oliver', 'google us english', 'google uk english female', 'google uk english male', 'aria', 'jenny', 'guy', 'sonia', 'ryan', 'libby'];

export function inferQuality(name: string): VoiceQuality {
  const n = name.toLowerCase();
  const base = n.replace(/\s*\(.*\)\s*/g, '').trim();
  if (NOVELTY.has(base)) return 'novelty';
  if (/neural|natural|online/.test(n)) return 'neural';
  if (/premium/.test(n)) return 'premium';
  if (/enhanced/.test(n)) return 'enhanced';
  return 'standard';
}

export function accentOf(lang: string): Accent | 'other' {
  const l = lang.replace('_', '-').toLowerCase();
  if (l === 'en-us') return 'en-US';
  if (l === 'en-gb') return 'en-GB';
  return 'other';
}

const QUALITY_SCORE: Record<VoiceQuality, number> = { neural: 50, premium: 45, enhanced: 35, standard: 10, unknown: 5, novelty: -1000 };

export function scoreVoice(v: SpeechVoice, accent: Accent): number {
  let s = QUALITY_SCORE[v.quality];
  if (v.accent === accent) s += 100;
  else if (v.lang.toLowerCase().startsWith('en')) s += 20;
  else s -= 500;
  const n = v.name.toLowerCase();
  if (KNOWN_GOOD.some((k) => n.startsWith(k))) s += 15;
  if (v.offline) s += 3;
  return s;
}

export function rankVoices(voices: SpeechVoice[], accent: Accent): SpeechVoice[] {
  return voices
    .filter((v) => v.quality !== 'novelty' && v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => scoreVoice(b, accent) - scoreVoice(a, accent) || a.name.localeCompare(b.name));
}
