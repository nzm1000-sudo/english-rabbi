import { domainOf } from '@/domain/skills/taxonomy';
import { unitOf, type ContentItem } from '@/domain/content/schema';
import type { SelectionMode } from '@/domain/learning/selector';
import type { UnitMemory } from '@/domain/learning/projection';
import { isDue } from '@/domain/learning/srs';

export type PracticeMode = 'lesson' | 'placement' | 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'review';

export interface ModeDef {
  title: string;
  /** Hebrew label with the English domain name for familiarity. */
  english?: string;
  length: number;
  selection: SelectionMode;
  pool(items: readonly ContentItem[], units: ReadonlyMap<string, UnitMemory>, now: number): ContentItem[];
}

const byDomain = (...d: string[]) => (items: readonly ContentItem[]) => items.filter((i) => d.includes(domainOf(i.skill)) || (d.includes('listening') && i.modality === 'listen'));

export const MODES: Record<PracticeMode, ModeDef> = {
  lesson: { title: 'השיעור של היום', length: 12, selection: 'practice', pool: (i) => [...i] },
  placement: { title: 'אבחון קצר', length: 14, selection: 'placement', pool: (i) => [...i] },
  vocabulary: { title: 'אוצר מילים', english: 'Vocabulary', length: 8, selection: 'practice', pool: byDomain('vocabulary') },
  grammar: { title: 'דקדוק', english: 'Grammar', length: 8, selection: 'practice', pool: byDomain('grammar') },
  reading: { title: 'הבנת הנקרא', english: 'Reading', length: 5, selection: 'practice', pool: byDomain('reading') },
  listening: { title: 'הבנת הנשמע', english: 'Listening', length: 6, selection: 'practice', pool: byDomain('listening') },
  review: {
    title: 'חזרה',
    english: 'Review',
    length: 10,
    selection: 'practice',
    pool: (items, units, now) =>
      items.filter((i) => {
        const u = units.get(unitOf(i));
        return !!u && isDue(u.card, now);
      }),
  },
};

export function isPracticeMode(m: string | undefined): m is PracticeMode {
  return !!m && m in MODES;
}
