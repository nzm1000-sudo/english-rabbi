import { contentRegistry as reg } from './index';
import { kidBooks, kidWords, phonics } from './kids';
import { audioKey } from '@/services/speech/audioKey';
import { canonicalSpeechText, questionSpeech, splitSentences } from '@/services/speech/textPrep';
import { NEURAL_VOICES } from '@/services/speech/voiceProfiles';

/**
 * Every English text the app can speak must have pre-rendered natural audio
 * (American voice, normal and slow). If this fails after adding content, run
 * tools/tts-prerender.
 */
import manifestJson from '../public/audio/manifest.json';

const manifest = manifestJson as { entries: Record<string, string> };
const files = new Set(Object.keys(import.meta.glob('../public/audio/*.mp3')).map((f) => f.replace('../public/', '')));

function speakable(): { text: string; speaker: 'A' | 'B' }[] {
  const out = new Set<string>();
  const byB = new Set<string>();
  for (const i of reg.items) {
    if ('audioText' in i && i.audioText) out.add(i.audioText);
    if (i.word) {
      out.add(i.word.lemma);
      if (i.word.example) out.add(i.word.example);
    }
  }
  for (const p of reg.passages.values()) out.add(p.text);
  for (const st of reg.stories.values()) {
    for (const l of st.lines) (l.speaker === 'B' ? byB : out).add(l.en);
    for (const g of Object.values(st.glossary)) out.add(g.lemma);
  }
  return [...[...out].map((text) => ({ text, speaker: 'A' as const })), ...[...byB].map((text) => ({ text, speaker: 'B' as const }))];
}

function covered({ text, speaker }: { text: string; speaker: 'A' | 'B' }, rate: 'normal' | 'slow'): boolean {
  const voice = NEURAL_VOICES['en-US'][speaker];
  const t = canonicalSpeechText(text);
  if (manifest.entries[audioKey(voice, rate, t)]) return true;
  const parts = splitSentences(t);
  return parts.length > 1 && parts.every((p) => manifest.entries[audioKey(voice, rate, p)]);
}

/** Questions, English options and anchor examples: recorded at normal speed only. */
function normalOnly(): { text: string; speaker: 'A' | 'B' }[] {
  const out = new Set<string>();
  const he = /[\u0590-\u05ff]/;
  const items = [...reg.items, ...[...reg.stories.values()].flatMap((st) => st.questions.map((q) => q.item))];
  for (const i of items) {
    if ((i.type === 'choice' || i.type === 'typed') && i.promptLanguage === 'en' && !he.test(i.prompt)) out.add(questionSpeech(i.prompt));
    if (i.type === 'choice') for (const o of i.options) if (!he.test(o.text)) out.add(o.text);
  }
  for (const a of reg.anchors.values()) for (const e of a.examples) out.add(e.en);
  for (const w of kidWords) {
    out.add(w.en);
    if (w.sentence) out.add(w.sentence.en);
  }
  for (const l of phonics.letters) out.add(l.word);
  for (const f of phonics.families) for (const w of f.words) out.add(w.en);
  for (const s of phonics.sightWords) {
    out.add(s.en);
    out.add(s.sentence.en);
  }
  for (const b of kidBooks) for (const pg of b.pages) out.add(pg.en);
  return [...out].map((text) => ({ text, speaker: 'A' as const }));
}

describe('pre-rendered audio', () => {
  it('covers every question, answer option and anchor example at normal speed', () => {
    const missing = normalOnly().filter((t) => !covered(t, 'normal')).map((t) => t.text);
    expect(missing).toEqual([]);
  });

  it.each(['normal', 'slow'] as const)('covers every speakable text at %s speed', (rate) => {
    const missing = speakable().filter((t) => !covered(t, rate)).map((t) => `${t.speaker}: ${t.text}`);
    expect(missing).toEqual([]);
  });

  it('every manifest entry points to an existing file', () => {
    for (const url of Object.values(manifest.entries)) {
      expect(files.has(url), url).toBe(true);
    }
  });
});

import heManifestJson from '../public/audio/he/manifest.json';
import { stickers } from './kids';
import { HEBREW_VOICE } from '@/services/speech/hebrewVoice';
import { KIDS_PHRASES, newStickerPhrase } from '@/features/kids/hebrewPhrases';
import { TOPIC_INFO } from '@/features/kids/topics';

describe('Hebrew phrases for children', () => {
  const he = (heManifestJson as { entries: Record<string, string> }).entries;
  const heFiles = new Set(Object.keys(import.meta.glob('../public/audio/he/*.mp3')).map((f) => f.replace('../public/', '')));
  it('every spoken Hebrew phrase has a natural recording (run tools/tts-prerender/hebrew.mjs)', () => {
    const texts = [
      ...KIDS_PHRASES,
      ...stickers.flatMap((s) => [s.he, newStickerPhrase(s.he)]),
      ...kidBooks.map((b) => b.title.he),
      ...Object.values(TOPIC_INFO).map((t) => t.he),
    ];
    const missing = texts.filter((t) => !he[audioKey(HEBREW_VOICE, 'normal', t)]);
    expect(missing).toEqual([]);
    for (const url of Object.values(he)) expect(heFiles.has(url)).toBe(true);
  });
});
