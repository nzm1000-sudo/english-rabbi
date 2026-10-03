import { z } from 'zod';

/**
 * Content for young children. Two stages:
 *  - little (ages 3-6): no reading at all. Pictures, sound, tap.
 *  - young (ages 6-12, early readers): letters and sounds, short words,
 *    sight words, little books.
 * Pictures are emoji (crisp on iPhone, offline, no files), a color swatch,
 * or a count of dots for numbers.
 */
export const KID_STAGES = ['little', 'young'] as const;
export type KidStage = (typeof KID_STAGES)[number];

export const KID_TOPICS = [
  'colors', 'numbers', 'animals', 'food', 'body', 'family', 'home', 'clothes',
  'nature', 'shabbat', 'holidays', 'toys', 'actions', 'feelings',
] as const;
export type KidTopic = (typeof KID_TOPICS)[number];

export const Picture = z
  .object({
    emoji: z.string().min(1).optional(),
    /** Hex color, for color words. */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    /** Number of dots, for number words. */
    count: z.number().int().min(0).max(20).optional(),
  })
  .refine((p) => [p.emoji, p.color, p.count].filter((x) => x !== undefined).length === 1, { message: 'exactly one of emoji, color, count' });
export type Picture = z.infer<typeof Picture>;

export const KidWord = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
  /** The English word as said and shown, lowercase unless a name. */
  en: z.string().min(1),
  he: z.string().min(1),
  picture: Picture,
  topic: z.enum(KID_TOPICS),
  stages: z.array(z.enum(KID_STAGES)).min(1),
  /** A short sentence a 4-year-old understands, e.g. "The dog is big." */
  sentence: z.object({ en: z.string().min(1), he: z.string().min(1) }).optional(),
});
export type KidWord = z.infer<typeof KidWord>;

export const Letter = z.object({
  letter: z.string().regex(/^[a-z]$/),
  /** How the sound is said, in Hebrew, for the parent: "כמו ב׳ בבית". */
  soundHe: z.string().min(1),
  word: z.string().min(1),
  emoji: z.string().min(1),
  wordHe: z.string().min(1),
});

export const WordFamily = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** The shared ending, e.g. "at". */
  rime: z.string().min(1),
  words: z.array(z.object({ en: z.string().min(1), he: z.string().min(1), emoji: z.string().min(1).optional() })).min(3),
});

export const SightWord = z.object({
  en: z.string().min(1),
  he: z.string().min(1),
  /** 1 = first words (I, a, the), 3 = later. */
  level: z.number().int().min(1).max(3),
  sentence: z.object({ en: z.string().min(1), he: z.string().min(1) }),
});

export const Phonics = z.object({
  letters: z.array(Letter).length(26),
  families: z.array(WordFamily).min(1),
  sightWords: z.array(SightWord).min(1),
});
export type Phonics = z.infer<typeof Phonics>;

export const KidBook = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
  title: z.object({ he: z.string().min(1), en: z.string().min(1) }),
  stage: z.enum(KID_STAGES),
  /** The picture on the cover, a few emoji. */
  cover: z.string().min(1),
  pages: z
    .array(
      z.object({
        en: z.string().min(1),
        he: z.string().min(1),
        /** The page picture: 1 to 4 emoji that show what the sentence says. */
        scene: z.string().min(1),
      }),
    )
    .min(3)
    .max(10),
});
export type KidBook = z.infer<typeof KidBook>;
