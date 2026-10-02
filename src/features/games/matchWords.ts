import type { ContentItem } from '@/domain/content/schema';
import type { UnitMemory } from '@/domain/learning/projection';
import { isDue } from '@/domain/learning/srs';
import { difficultyOf } from '@/domain/learning/selector';

export interface MatchWord {
  lemma: string;
  he: string;
  /** The meaning item that receives the evidence. */
  item: ContentItem;
}

/**
 * Picks words for match-pairs: due and lapsed words first (retrieval of what
 * is fading), then seen words, then new words near the learner's level.
 * Hebrew meanings must be unique within a round so pairs are unambiguous.
 */
export function pickMatchWords(
  items: readonly ContentItem[],
  units: ReadonlyMap<string, UnitMemory>,
  theta: number,
  now: number,
  count: number,
  rand: () => number,
): MatchWord[] {
  const meaning = items.filter((i) => i.skill === 'vocabulary.meaning' && i.word && i.unit?.startsWith('word:'));
  const score = (i: ContentItem) => {
    const u = units.get(i.unit!);
    if (u && (isDue(u.card, now) || u.card.lapses > 0)) return 3 + rand();
    if (u) return 2 + rand();
    return 1 + rand() - Math.min(1, Math.abs(difficultyOf(i) - theta) / 3);
  };
  const ranked = [...meaning].sort((a, b) => score(b) - score(a));
  const out: MatchWord[] = [];
  const usedHe = new Set<string>();
  for (const i of ranked) {
    const he = i.word!.he.split(/[,(]/)[0]!.trim();
    if (usedHe.has(he)) continue;
    usedHe.add(he);
    out.push({ lemma: i.word!.lemma, he, item: i });
    if (out.length >= count) break;
  }
  return out;
}
