/**
 * Records the Hebrew phrases spoken in the children's area with natural
 * voices, instead of the phone's robotic one: Gemini TTS (a female voice for
 * the game guide, a male one for names), with Microsoft's Avri (edge-tts)
 * kept as the fallback for any phrase Gemini has not recorded yet.
 *
 * Usage (from this folder, Node 22.18+, Python 3 with `pip install edge-tts`):
 *   node hebrew.mjs            # renders what is missing
 *   node hebrew.mjs --prune    # also deletes phrases no longer used
 * Gemini needs GEMINI_API_KEY (or a proxy that adds it). On the free tier a
 * few requests a day are allowed; run again the next day to finish.
 *
 * Output: ../../public/audio/he/<key>.mp3 and manifest.json. The app's
 * speakHebrew() finds a phrase by the same key (audioKey.ts).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioKey } from '../../src/services/speech/audioKey.ts';
import { GUIDE_PHRASES, MENU_PHRASES, newStickerPhrase } from '../../src/features/kids/hebrewPhrases.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outDir = path.join(root, 'public/audio/he');
// Keep in sync with HEBREW_FALLBACK_VOICE / HEBREW_VOICE in src/services/speech/hebrewVoice.ts
const VOICE = 'he-IL-AvriNeural';
const RATE = '-8%';
const GEMINI_KEY = 'gemini-he-1';
// Chosen by ear on 2026-10-03 from samples of this model.
const GEMINI = { model: 'gemini-3.1-flash-tts-preview', checkModel: 'gemini-3.8-flash', batch: 12 };
const GUIDE_VOICE = 'Achernar';
const NAME_VOICE = 'Algieba';

/** Every phrase with its Gemini voice: the guide talks during games, names are said by the male voice. */
function collectPhrases() {
  const voices = new Map();
  const add = (t, v) => voices.has(t) || voices.set(t, v);
  const kid = (f) => JSON.parse(fs.readFileSync(path.join(root, 'content/kids', f), 'utf8'));
  for (const t of GUIDE_PHRASES) add(t, GUIDE_VOICE);
  for (const t of MENU_PHRASES) add(t, NAME_VOICE);
  for (const s of kid('stickers.json')) {
    add(newStickerPhrase(s.he), GUIDE_VOICE);
    add(s.he, NAME_VOICE);
  }
  for (const b of kid('books.json')) add(b.title.he, NAME_VOICE);
  // Topic names (TOPIC_INFO in src/features/kids/topics.ts).
  const topics = fs.readFileSync(path.join(root, 'src/features/kids/topics.ts'), 'utf8');
  for (const m of topics.matchAll(/he: '([^']+)'/g)) add(m[1], NAME_VOICE);
  return voices;
}

/** The voice adds up to 3 seconds of silence at the end; cut it so games flow. */
function trimSilence(file) {
  const tmp = `${file}.tmp.mp3`;
  const cut = 'silenceremove=start_periods=1:start_threshold=-45dB';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-af', `${cut},areverse,${cut},areverse,adelay=60,apad=pad_dur=0.15`, '-ac', '1', '-ar', '24000', '-b:a', '48k', tmp]);
  fs.renameSync(tmp, file);
}

const manifestPath = path.join(outDir, 'manifest.json');
fs.mkdirSync(outDir, { recursive: true });
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { version: 1, entries: {} };
manifest.engine = `${GEMINI.model} ${GUIDE_VOICE} (guide) / ${NAME_VOICE} (names); fallback edge-tts ${VOICE} ${RATE}`;
const phrases = collectPhrases();
const texts = [...phrases.keys()];
const keyOf = (t) => audioKey(VOICE, 'normal', t);
const geminiKeyOf = (t) => audioKey(GEMINI_KEY, 'normal', t);

if (process.argv.includes('--prune')) {
  const keep = new Set([...texts.map(keyOf), ...texts.map(geminiKeyOf)]);
  for (const [key, url] of Object.entries(manifest.entries)) {
    if (keep.has(key)) continue;
    fs.rmSync(path.join(root, 'public', url), { force: true });
    delete manifest.entries[key];
  }
}

const jobs = texts.filter((t) => !manifest.entries[keyOf(t)]).map((t) => ({ text: t, key: keyOf(t), out: path.join(outDir, `${keyOf(t)}.mp3`) }));
console.log(`${texts.length} phrases, ${jobs.length} to render`);
if (jobs.length) {
  const r = spawnSync('python3', [path.join(here, 'edge_he.py')], { input: JSON.stringify({ voice: VOICE, rate: RATE, jobs }), stdio: ['pipe', 'inherit', 'inherit'] });
  for (const j of jobs) {
    if (!fs.existsSync(j.out) || !fs.statSync(j.out).size) continue;
    trimSilence(j.out);
    manifest.entries[j.key] = `audio/he/${j.key}.mp3`;
  }
  if (r.status !== 0) console.error('some phrases failed; run again to retry');
}

const gJobs = texts.filter((t) => !manifest.entries[geminiKeyOf(t)]).map((t) => ({ text: t, voice: phrases.get(t), out: path.join(outDir, `${geminiKeyOf(t)}.mp3`) }));
console.log(`Gemini: ${gJobs.length} to render`);
if (gJobs.length) {
  const r = spawnSync('python3', [path.join(here, 'gemini_he.py')], { input: JSON.stringify({ ...GEMINI, jobs: gJobs }), stdio: ['pipe', 'inherit', 'inherit'] });
  for (const j of gJobs) {
    if (!fs.existsSync(j.out) || !fs.statSync(j.out).size) continue;
    trimSilence(j.out);
    manifest.entries[geminiKeyOf(j.text)] = `audio/he/${geminiKeyOf(j.text)}.mp3`;
  }
  if (r.status !== 0) console.error('Gemini failed; run again to retry');
}
manifest.entries = Object.fromEntries(Object.entries(manifest.entries).sort());
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
