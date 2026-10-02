import { z } from 'zod';
import { CEFR_LEVELS } from '../skills/cefr';
import { INTERESTS } from '../student/student';

/**
 * Content schema.
 *
 * Every learning item is plain data, validated at load time. Components never
 * hold content. New exercise types are added as new members of the
 * discriminated union `ContentItem`, so old packs stay valid.
 */

export const Bilingual = z.object({ he: z.string().min(1), en: z.string().min(1) });
export type Bilingual = z.infer<typeof Bilingual>;

/** A text that may be read aloud and shown in English. */
const EnglishText = z.string().min(1);

const Hint = Bilingual;

const SourceRef = z.string().min(1);

const base = {
  id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/, 'lowercase id with dots and dashes'),
  /** Bump when the item changes in a way that affects scoring. */
  version: z.number().int().positive().default(1),
  /** Primary skill. Must exist in the taxonomy. */
  skill: z.string().min(1),
  /** Extra skills this item also gives evidence for, with weight 0..1. */
  alsoSkills: z.array(z.object({ id: z.string(), weight: z.number().min(0).max(1) })).default([]),
  level: z.enum(CEFR_LEVELS),
  /** Position within the level band, 0 (easiest) .. 1 (hardest). */
  difficulty: z.number().min(0).max(1).default(0.5),
  /**
   * Knowledge unit tracked by spaced repetition. Several items can share one
   * unit, e.g. all exercises for the word "beautiful" use "word:beautiful".
   * Defaults to "item:<id>".
   */
  unit: z.string().optional(),
  instruction: Bilingual,
  explanation: Bilingual,
  /** Ordered hint ladder. Shown one by one before the explanation. */
  hints: z.array(Hint).max(3).default([]),
  /** Misconceptions this item can detect or repair. */
  targetsMisconceptions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  interests: z.array(z.enum(INTERESTS)).default([]),
  /** 'read': text shown. 'listen': audio first, text hidden until answered. */
  modality: z.enum(['read', 'listen']).default('read'),
  estimatedTimeSec: z.number().positive().default(20),
  source: SourceRef,
  language: z.literal('en').default('en'),
  passageId: z.string().optional(),
  word: z
    .object({
      lemma: z.string(),
      pos: z.string().optional(),
      he: z.string(),
      example: EnglishText.optional(),
    })
    .optional(),
};

export const ChoiceOption = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  /** Misconception revealed when this wrong option is chosen. */
  misconception: z.string().optional(),
  feedback: Bilingual.optional(),
});
export type ChoiceOption = z.infer<typeof ChoiceOption>;

export const ChoiceItem = z
  .object({
    ...base,
    type: z.literal('choice'),
    prompt: z.string().min(1),
    /** Text read aloud. Defaults to prompt for listen items. */
    audioText: EnglishText.optional(),
    promptLanguage: z.enum(['en', 'he']).default('en'),
    options: z.array(ChoiceOption).min(2).max(6),
    correctOptionId: z.string(),
  })
  .refine((i) => i.options.some((o) => o.id === i.correctOptionId), {
    message: 'correctOptionId must match an option',
  })
  .refine((i) => new Set(i.options.map((o) => o.id)).size === i.options.length, {
    message: 'option ids must be unique',
  });

export const KnownError = z.object({
  answer: z.string().min(1),
  misconception: z.string().optional(),
  feedback: Bilingual,
});

export const TypedItem = z.object({
  ...base,
  type: z.literal('typed'),
  /** Use "___" to mark the gap in a cloze sentence. */
  prompt: z.string().min(1),
  audioText: EnglishText.optional(),
  promptLanguage: z.enum(['en', 'he']).default('en'),
  /** All accepted answers. The first one is shown as the model answer. */
  answers: z.array(z.string().min(1)).min(1),
  knownErrors: z.array(KnownError).default([]),
});

/** Free writing. Scored later by an evaluator (AI or parent). Not auto-scored. */
export const OpenWritingItem = z.object({
  ...base,
  type: z.literal('open-writing'),
  prompt: z.string().min(1),
  minWords: z.number().int().positive().default(1),
  maxWords: z.number().int().positive().optional(),
  rubric: z.array(Bilingual).default([]),
});

export const ContentItem = z.union([ChoiceItem, TypedItem, OpenWritingItem]);
export type ContentItem = z.infer<typeof ContentItem>;
export type ChoiceItem = z.infer<typeof ChoiceItem>;
export type TypedItem = z.infer<typeof TypedItem>;
export type OpenWritingItem = z.infer<typeof OpenWritingItem>;

export const Passage = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  level: z.enum(CEFR_LEVELS),
  text: z.string().min(1),
  /** Optional two-voice dialogue lines for listening. */
  dialogue: z.array(z.object({ speaker: z.enum(['A', 'B']), text: z.string().min(1) })).optional(),
  interests: z.array(z.enum(INTERESTS)).default([]),
  source: SourceRef,
});
export type Passage = z.infer<typeof Passage>;

/**
 * Source metadata. Required for every item. Content from a source whose
 * status is not "approved" is quarantined: it is loaded for review only and
 * never served to students.
 */
export const Source = z.object({
  id: z.string().min(1),
  kind: z.enum(['original', 'public-domain', 'creative-commons', 'oer', 'other']),
  title: z.string().min(1),
  author: z.string().optional(),
  url: z.string().url().optional(),
  license: z.string().min(1),
  dateAccessed: z.string().optional(),
  usageNotes: z.string().optional(),
  status: z.enum(['approved', 'needs-review', 'rejected']),
});
export type Source = z.infer<typeof Source>;

export const Misconception = z.object({
  id: z.string().min(1),
  skill: z.string().min(1),
  /** Short note in the learner memory, e.g. "confuses much and many". */
  note: Bilingual,
  /** Short teaching tip used when the pattern repeats. */
  tip: Bilingual,
});
export type Misconception = z.infer<typeof Misconception>;

export const ContentPack = z.object({
  packId: z.string().min(1),
  schemaVersion: z.literal(1),
  title: z.string(),
  items: z.array(z.unknown()).default([]),
  passages: z.array(z.unknown()).default([]),
});
export type ContentPack = z.infer<typeof ContentPack>;

export function unitOf(item: Pick<ContentItem, 'id' | 'unit'>): string {
  return item.unit ?? `item:${item.id}`;
}
