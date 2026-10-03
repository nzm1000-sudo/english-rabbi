import type { KidTopic, KidWord, Phonics } from './schema';

/**
 * Which 3D illustration (public/pics/<id>.webp) shows what. Pure functions:
 * the caller passes the set of ids that exist (content/kids/pics.json), so
 * a missing picture always falls back to the emoji.
 *
 * Id scheme: w-<word> (picture words), s-<sticker id>, m-<mascot>, c-<character>,
 * b-<book slug>-<page index> (a full page illustration, when one exists).
 */

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Book ids contain dots ("kb.little.farm"); picture ids use dashes. */
export const bookSlug = (bookId: string) => slug(bookId.replace(/\./g, '-'));
export const bookPageId = (bookId: string, pageIndex: number) => `b-${bookSlug(bookId)}-${pageIndex}`;
export const wordId = (en: string) => `w-${slug(en)}`;

/** One representative picture word per topic (first one that exists wins). */
export const TOPIC_PICTURES: Record<KidTopic, readonly string[]> = {
  colors: ['crayon', 'red'],
  numbers: ['ten'],
  animals: ['lion', 'dog'],
  food: ['apple', 'banana'],
  body: ['hand', 'eyes'],
  family: ['family', 'mom'],
  home: ['house', 'bed'],
  clothes: ['shirt', 'dress'],
  nature: ['tree', 'flower'],
  shabbat: ['candles', 'challah'],
  holidays: ['menorah', 'doughnut'],
  toys: ['teddy-bear', 'ball'],
  actions: ['run', 'clap'],
  feelings: ['happy', 'love'],
};

/** Topics drawn as art instead of a photo-like picture (a row of balls reads poorly as a tile). */
export const TOPIC_ART: Partial<Record<KidTopic, 'numbers'>> = { numbers: 'numbers' };

export function topicPictureId(topic: KidTopic, available: ReadonlySet<string>): string | undefined {
  if (TOPIC_ART[topic]) return undefined;
  return TOPIC_PICTURES[topic].map(wordId).find((id) => available.has(id));
}

/** Strip variation selectors so "🕯️" and "🕯" match. */
const bare = (e: string) => e.replace(/[︎️]/g, '');

/** Split an emoji string into single emoji (graphemes). */
export function splitEmoji(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: 'grapheme' }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return [...new Seg(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment).filter((x) => x.trim());
  return [...s].filter((x) => x.trim() && !/[︎️‍]/.test(x));
}

/**
 * Book scenes use a few emoji that are not picture words, or mean
 * something more specific in a story (Ari, the boy in the young books, is
 * drawn as "brother"; an umbrella is not "rain").
 */
const SCENE_WORDS: Record<string, string> = {
  '🧒': 'brother',
  '☔': 'umbrella',
  '🌧': 'rain',
  '👔': 'shirt',
  '🪥': 'tooth',
  '🚐': 'van',
  '🌸': 'flower',
  '🌿': 'plant',
  '🪵': 'log',
  '🌌': 'star',
  '🍽': 'plate',
  '🥣': 'soup',
  '💐': 'flowers',
};

/**
 * The storybook characters (c-<name>), drawn the same in every book. They
 * win over the generic word pictures when they exist.
 */
const SCENE_CHARACTERS: Record<string, string> = {
  '🧒': 'c-ari',
  '👧': 'c-tamar',
  '👩': 'c-ima',
  '👨': 'c-abba',
  '👴': 'c-grandpa',
  '👵': 'c-grandma',
  '👶': 'c-eli',
};

/** Emoji -> English word, from the picture words and phonics, plus the scene extras. */
export function emojiWords(words: readonly KidWord[], phonics?: Phonics): Map<string, string> {
  const m = new Map<string, string>();
  const add = (e: string | undefined, en: string) => {
    if (e && !m.has(bare(e))) m.set(bare(e), en);
  };
  for (const [e, en] of Object.entries(SCENE_WORDS)) add(e, en);
  for (const w of words) add(w.picture.emoji, w.en);
  for (const l of phonics?.letters ?? []) add(l.emoji, l.word);
  for (const f of phonics?.families ?? []) for (const w of f.words) add(w.emoji, w.en);
  return m;
}

const FEELING_IDS = new Set(['happy', 'sad', 'angry', 'scared', 'tired', 'sick', 'love'].map(wordId));

/** Words in a sentence that would show the wrong picture (verbs, adjectives, small words). */
const TEXT_STOP = new Set(['a', 'i', 'can', 'light', 'stop', 'win', 'wet', 'nap', 'help', 'read', 'run', 'walk', 'eat', 'red', 'hot', 'cold', 'sad', 'happy', 'love', 'hug', 'wave', 'cook', 'sing', 'think', 'pray', 'ride', 'swim', 'wash', 'write', 'drink', 'sleep', 'clap', 'climb', 'laugh', 'pin', 'pen', 'map']);

/**
 * The pictures (ids) that illustrate a book page or cover: the scene emoji
 * first (they are what the author meant), then nouns from the sentence when
 * the emoji have no picture. Distinct, at most `max`.
 */
export function scenePictureIds(
  scene: string,
  text: string,
  ctx: { available: ReadonlySet<string>; emoji: ReadonlyMap<string, string> },
  max = 2,
): string[] {
  const out: string[] = [];
  const push = (id: string) => {
    if (ctx.available.has(id) && !out.includes(id)) out.push(id);
  };
  for (const e of splitEmoji(scene)) {
    const character = SCENE_CHARACTERS[bare(e)];
    if (character && ctx.available.has(character)) {
      push(character);
      continue;
    }
    const en = ctx.emoji.get(bare(e));
    if (en) push(wordId(en));
  }
  // A character already shows the feeling on their face; a second, generic face would read as someone else.
  if (out.some((id) => id.startsWith('c-'))) {
    const kept = out.filter((id) => !FEELING_IDS.has(id));
    out.splice(0, out.length, ...kept);
  }
  if (!out.length) {
    for (const raw of text.toLowerCase().split(/[^a-z'-]+/)) {
      const t = raw.replace(/'s$/, '');
      if (!t || TEXT_STOP.has(t)) continue;
      for (const c of [t, t.replace(/s$/, ''), t.replace(/es$/, '')]) {
        if (TEXT_STOP.has(c)) continue;
        if (ctx.available.has(wordId(c)) && out.length < max) {
          push(wordId(c));
          break;
        }
      }
    }
  }
  return out.slice(0, max);
}
