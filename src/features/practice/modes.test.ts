import { buildDaily, buildExam, MODES, type PoolContext } from './modes';
import { lightningScore } from './useSession';
import { contentRegistry } from '@content/index';
import { createStudent } from '@/domain/student/student';
import { recordMistake } from '@/domain/learning/memory';
import { domainOf } from '@/domain/skills/taxonomy';

const NOW = new Date('2026-10-02T10:00:00').getTime();
const student = createStudent({ name: 'דנה', goal: { track: 'units-4' } }, 's1', NOW);
const empty = () => ({ skills: new Map(), units: new Map(), patterns: new Map() });
const ctx = (over: Partial<PoolContext> = {}): PoolContext => ({
  registry: contentRegistry,
  state: empty(),
  student,
  now: NOW,
  day: '2026-10-02',
  params: {},
  ...over,
});

describe('game modes', () => {
  it('exam: a full passage first, then vocabulary and grammar, no repeats', () => {
    const exam = buildExam(ctx());
    expect(exam.length).toBeGreaterThan(5);
    const first = exam[0]!;
    expect(first.passageId).toBeDefined();
    const passageQs = contentRegistry.items.filter((i) => i.passageId === first.passageId);
    expect(exam.slice(0, passageQs.length).every((i) => i.passageId === first.passageId)).toBe(true);
    expect(new Set(exam.map((i) => i.id)).size).toBe(exam.length);
    expect(exam.some((i) => domainOf(i.skill) === 'grammar')).toBe(true);
  });

  it('daily challenge is the same all day and different the next day', () => {
    const a = buildDaily(ctx()).map((i) => i.id);
    const b = buildDaily(ctx()).map((i) => i.id);
    const c = buildDaily(ctx({ day: '2026-10-03' })).map((i) => i.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBeGreaterThanOrEqual(5);
    expect(a.some((id) => contentRegistry.getItem(id)!.tags.includes('riddle'))).toBe(true);
  });

  it('mistake gym targets items for the learner\'s repeated mistakes', () => {
    let p = recordMistake(undefined, 'quantifiers.much-many', { itemId: 'x', answer: 'b', at: NOW - 1000 });
    p = recordMistake(p, 'quantifiers.much-many', { itemId: 'x', answer: 'b', at: NOW - 500 });
    const pool = MODES.mistakes.pool(ctx({ state: { ...empty(), patterns: new Map([[p.misconceptionId, p]]) } }));
    expect(pool.length).toBeGreaterThan(0);
    expect(MODES.mistakes.pool(ctx())).toEqual([]);
  });

  it('lightning uses only quick vocabulary choice items', () => {
    const pool = MODES.lightning.pool(ctx());
    expect(pool.length).toBeGreaterThan(10);
    expect(pool.every((i) => i.type === 'choice' && domainOf(i.skill) === 'vocabulary' && !i.passageId)).toBe(true);
  });

  it('quiz and exam use the test policy; practice uses the hint ladder', () => {
    expect(MODES.quiz.policy).toBe('test');
    expect(MODES.exam.policy).toBe('test');
    expect(MODES.vocabulary.policy).toBe('teach');
  });

  it('lightning score rewards streaks', () => {
    expect(lightningScore([{ correct: true }, { correct: true }, { correct: true }])).toBe(10 + 12 + 14);
    expect(lightningScore([{ correct: true }, { correct: false }, { correct: true }])).toBe(20);
  });
});
