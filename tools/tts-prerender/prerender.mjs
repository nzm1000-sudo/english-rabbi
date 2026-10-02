/**
 * Pre-renders English learning audio with Kokoro-82M (Apache-2.0), free and offline.
 *
 * Usage (from this folder, Node 22.18+ and ffmpeg installed):
 *   npm install
 *   node prerender.mjs                 # all texts, both accents, normal + slow
 *   node prerender.mjs --limit 5       # quick test
 *   node prerender.mjs --prune         # also delete audio of removed texts
 *
 * Output: ../../public/audio/<key>.mp3 and ../../public/audio/manifest.json.
 * The app's PrerenderedProvider looks texts up by the same key (audioKey.ts),
 * so a text plays from these files only if it matches exactly.
 * Existing files are kept: re-running only renders what is missing.
 */
import { KokoroTTS } from 'kokoro-js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioKey } from '../../src/services/speech/audioKey.ts';
import { splitSentences } from '../../src/services/speech/textPrep.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outDir = path.join(root, 'public/audio');
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

// Keep in sync with src/services/speech/voiceProfiles.ts
const VOICES = { 'en-US': { A: 'af_heart', B: 'am_michael' }, 'en-GB': { A: 'bf_emma', B: 'bm_george' } };
// Accents to render. Chosen by ear on 2026-10-02: American only.
// Add en-GB with: --accents en-US,en-GB
const accArg = process.argv.indexOf('--accents');
const ACCENTS = accArg > 0 ? process.argv[accArg + 1].split(',') : ['en-US'];
const RATES = { normal: 1, slow: 0.8 };
const TEST_SENTENCES = [
  'Hello, my name is Sarah.',
  "I'd like to know what you're doing tomorrow.",
  'Have you ever been to London?',
  'Although it was raining, we decided to go outside.',
  "I would've called you if I'd known you were home.",
];

/** Texts to render, with the dialogue speaker ("A" or "B") that says them. */
function collectTexts() {
  const texts = new Map(TEST_SENTENCES.map((t) => [`A|${t}`, { text: t, speaker: 'A' }]));
  const add = (text, speaker = 'A') => texts.set(`${speaker}|${text}`, { text, speaker });
  const packDir = path.join(root, 'content/packs');
  for (const f of fs.readdirSync(packDir).filter((f) => f.endsWith('.json'))) {
    const pack = JSON.parse(fs.readFileSync(path.join(packDir, f), 'utf8'));
    for (const it of pack.items ?? []) {
      if (it.audioText) add(it.audioText);
      if (it.word?.lemma) add(it.word.lemma);
      if (it.word?.example) add(it.word.example);
    }
    // Passages are rendered per sentence; the app plays them in sequence.
    for (const p of pack.passages ?? []) for (const s of splitSentences(p.text)) add(s);
    // Story lines in the speaker's voice; glossary words for "my words".
    for (const st of pack.stories ?? []) {
      for (const l of st.lines ?? []) add(l.en, l.speaker ?? 'A');
      for (const g of Object.values(st.glossary ?? {})) add(g.lemma);
    }
  }
  return [...texts.values()];
}

const manifestPath = path.join(outDir, 'manifest.json');
fs.mkdirSync(outDir, { recursive: true });
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : { version: 1, engine: 'kokoro-82m-v1.0', entries: {} };

const texts = collectTexts().slice(0, limit);

// --prune: delete audio for texts that no longer exist in the content.
if (process.argv.includes('--prune')) {
  const keep = new Set();
  for (const { text, speaker } of collectTexts()) for (const accent of ACCENTS) for (const rate of Object.keys(RATES)) keep.add(audioKey(VOICES[accent][speaker], rate, text));
  let removed = 0;
  for (const [key, url] of Object.entries(manifest.entries)) {
    if (keep.has(key)) continue;
    fs.rmSync(path.join(root, 'public', url), { force: true });
    delete manifest.entries[key];
    removed++;
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(`pruned ${removed} files`);
}
const jobs = [];
for (const { text, speaker } of texts) {
  for (const accent of ACCENTS) {
    for (const [rate, speed] of Object.entries(RATES)) {
      const voice = VOICES[accent][speaker];
      const key = audioKey(voice, rate, text);
      if (!manifest.entries[key]) jobs.push({ text, voice, rate, speed, key });
    }
  }
}
console.log(`${texts.length} texts, ${jobs.length} files to render`);
if (!jobs.length) process.exit(0);

const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' });
const tmp = path.join(here, '.tmp.wav');
let n = 0;
for (const j of jobs) {
  const audio = await tts.generate(j.text, { voice: j.voice, speed: j.speed });
  await audio.save(tmp);
  const file = `${j.key}.mp3`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-b:a', '48k', path.join(outDir, file)]);
  manifest.entries[j.key] = `audio/${file}`;
  if (++n % 20 === 0) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
    console.log(`${n}/${jobs.length}`);
  }
}
fs.rmSync(tmp, { force: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`done: ${n} files`);
