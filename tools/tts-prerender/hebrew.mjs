/**
 * Records the Hebrew phrases spoken in the children's area with a natural
 * neural Hebrew voice, instead of the phone's robotic one.
 *
 * Usage (from this folder, Node 22.18+, Python 3 with `pip install edge-tts`):
 *   node hebrew.mjs            # renders what is missing
 *   node hebrew.mjs --prune    # also deletes phrases no longer used
 *
 * Output: ../../public/audio/he/<key>.mp3 and manifest.json. The app's
 * speakHebrew() finds a phrase by the same key (audioKey.ts).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioKey } from '../../src/services/speech/audioKey.ts';
import { KIDS_PHRASES, newStickerPhrase } from '../../src/features/kids/hebrewPhrases.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outDir = path.join(root, 'public/audio/he');
// Keep in sync with HEBREW_VOICE in src/services/speech/hebrewVoice.ts
const VOICE = 'he-IL-AvriNeural';
const RATE = '-8%';

function collectTexts() {
  const texts = new Set(KIDS_PHRASES);
  const kid = (f) => JSON.parse(fs.readFileSync(path.join(root, 'content/kids', f), 'utf8'));
  for (const s of kid('stickers.json')) {
    texts.add(s.he);
    texts.add(newStickerPhrase(s.he));
  }
  for (const b of kid('books.json')) texts.add(b.title.he);
  // Topic names (TOPIC_INFO in src/features/kids/topics.ts).
  const topics = fs.readFileSync(path.join(root, 'src/features/kids/topics.ts'), 'utf8');
  for (const m of topics.matchAll(/he: '([^']+)'/g)) texts.add(m[1]);
  return [...texts];
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
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { version: 1, engine: `edge-tts ${VOICE} ${RATE}`, entries: {} };
const texts = collectTexts();
const keyOf = (t) => audioKey(VOICE, 'normal', t);

if (process.argv.includes('--prune')) {
  const keep = new Set(texts.map(keyOf));
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
manifest.entries = Object.fromEntries(Object.entries(manifest.entries).sort());
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
