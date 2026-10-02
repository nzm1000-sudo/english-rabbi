import { contentRegistry as reg } from './index';
import { audioKey } from '@/services/speech/audioKey';
import { canonicalSpeechText, splitSentences } from '@/services/speech/textPrep';
import { NEURAL_VOICES } from '@/services/speech/voiceProfiles';

/**
 * Every English text the app can speak must have pre-rendered natural audio
 * (American voice, normal and slow). If this fails after adding content, run
 * tools/tts-prerender.
 */
import manifestJson from '../public/audio/manifest.json';

const manifest = manifestJson as { entries: Record<string, string> };
const files = new Set(Object.keys(import.meta.glob('../public/audio/*.mp3')).map((f) => f.replace('../public/', '')));

function speakable(): string[] {
  const out = new Set<string>();
  for (const i of reg.items) {
    if ('audioText' in i && i.audioText) out.add(i.audioText);
    if (i.word) {
      out.add(i.word.lemma);
      if (i.word.example) out.add(i.word.example);
    }
  }
  for (const p of reg.passages.values()) out.add(p.text);
  return [...out];
}

function covered(text: string, rate: 'normal' | 'slow'): boolean {
  const voice = NEURAL_VOICES['en-US'].A;
  const t = canonicalSpeechText(text);
  if (manifest.entries[audioKey(voice, rate, t)]) return true;
  const parts = splitSentences(t);
  return parts.length > 1 && parts.every((p) => manifest.entries[audioKey(voice, rate, p)]);
}

describe('pre-rendered audio', () => {
  it.each(['normal', 'slow'] as const)('covers every speakable text at %s speed', (rate) => {
    const missing = speakable().filter((t) => !covered(t, rate));
    expect(missing).toEqual([]);
  });

  it('every manifest entry points to an existing file', () => {
    for (const url of Object.values(manifest.entries)) {
      expect(files.has(url), url).toBe(true);
    }
  });
});
