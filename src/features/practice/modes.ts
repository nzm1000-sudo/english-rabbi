import { domainOf, lineage } from '@/domain/skills/taxonomy';
import { unitOf, type ContentItem } from '@/domain/content/schema';
import type { ContentRegistry } from '@/domain/content/registry';
import type { SelectionMode } from '@/domain/learning/selector';
import { itemMisconceptions, difficultyOf } from '@/domain/learning/selector';
import type { FlowPolicy } from '@/domain/learning/exerciseFlow';
import type { GameResult } from '@/domain/learning/events';
import type { LearnerState } from '@/data/store';
import { isActive } from '@/domain/learning/memory';
import { isDue } from '@/domain/learning/srs';
import { levelCenter, type CefrLevel } from '@/domain/skills/cefr';
import type { Student } from '@/domain/student/student';
import { seededShuffle } from './shuffle';
import type { SavedWordRow } from '@/data/schema';
import { myWordsSession } from '@/features/words/wordItems';

export type PracticeMode =
  | 'lesson' | 'placement' | 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'review'
  | 'skill' | 'mistakes' | 'riddles' | 'quiz' | 'lightning' | 'exam' | 'daily' | 'retry' | 'pretest' | 'sentences'
  | 'translate' | 'fix' | 'chunks' | 'families' | 'mywords';

export interface PoolContext {
  registry: ContentRegistry;
  state: LearnerState;
  student: Student;
  now: number;
  day: string;
  params: Record<string, string>;
  /** "My words", loaded only for the mywords mode. */
  savedWords?: SavedWordRow[];
}

/**
 * A session configuration. Every practice mode and game is one of these;
 * they all share the same engine, events and learner model.
 */
export interface ModeDef {
  title: string;
  english?: string;
  length: number;
  selection: SelectionMode;
  policy: FlowPolicy;
  /** full: explanation + Continue. brief: short flash, auto-advance. none: no feedback until the end. */
  feedback: 'full' | 'brief' | 'none';
  targetSuccess?: number;
  timeLimitSec?: number;
  game?: GameResult['game'];
  /** Adaptive pool; the selector picks from it after every answer. */
  pool(ctx: PoolContext): ContentItem[];
  /** Fixed ordered list instead of adaptive picking (exam, daily challenge). */
  fixed?(ctx: PoolContext): ContentItem[];
}

const auto = (i: ContentItem) => i.type !== 'open-writing';
const inDomain = (...d: string[]) => (ctx: PoolContext) =>
  ctx.registry.items.filter((i) => auto(i) && (d.includes(domainOf(i.skill)) || (d.includes('listening') && i.modality === 'listen')));

/** Items a lesson's pretest can ask: of the skill, standalone (no reading passage). */
export const pretestItems = (registry: ContentRegistry, skill: string) =>
  registry.items.filter((i) => auto(i) && !i.passageId && lineage(i.skill).includes(skill));

const teach = { selection: 'practice' as const, policy: 'teach' as const, feedback: 'full' as const };

export const MODES: Record<PracticeMode, ModeDef> = {
  lesson: { title: 'השיעור של היום', length: 12, ...teach, pool: (c) => c.registry.items.filter(auto) },
  placement: { title: 'אבחון קצר', length: 14, selection: 'placement', policy: 'teach', feedback: 'full', pool: (c) => c.registry.items.filter(auto) },
  vocabulary: { title: 'אוצר מילים', english: 'Vocabulary', length: 8, ...teach, pool: inDomain('vocabulary') },
  grammar: { title: 'דקדוק', english: 'Grammar', length: 8, ...teach, pool: inDomain('grammar') },
  reading: { title: 'הבנת הנקרא', english: 'Reading', length: 6, ...teach, pool: inDomain('reading') },
  listening: { title: 'הבנת הנשמע', english: 'Listening', length: 8, ...teach, pool: inDomain('listening') },
  review: {
    title: 'חזרה',
    english: 'Review',
    length: 10,
    ...teach,
    pool: (c) =>
      c.registry.items.filter((i) => {
        const u = c.state.units.get(unitOf(i));
        return auto(i) && !!u && isDue(u.card, c.now);
      }),
  },
  skill: {
    title: 'תרגול ממוקד',
    length: 8,
    ...teach,
    pool: (c) => c.registry.items.filter((i) => auto(i) && !!c.params.skill && lineage(i.skill).includes(c.params.skill)),
  },
  mistakes: {
    title: 'חדר כושר לטעויות',
    length: 8,
    ...teach,
    game: 'mistakes',
    pool: (c) => {
      const active = new Set([...c.state.patterns.values()].filter((p) => isActive(p, c.now) || p.count >= 2).map((p) => p.misconceptionId));
      return c.registry.items.filter((i) => {
        if (!auto(i)) return false;
        if (itemMisconceptions(i).some((m) => active.has(m))) return true;
        const u = c.state.units.get(unitOf(i));
        return !!u && (u.card.lapses > 0 || u.lastScore < 0.5);
      });
    },
  },
  riddles: { title: 'חידות', english: 'Riddles', length: 6, ...teach, game: 'riddles', pool: (c) => c.registry.items.filter((i) => auto(i) && i.tags.includes('riddle')) },
  quiz: {
    title: 'חידון',
    english: 'Quiz',
    length: 10,
    selection: 'practice',
    policy: 'test',
    feedback: 'full',
    targetSuccess: 0.7,
    game: 'quiz',
    pool: (c) => c.registry.items.filter((i) => auto(i) && !i.passageId && (!c.params.domain || domainOf(i.skill) === c.params.domain)),
  },
  lightning: {
    title: 'סבב בזק',
    english: 'Lightning',
    length: 60,
    selection: 'practice',
    policy: 'test',
    feedback: 'brief',
    targetSuccess: 0.85,
    timeLimitSec: 60,
    game: 'lightning',
    pool: (c) =>
      c.registry.items.filter(
        (i) => i.type === 'choice' && i.modality === 'read' && !i.passageId && domainOf(i.skill) === 'vocabulary' && i.estimatedTimeSec <= 20,
      ),
  },
  exam: {
    title: 'מבחן',
    english: 'Exam',
    length: 18,
    selection: 'practice',
    policy: 'test',
    feedback: 'none',
    game: 'exam',
    pool: () => [],
    fixed: (c) => buildExam(c),
  },
  retry: {
    title: 'תרגול חוזר',
    length: 10,
    ...teach,
    pool: () => [],
    // Retrieval again, right after the feedback: the items missed in the last round.
    fixed: (c) => (c.params.ids ?? '').split(',').flatMap((id) => c.registry.getItem(id) ?? []).filter(auto),
  },
  pretest: {
    title: 'לנחש לפני ההסבר',
    length: 3,
    selection: 'practice',
    policy: 'test',
    feedback: 'full',
    // Pretesting: guessing before the lesson improves learning when feedback follows.
    targetSuccess: 0.5,
    pool: (c) => (c.params.skill ? pretestItems(c.registry, c.params.skill) : []),
  },
  sentences: {
    title: 'בונים משפטים',
    english: 'Sentence builder',
    length: 8,
    ...teach,
    pool: (c) => c.registry.items.filter((i) => i.type === 'order'),
  },
  translate: {
    title: 'תרגום לאנגלית',
    english: 'Translation',
    length: 8,
    ...teach,
    game: 'translate',
    pool: (c) => c.registry.items.filter((i) => i.tags.includes('translate')),
  },
  fix: {
    title: 'מצא את הטעות',
    english: 'Spot the mistake',
    length: 8,
    ...teach,
    game: 'fix',
    // The selector prefers items that target the learner's own repeated mistakes.
    pool: (c) => c.registry.items.filter((i) => i.type === 'fix'),
  },
  chunks: {
    title: 'צירופים קבועים',
    english: 'Word partners',
    length: 8,
    ...teach,
    pool: (c) => c.registry.items.filter((i) => i.tags.includes('chunk')),
  },
  families: {
    title: 'משפחות מילים',
    english: 'Word families',
    length: 8,
    ...teach,
    pool: (c) => c.registry.items.filter((i) => i.tags.includes('family')),
  },
  mywords: {
    title: 'המילים שלי',
    english: 'My words',
    length: 10,
    ...teach,
    pool: () => [],
    fixed: (c) => myWordsSession(c.savedWords ?? [], c.state.units, c.now),
  },
  daily: {
    title: 'האתגר היומי',
    length: 6,
    ...teach,
    game: 'daily',
    pool: () => [],
    fixed: (c) => buildDaily(c),
  },
};

export function isPracticeMode(m: string | undefined): m is PracticeMode {
  return !!m && m in MODES;
}

export const TRACK_LEVEL: Record<string, CefrLevel> = { 'units-3': 'A2', 'units-4': 'B1', 'units-5': 'B2', general: 'B1' };

/** Items whose difficulty is within a band around a CEFR level. */
function near(items: ContentItem[], level: CefrLevel, width = 0.8): ContentItem[] {
  const c = levelCenter(level);
  return items.filter((i) => Math.abs(difficultyOf(i) - c) <= width);
}

/**
 * Mock exam in the spirit of the bagrut: one unseen passage with all its
 * questions, then vocabulary and grammar, at the student's track level.
 */
export function buildExam(c: PoolContext): ContentItem[] {
  const track = c.params.track ?? c.student.goal.track;
  const level = TRACK_LEVEL[track] ?? 'B1';
  const seed = `${c.student.id}:${c.now}`;
  const items = c.registry.items.filter(auto);
  const passages = [...c.registry.passages.values()].filter((p) => p.level === level);
  const fallback = [...c.registry.passages.values()];
  const passage = seededShuffle(passages.length ? passages : fallback, seed)[0];
  const reading = passage ? items.filter((i) => i.passageId === passage.id) : [];
  const pick = (domain: string, n: number) => {
    // Bagrut-style: choice and typed items only (no sentence building).
    const all = items.filter((i) => domainOf(i.skill) === domain && !i.passageId && i.modality === 'read' && i.type !== 'order' && i.type !== 'fix');
    // Prefer items at the track level; widen the band if there are too few.
    for (const width of [0.8, 1.3, 2, 9]) {
      const xs = near(all, level, width);
      if (xs.length >= n || width === 9) return seededShuffle(xs, seed).slice(0, n);
    }
    return [];
  };
  return [...reading, ...pick('vocabulary', 6), ...pick('grammar', 6)];
}

/** Same six items all day for a student: review, riddle, words, grammar, listening. */
export function buildDaily(c: PoolContext): ContentItem[] {
  const seed = `${c.student.id}:${c.day}`;
  const items = c.registry.items.filter((i) => auto(i) && !i.passageId);
  const used = new Set<string>();
  const take = (xs: ContentItem[], n: number) => {
    const out = seededShuffle(xs, seed + n).filter((i) => !used.has(unitOf(i))).slice(0, n);
    out.forEach((i) => used.add(unitOf(i)));
    return out;
  };
  const due = items.filter((i) => {
    const u = c.state.units.get(unitOf(i));
    return !!u && isDue(u.card, c.now);
  });
  return [
    ...take(due, 1),
    ...take(items.filter((i) => i.tags.includes('riddle')), 1),
    ...take(items.filter((i) => domainOf(i.skill) === 'vocabulary'), due.length ? 2 : 3),
    ...take(items.filter((i) => domainOf(i.skill) === 'grammar'), 1),
    ...take(items.filter((i) => i.modality === 'listen'), 1),
  ];
}
