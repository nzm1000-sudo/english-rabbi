import type { KidStage, KidTopic, KidWord, Phonics, Picture } from './schema';

/**
 * Question builders for the children's games. Pure and seeded, so they are
 * easy to test. Options always come from the same topic, so a wrong option
 * is a real alternative, never a trick.
 */
export type Rng = () => number;

export function seeded(seed: string): Rng {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export interface PictureQuestion {
  /** What is said in English. */
  say: string;
  target: KidWord;
  options: KidWord[];
}

/**
 * "Where is the ...?": hear a word, tap its picture. Words the child has not
 * mastered yet come first (`known` returns true for mastered words).
 */
export function listenQuestions(
  words: readonly KidWord[],
  opts: { stage: KidStage; topic?: KidTopic; count?: number; options?: number; known?: (w: KidWord) => boolean; seed: string },
): PictureQuestion[] {
  const rng = seeded(opts.seed);
  const pool = words.filter((w) => w.stages.includes(opts.stage) && (!opts.topic || w.topic === opts.topic));
  const fresh = shuffle(pool.filter((w) => !opts.known?.(w)), rng);
  const known = shuffle(pool.filter((w) => opts.known?.(w)), rng);
  const targets = [...fresh, ...known].slice(0, opts.count ?? 6);
  const n = opts.options ?? (opts.stage === 'little' ? 3 : 4);
  return targets.map((target) => {
    const sameTopic = pool.filter((w) => w.topic === target.topic && w.id !== target.id && !samePicture(w.picture, target.picture));
    const others = shuffle(sameTopic.length >= n - 1 ? sameTopic : pool.filter((w) => w.id !== target.id), rng).slice(0, n - 1);
    return { say: target.en, target, options: shuffle([target, ...others], rng) };
  });
}

function samePicture(a: Picture, b: Picture): boolean {
  return a.emoji === b.emoji && a.color === b.color && a.count === b.count;
}

export interface LetterQuestion {
  word: string;
  emoji: string;
  he: string;
  answer: string;
  options: string[];
}

/** "Which letter does it start with?": picture and word, pick the first letter. */
export function firstLetterQuestions(ph: Phonics, seed: string, count = 6): LetterQuestion[] {
  const rng = seeded(seed);
  const pool = [
    ...ph.letters.filter((l) => l.letter !== 'x').map((l) => ({ word: l.word, emoji: l.emoji, he: l.wordHe })),
    ...ph.families.flatMap((f) => f.words.filter((w) => w.emoji).map((w) => ({ word: w.en, emoji: w.emoji!, he: w.he }))),
  ];
  const unique = [...new Map(pool.map((p) => [p.word, p])).values()];
  return shuffle(unique, rng)
    .slice(0, count)
    .map((p) => {
      const answer = p.word[0]!.toLowerCase();
      const others = shuffle('abcdefghijklmnoprstuvwyz'.split('').filter((c) => c !== answer), rng).slice(0, 2);
      return { ...p, answer, options: shuffle([answer, ...others], rng) };
    });
}

export interface BuildQuestion {
  word: string;
  he: string;
  emoji?: string;
  tiles: string[];
}

/** Build a short word from letter tiles (the word's letters plus two extras). */
export function buildQuestions(ph: Phonics, seed: string, count = 5): BuildQuestion[] {
  const rng = seeded(seed);
  const all = ph.families.flatMap((f) => f.words.filter((w) => /^[a-z]{3,4}$/.test(w.en)));
  // Prefer words with a picture: a child who cannot read yet needs to see what to build.
  const pictured = all.filter((w) => w.emoji);
  const words = pictured.length >= count ? pictured : all;
  return shuffle(words, rng)
    .slice(0, count)
    .map((w) => {
      const extra = shuffle('abcdefghijklmnoprstuvwyz'.split('').filter((c) => !w.en.includes(c)), rng).slice(0, 2);
      return { word: w.en, he: w.he, ...(w.emoji ? { emoji: w.emoji } : {}), tiles: shuffle([...w.en.split(''), ...extra], rng) };
    });
}

export interface SightQuestion {
  word: string;
  he: string;
  sentence: { en: string; he: string };
  options: string[];
}

/** Hear a sight word, tap it among written words. */
export function sightQuestions(ph: Phonics, seed: string, level: number, count = 6): SightQuestion[] {
  const rng = seeded(seed);
  const pool = ph.sightWords.filter((s) => s.level <= level);
  return shuffle(pool, rng)
    .slice(0, count)
    .map((s) => {
      const others = shuffle(pool.filter((o) => o.en !== s.en), rng).slice(0, 2).map((o) => o.en);
      return { word: s.en, he: s.he, sentence: s.sentence, options: shuffle([s.en, ...others], rng) };
    });
}

/** Memory game: pairs of the same picture; the word is said when a card turns. */
export function memoryCards(words: readonly KidWord[], seed: string, pairs = 6): { key: string; word: KidWord }[] {
  const rng = seeded(seed);
  const chosen = shuffle(words, rng).slice(0, pairs);
  return shuffle(
    chosen.flatMap((w) => [
      { key: `${w.id}:1`, word: w },
      { key: `${w.id}:2`, word: w },
    ]),
    rng,
  );
}
