import { describe, expect, it } from 'vitest';
import { GROUPS } from './practiceCatalog';
import { lastInGroup, lastUsedByPath, nextInGroup, recommendedPath, sourceOf, triedSince, weekStart } from './practiceActivity';

const games = GROUPS.find((g) => g.id === 'games')!;

describe('practice activity', () => {
  it('knows where every catalog mode leaves its trace', () => {
    for (const g of GROUPS) for (const it of g.items) expect(sourceOf(it.path), it.path).not.toBeNull();
    expect(sourceOf('practice/quiz')).toEqual({ session: 'quiz' });
    expect(sourceOf('stories')).toEqual({ session: 'story' });
    expect(sourceOf('learn')).toEqual({ event: 'lesson.viewed' });
  });

  it('keeps the latest time per catalog path', () => {
    const used = lastUsedByPath([
      { session: 'quiz', at: 100 },
      { session: 'quiz', at: 300 },
      { session: 'story', at: 200 },
      { event: 'speaking.shadowed', at: 50 },
      { session: 'not-in-catalog', at: 999 },
    ]);
    expect(used.get('practice/quiz')).toBe(300);
    expect(used.get('stories')).toBe(200);
    expect(used.get('shadow')).toBe(50);
    expect(used.size).toBe(3);
  });

  it('starts the week on Sunday at midnight, local time', () => {
    const wed = new Date(2026, 9, 7, 15, 30).getTime(); // Wednesday 7 Oct 2026
    expect(new Date(weekStart(wed))).toEqual(new Date(2026, 9, 4, 0, 0, 0, 0));
    const sun = new Date(2026, 9, 4, 0, 5).getTime();
    expect(weekStart(sun)).toBe(new Date(2026, 9, 4).getTime());
  });

  it('finds the last used mode of a group and counts this week', () => {
    const used = new Map([
      ['practice/quiz', 500],
      ['practice/exam', 900],
      ['practice/riddles', 100],
    ]);
    expect(lastInGroup(games, used)).toBe('practice/exam');
    expect(lastInGroup(games, new Map())).toBeNull();
    expect(triedSince(games, used, 400)).toBe(2);
  });

  it('recommends the mode that trains the weakest area', () => {
    expect(recommendedPath('grammar', 0)).toBe('practice/fix');
    expect(recommendedPath('vocabulary', 4)).toBe('practice/review');
    expect(recommendedPath('vocabulary', 0)).toBe('practice/families');
    expect(recommendedPath('listening', 0)).toBe('shadow');
    expect(recommendedPath(null, 9)).toBeNull();
    // Every recommendation is a real catalog entry.
    for (const d of ['grammar', 'vocabulary', 'reading', 'writing', 'listening', 'speaking'] as const) {
      for (const due of [0, 3]) expect(GROUPS.some((g) => g.items.some((it) => it.path === recommendedPath(d, due)))).toBe(true);
    }
  });

  it('suggests the group modes not tried this week first, never the one just played', () => {
    const since = 1000;
    const used = new Map([
      ['practice/lightning', 1500], // this week
      ['practice/exam', 400], // before this week
      ['practice/riddles', 1200], // this week
    ]);
    const next = nextInGroup('practice/quiz', used, since)!;
    expect(next.group.id).toBe('games');
    // Never tried (match) and tried long ago (exam) before this week's ones; catalog order breaks ties.
    expect(next.items.map((it) => it.path)).toEqual(['match', 'practice/exam', 'practice/riddles']);
    expect(nextInGroup('practice/daily', used, since)).toBeNull();
  });
});
