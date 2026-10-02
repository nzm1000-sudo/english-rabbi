import type { ChoiceItem } from '@/domain/content/schema';
import type { SavedWordRow } from '@/data/schema';
import type { UnitMemory } from '@/domain/learning/projection';
import { isDue } from '@/domain/learning/srs';
import { seededShuffle } from '@/features/practice/shuffle';

/** Hebrew meanings used as wrong options when the learner has few saved words. */
const FILLER_HE = ['שולחן', 'לרוץ', 'שמח', 'חלון', 'מהר', 'לשיר', 'ירוק', 'מכתב', 'עייף', 'לפתוח', 'גשם', 'חבר'];

/**
 * One "what does it mean" card per saved word. The unit is "word:<lemma>",
 * the same unit the vocabulary packs use, so spaced repetition is shared.
 */
export function wordItem(w: SavedWordRow, others: SavedWordRow[]): ChoiceItem {
  const wrong = seededShuffle(
    [...new Set([...others.map((o) => o.he), ...FILLER_HE])].filter((he) => he !== w.he),
    w.lemma,
  ).slice(0, 3);
  const slug = w.lemma.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'word';
  return {
    id: `mywords.${slug}`,
    version: 1,
    type: 'choice',
    skill: 'vocabulary.meaning',
    alsoSkills: [],
    level: 'A2',
    difficulty: 0.4,
    unit: `word:${w.lemma.toLowerCase()}`,
    instruction: { he: 'מה פירוש המילה?', en: 'What does this word mean?' },
    explanation: { he: `${w.lemma} פירושה ${w.he}.`, en: `${w.lemma} means ${w.he}.` },
    hints: w.example ? [{ he: `המילה במשפט: ${w.example}`, en: `In a sentence: ${w.example}` }] : [],
    targetsMisconceptions: [],
    tags: ['mywords'],
    interests: [],
    modality: 'read',
    estimatedTimeSec: 10,
    source: 'original',
    language: 'en',
    word: { lemma: w.lemma, he: w.he, ...(w.example ? { example: w.example } : {}) },
    prompt: w.lemma,
    promptLanguage: 'en',
    options: [{ id: 'a', text: w.he }, ...wrong.map((text, i) => ({ id: 'bcd'[i]!, text }))],
    correctOptionId: 'a',
  };
}

/** Due words first, then never-practised words, then the rest by age. */
export function myWordsSession(words: SavedWordRow[], units: ReadonlyMap<string, UnitMemory>, now: number, length = 10): ChoiceItem[] {
  const rank = (w: SavedWordRow) => {
    const u = units.get(`word:${w.lemma.toLowerCase()}`);
    if (!u) return 1;
    return isDue(u.card, now) ? 0 : 2;
  };
  const sorted = [...words].sort((a, b) => rank(a) - rank(b) || a.addedAt - b.addedAt);
  return sorted.slice(0, length).map((w) => wordItem(w, words));
}
