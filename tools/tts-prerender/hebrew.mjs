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
import { GUIDE_PHRASES, MENU_PHRASES, PRAISE, newStickerPhrase } from '../../src/features/kids/hebrewPhrases.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outDir = path.join(root, 'public/audio/he');
// Keep in sync with HEBREW_FALLBACK_VOICE / HEBREW_VOICE in src/services/speech/hebrewVoice.ts
const VOICE = 'he-IL-AvriNeural';
const RATE = '-8%';
// One recording set per age: lively for 3-6 (little), calm for 7-8 (young).
const GEMINI_KEYS = { little: 'gemini-he-1', young: 'gemini-he-young-1' };
// Chosen by ear on 2026-10-03 from samples of this model.
// batch: phrases per request. 1 on a paid key; about 12 on the free tier (cut at the pauses).
const GEMINI = { model: 'gemini-3.1-flash-tts-preview', checkModels: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-flash-latest'], batch: Number(process.env.GEMINI_BATCH ?? 1) };
const GUIDE_VOICE = 'Achernar';
const NAME_VOICE = 'Algieba';
const HE = 'in natural, native Israeli Hebrew with clear diction';
const STYLES = {
  little: {
    praise: `Say with real joy and warm excitement, ${HE}, like a loving kindergarten teacher proud of a small child`,
    guide: `Say warmly, gently and encouragingly, ${HE}, like a kind kindergarten teacher inviting a small child to play`,
    name: `Say warmly and clearly with a friendly smile, ${HE}, naming it for a small child`,
  },
  // Ages 7-8 found the kindergarten tone too childish: calm, natural, no sing-song.
  young: {
    praise: `Say with calm, sincere approval, ${HE}, in a natural adult voice, like a friendly teacher speaking to an 8-year-old. Not childish, not sing-song, not exaggerated`,
    guide: `Say calmly and clearly in a natural, friendly tone, ${HE}, like a teacher giving a short instruction to an 8-year-old. Not childish, not sing-song`,
    name: `Say clearly in a natural, friendly tone, ${HE}, like reading out a title to an 8-year-old. Not childish, not sing-song`,
  },
};

// Words the voice misreads without vowels: only the text sent to Gemini gets the niqqud.
const NIQQUD = { טלה: 'טָלֶה', חלה: 'חַלָּה', 'פרת משה רבנו': 'פָּרַת מֹשֶׁה רַבֵּנוּ', המילה: 'הַמִּלָּה' };
const withNiqqud = (t) => Object.entries(NIQQUD).reduce((s, [plain, vowelled]) => s.replace(new RegExp(`(^|\\s|!)${plain}(?=$|\\s|[!?.])`, 'g'), `$1${vowelled}`), t);

/** Every phrase with its Gemini voice and kind: the female guide talks during games, names are said by the male voice. */
function collectPhrases() {
  const out = new Map();
  const add = (t, voice, kind) => out.has(t) || out.set(t, { voice, kind });
  const kid = (f) => JSON.parse(fs.readFileSync(path.join(root, 'content/kids', f), 'utf8'));
  const praise = new Set([...PRAISE, 'כל הכבוד! אספתם את כל המדבקות']);
  for (const t of GUIDE_PHRASES) add(t, GUIDE_VOICE, praise.has(t) ? 'praise' : 'guide');
  for (const t of MENU_PHRASES) add(t, NAME_VOICE, 'name');
  for (const s of kid('stickers.json')) {
    add(newStickerPhrase(s.he), GUIDE_VOICE, 'praise');
    add(s.he, NAME_VOICE, 'name');
  }
  for (const b of kid('books.json')) add(b.title.he, NAME_VOICE, 'name');
  // Topic names (TOPIC_INFO in src/features/kids/topics.ts).
  const topics = fs.readFileSync(path.join(root, 'src/features/kids/topics.ts'), 'utf8');
  for (const m of topics.matchAll(/he: '([^']+)'/g)) add(m[1], NAME_VOICE, 'name');
  return out;
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
const geminiKeyOf = (stage, t) => audioKey(GEMINI_KEYS[stage], 'normal', t);
const STAGES = ['little', 'young'];

if (process.argv.includes('--prune')) {
  const keep = new Set([...texts.map(keyOf), ...STAGES.flatMap((st) => texts.map((t) => geminiKeyOf(st, t)))]);
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

// The little ones' set first: it is the one most played.
const gJobs = STAGES.flatMap((stage) =>
  texts
    .map((t) => ({ t, key: geminiKeyOf(stage, t) }))
    .filter(({ key }) => !manifest.entries[key])
    .map(({ t, key }) => {
      const { voice, kind } = phrases.get(t);
      return { text: t, say: withNiqqud(t), key, voice, style: STYLES[stage][kind], out: path.join(outDir, `${key}.mp3`) };
    }),
);
console.log(`Gemini: ${gJobs.length} to render`);
if (gJobs.length) {
  const r = spawnSync('python3', [path.join(here, 'gemini_he.py')], { input: JSON.stringify({ ...GEMINI, jobs: gJobs }), stdio: ['pipe', 'inherit', 'inherit'] });
  for (const j of gJobs) {
    if (!fs.existsSync(j.out) || !fs.statSync(j.out).size) continue;
    trimSilence(j.out);
    manifest.entries[j.key] = `audio/he/${j.key}.mp3`;
  }
  if (r.status !== 0) console.error('Gemini failed; run again to retry');
}
manifest.entries = Object.fromEntries(Object.entries(manifest.entries).sort());
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
