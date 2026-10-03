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
  /** Memory anchor card shown with the explanation (content/anchors). Defaults to the skill's anchor. */
  anchor: z.string().optional(),
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

/**
 * Build the sentence: the learner orders word tiles. `answer` is the target
 * sentence; tiles are its words plus optional distractor words.
 * Generated from cloze items (content/generate.ts), not hand-authored.
 */
export const OrderItem = z.object({
  ...base,
  type: z.literal('order'),
  prompt: z.string().min(1),
  answer: z.string().min(1),
  /** Other correct word orders (e.g. a time phrase at the start or the end). */
  alternatives: z.array(z.string().min(1)).default([]),
  audioText: EnglishText.optional(),
  distractors: z.array(z.object({ text: z.string().min(1), misconception: z.string().optional() })).default([]),
  /** "he": `prompt` is a Hebrew sentence to translate, shown above the tiles. */
  promptLanguage: z.enum(['en', 'he']).optional(),
});

/**
 * Spot the mistake: one word in `sentence` is wrong. The learner taps it and
 * picks the fix. Tokens are the sentence split on spaces; `wrongIndex`
 * points at the wrong token. `correction` replaces that token ("" deletes
 * it) and must turn `sentence` into `corrected`.
 */
export const FixItem = z
  .object({
    ...base,
    type: z.literal('fix'),
    /** Not shown. Kept so every item has a prompt. */
    prompt: z.string().min(1).default('Find the mistake'),
    sentence: z.string().min(1),
    wrongIndex: z.number().int().min(0),
    correction: z.string(),
    /** Other replacements offered with the correction. Wrong in this sentence. */
    distractors: z.array(z.string()).min(2).max(3),
    corrected: z.string().min(1),
    /** Read after the answer. Must equal `corrected`. */
    audioText: EnglishText.optional(),
    /** Shown in the banner: what the learner meant, in Hebrew. */
    meaning: z.string().min(1).optional(),
  })
  .refine((i) => i.wrongIndex < i.sentence.trim().split(/\s+/).length, { message: 'wrongIndex out of range' })
  .refine((i) => applyFix(i.sentence, i.wrongIndex, i.correction) === i.corrected.trim(), {
    message: 'sentence with the correction must equal corrected',
  })
  .refine((i) => !i.audioText || i.audioText === i.corrected, { message: 'audioText must equal corrected' })
  .refine((i) => !i.distractors.some((d) => d.trim().toLowerCase() === i.correction.trim().toLowerCase()), {
    message: 'a distractor equals the correction',
  });

/** Replaces token `index` (keeping its punctuation) and returns the sentence. */
export function applyFix(sentence: string, index: number, correction: string): string {
  const tokens = sentence.trim().split(/\s+/);
  const tok = tokens[index] ?? '';
  const lead = tok.match(/^[^\p{L}\p{N}']*/u)?.[0] ?? '';
  const trail = tok.match(/[^\p{L}\p{N}']*$/u)?.[0] ?? '';
  const out = [...tokens];
  if (correction.trim()) {
    out[index] = lead + correction.trim() + trail;
  } else {
    out.splice(index, 1);
    // A deleted last word leaves its end mark on the word before it.
    if (trail && index > 0 && index === tokens.length - 1) out[index - 1] += trail;
  }
  const joined = out.join(' ');
  // Keep the capital at the start of the sentence.
  return index === 0 && joined ? joined[0]!.toUpperCase() + joined.slice(1) : joined;
}

export const ContentItem = z.union([ChoiceItem, TypedItem, OpenWritingItem, OrderItem, FixItem]);
export type ContentItem = z.infer<typeof ContentItem>;
export type ChoiceItem = z.infer<typeof ChoiceItem>;
export type TypedItem = z.infer<typeof TypedItem>;
export type OpenWritingItem = z.infer<typeof OpenWritingItem>;
export type OrderItem = z.infer<typeof OrderItem>;
export type FixItem = z.infer<typeof FixItem>;

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

/**
 * Lesson: a short explanation of one skill, read before or after practice.
 * Hebrew-first, with English examples. Blocks keep layout out of content.
 */
export const LessonBlock = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), he: z.string().min(1), en: z.string().optional() }),
  z.object({ kind: z.literal('rule'), he: z.string().min(1), pattern: z.string().min(1) }),
  z.object({
    kind: z.literal('examples'),
    items: z.array(z.object({ en: z.string().min(1), he: z.string().optional(), note: z.string().optional() })).min(1),
  }),
  z.object({ kind: z.literal('mistake'), wrong: z.string().min(1), right: z.string().min(1), he: z.string().min(1) }),
  z.object({ kind: z.literal('tip'), he: z.string().min(1) }),
  z.object({
    kind: z.literal('table'),
    head: z.array(z.string()).min(2),
    rows: z.array(z.array(z.string())).min(1),
  }),
]);
export type LessonBlock = z.infer<typeof LessonBlock>;

export const Lesson = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
  skill: z.string().min(1),
  level: z.enum(CEFR_LEVELS),
  title: Bilingual,
  /** One Hebrew sentence: what the learner will be able to do. */
  goal: z.string().min(1),
  blocks: z.array(LessonBlock).min(2),
  source: SourceRef,
});
export type Lesson = z.infer<typeof Lesson>;

export const ContentPack = z.object({
  packId: z.string().min(1),
  schemaVersion: z.literal(1),
  title: z.string(),
  items: z.array(z.unknown()).default([]),
  passages: z.array(z.unknown()).default([]),
  lessons: z.array(z.unknown()).default([]),
  stories: z.array(z.unknown()).default([]),
});
export type ContentPack = z.infer<typeof ContentPack>;

export function unitOf(item: Pick<ContentItem, 'id' | 'unit'>): string {
  return item.unit ?? `item:${item.id}`;
}

/**
 * A short graded story. Read stories have narration; dialogue stories are
 * spoken by two voices (A: female voice, B: male voice). Lines without a
 * speaker are narration, read by voice A.
 *
 * Every English word in the lines must have a glossary entry (key: the
 * lowercase word as written, without punctuation), except the very common
 * words in STORY_STOPWORDS. Tapping a word shows its gloss and saves it to
 * the learner's "my words".
 */
export const StoryLine = z.object({
  speaker: z.enum(['A', 'B']).optional(),
  en: z.string().min(1),
  he: z.string().min(1),
});
export type StoryLine = z.infer<typeof StoryLine>;

export const StoryQuestion = z.object({
  /** Shown after this line index (0-based). */
  after: z.number().int().min(0),
  item: ChoiceItem,
});

export const Story = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
    title: Bilingual,
    kind: z.enum(['read', 'dialogue']),
    level: z.enum(CEFR_LEVELS),
    /** Names of the two dialogue voices, e.g. { A: "Tamar", B: "Ari" }. */
    cast: z.object({ A: z.string().min(1), B: z.string().min(1) }).optional(),
    lines: z.array(StoryLine).min(4),
    glossary: z.record(z.string(), z.object({ lemma: z.string().min(1), he: z.string().min(1) })),
    questions: z.array(StoryQuestion).min(2),
    /** One Hebrew sentence: the value or idea of the story. */
    moral: z.string().min(1).optional(),
    tags: z.array(z.string()).default([]),
    source: SourceRef,
  })
  .refine((s) => s.questions.every((q) => q.after < s.lines.length), { message: 'question after a missing line' })
  .refine((s) => s.kind === 'read' || (!!s.cast && s.lines.every((l) => !!l.speaker)), {
    message: 'dialogue stories need a cast and a speaker on every line',
  });
export type Story = z.infer<typeof Story>;

/** Words so common that stories need no glossary entry for them. */
export const STORY_STOPWORDS = new Set(
  (
    "a an the and or but so if of to in on at for from with by as is am are was were be been do does did not no yes " +
    "i you he she it we they me him her us them my your his its our their this that these those there here " +
    "what who how when where why oh ok okay mr mrs ms"
  ).split(' '),
);

/** Lowercase words of a line, without punctuation, as used for glossary keys. */
export function storyWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '').toLowerCase().replace(/[\u2018\u2019]/g, "'"))
    .filter(Boolean);
}

/** Glossary entry for a word, trying the possessive base too ("ari's" -> "ari"). */
export function glossFor(story: Pick<Story, 'glossary'>, word: string) {
  return story.glossary[word] ?? (word.endsWith("'s") ? story.glossary[word.slice(0, -2)] : undefined);
}

/**
 * Memory anchor: one fixed mental image per core rule ("the fridge schedule"
 * for present simple). The same card comes back with every related mistake
 * until the rule sticks.
 */
export const Anchor = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
  emoji: z.string().min(1),
  title: z.string().min(1),
  skills: z.array(z.string()).min(1),
  /** The picture to remember, one or two Hebrew sentences. */
  image: z.string().min(1),
  /** The rule in plain Hebrew. */
  rule: z.string().default(''),
  /** Fixed pattern shown in color, e.g. "he / she / it + verb + s". */
  pattern: z.string().optional(),
  examples: z.array(z.object({ en: z.string().min(1), he: z.string().min(1) })).default([]),
  /** Why Hebrew speakers get it wrong. */
  hebrewTrap: z.string().default(''),
  source: SourceRef,
});
export type Anchor = z.infer<typeof Anchor>;
