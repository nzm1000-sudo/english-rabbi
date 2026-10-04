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
import { dialogueLines, questionSpeech, splitSentences } from '../../src/services/speech/textPrep.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outDir = path.join(root, 'public/audio');
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

// Keep in sync with PRERENDER_VOICES in src/services/speech/voiceProfiles.ts.
// en-US: Microsoft neural voices (edge-tts), chosen by ear on 2026-10-04 over
// Kokoro, which sounded nasal. en-GB stays on Kokoro (not rendered by default).
const VOICES = { 'en-US': { A: 'en-US-JennyNeural', B: 'en-US-AndrewNeural' }, 'en-GB': { A: 'bf_emma', B: 'bm_george' } };
const isEdge = (voice) => voice.endsWith('Neural');
const EDGE_RATE = { normal: '+0%', slow: '-20%' };
// Accents to render. Chosen by ear on 2026-10-02: American only.
// Add en-GB with: --accents en-US,en-GB
const accArg = process.argv.indexOf('--accents');
const ACCENTS = accArg > 0 ? process.argv[accArg + 1].split(',') : ['en-US'];
const RATES = { normal: 1, slow: 0.8 };
const ALL_RATES = Object.keys(RATES);
const TEST_SENTENCES = [
  'Hello, my name is Sarah.',
  "I'd like to know what you're doing tomorrow.",
  'Have you ever been to London?',
  'Although it was raining, we decided to go outside.',
  "I would've called you if I'd known you were home.",
];

/** Texts to render, with the dialogue speaker ("A" or "B") that says them. */
function collectTexts() {
  const texts = new Map(TEST_SENTENCES.map((t) => [`A|${t}`, { text: t, speaker: 'A', rates: ALL_RATES }]));
  const add = (text, speaker = 'A', rates = ALL_RATES) => {
    const prev = texts.get(`${speaker}|${text}`);
    texts.set(`${speaker}|${text}`, { text, speaker, rates: prev && prev.rates.length > rates.length ? prev.rates : rates });
  };
  const HEBREW = /[\u0590-\u05ff]/;
  // Questions and English answer options: normal speed only (slowed on playback).
  const addQuestion = (it) => {
    if ((it.type === 'choice' || it.type === 'typed') && (it.promptLanguage ?? 'en') === 'en' && !HEBREW.test(it.prompt)) {
      add(questionSpeech(it.prompt), 'B', ['normal']);
    }
    // Questions and their options are read by the male voice (owner's choice, 2026-10-04).
    if (it.type === 'choice') for (const o of it.options) if (!HEBREW.test(o.text)) add(o.text, 'B', ['normal']);
  };
  const packDir = path.join(root, 'content/packs');
  for (const f of fs.readdirSync(packDir).filter((f) => f.endsWith('.json'))) {
    const pack = JSON.parse(fs.readFileSync(path.join(packDir, f), 'utf8'));
    for (const it of pack.items ?? []) {
      // A written dialogue is played line by line in two voices (SpeakButton).
      const lines = it.audioText && dialogueLines(it.audioText);
      if (lines) for (const l of lines) add(l.text, l.speaker);
      else if (it.audioText) add(it.audioText);
      if (it.word?.lemma) add(it.word.lemma);
      if (it.word?.example) add(it.word.example);
      addQuestion(it);
    }
    // Passages are rendered per sentence; the app plays them in sequence.
    for (const p of pack.passages ?? []) for (const s of splitSentences(p.text)) add(s);
    // Story lines in the speaker's voice; glossary words for "my words".
    for (const st of pack.stories ?? []) {
      for (const l of st.lines ?? []) add(l.en, l.speaker ?? 'A');
      for (const g of Object.values(st.glossary ?? {})) add(g.lemma);
      for (const q of st.questions ?? []) addQuestion(q.item);
    }
  }
  // Children's area: words, sentences, phonics and little books (normal speed;
  // slow playback slows the recording down).
  const kidsDir = path.join(root, 'content/kids');
  const kid = (f) => (fs.existsSync(path.join(kidsDir, f)) ? JSON.parse(fs.readFileSync(path.join(kidsDir, f), 'utf8')) : null);
  for (const w of kid('words.json') ?? []) {
    add(w.en, 'A', ['normal']);
    if (w.sentence) add(w.sentence.en, 'A', ['normal']);
  }
  const ph = kid('phonics.json');
  if (ph) {
    for (const l of ph.letters) add(l.word, 'A', ['normal']);
    for (const f of ph.families) for (const w of f.words) add(w.en, 'A', ['normal']);
    for (const s of ph.sightWords) {
      add(s.en, 'A', ['normal']);
      add(s.sentence.en, 'A', ['normal']);
    }
  }
  for (const b of kid('books.json') ?? []) for (const pg of b.pages) add(pg.en, 'A', ['normal']);
  // Example sentences on the memory anchor cards.
  const anchorDir = path.join(root, 'content/anchors');
  for (const f of fs.readdirSync(anchorDir).filter((f) => f.endsWith('.json'))) {
    for (const a of JSON.parse(fs.readFileSync(path.join(anchorDir, f), 'utf8'))) {
      for (const e of a.examples ?? []) add(e.en, 'A', ['normal']);
      // The right sentences of the full explanations (the wrong ones are never played).
      for (const lv of Object.values(a.levels ?? {})) for (const e of lv.examples ?? []) add(e.ok, 'A', ['normal']);
    }
  }
  // Everything also gets a real slow recording: slowing a normal one down on
  // playback made the voice warble.
  return [...texts.values()].map((t) => ({ ...t, rates: ALL_RATES }));
}

const manifestPath = path.join(outDir, 'manifest.json');
fs.mkdirSync(outDir, { recursive: true });
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : { version: 1, engine: 'edge-neural', entries: {} };

const texts = collectTexts().slice(0, limit);

// --prune: delete audio for texts that no longer exist in the content.
if (process.argv.includes('--prune')) {
  const keep = new Set();
  for (const { text, speaker, rates } of collectTexts()) for (const accent of ACCENTS) for (const rate of rates) keep.add(audioKey(VOICES[accent][speaker], rate, text));
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
for (const { text, speaker, rates } of texts) {
  for (const accent of ACCENTS) {
    for (const rate of rates) {
      const speed = RATES[rate];
      const voice = VOICES[accent][speaker];
      const key = audioKey(voice, rate, text);
      if (!manifest.entries[key]) jobs.push({ text, voice, rate, speed, key });
    }
  }
}
console.log(`${texts.length} texts, ${jobs.length} files to render`);
if (!jobs.length) process.exit(0);

let n = 0;
const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));

// Microsoft voices: rendered in batches by edge_en.py, a few at a time.
const edgeJobs = jobs.filter((j) => isEdge(j.voice));
for (let i = 0; i < edgeJobs.length; i += 200) {
  const batch = edgeJobs.slice(i, i + 200).map((j) => ({ ...j, out: path.join(outDir, `${j.key}.mp3`) }));
  const input = JSON.stringify({ jobs: batch.map((j) => ({ text: j.text, voice: j.voice, rate: EDGE_RATE[j.rate], out: j.out })) });
  const log = execFileSync('python3', [path.join(here, 'edge_en.py')], { input, encoding: 'utf8', maxBuffer: 1 << 26 });
  for (const j of batch) if (fs.existsSync(j.out)) manifest.entries[j.key] = `audio/${j.key}.mp3`;
  const failed = log.split('\n').filter((l) => l.startsWith('fail'));
  for (const f of failed) console.log(f);
  n += batch.length - failed.length;
  save();
  console.log(`${Math.min(i + 200, edgeJobs.length)}/${edgeJobs.length}`);
}

const kokoroJobs = jobs.filter((j) => !isEdge(j.voice));
const tts = kokoroJobs.length ? await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' }) : null;
const tmp = path.join(here, '.tmp.wav');
for (const j of kokoroJobs) {
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
