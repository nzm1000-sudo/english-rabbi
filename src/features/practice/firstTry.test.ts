import { describe, expect, it } from 'vitest';
import type { Evidence } from '@/domain/learning/evidence';
import { firstTry, type SessionResult } from './useSession';

const res = (correct: boolean, flags: Evidence['flags']): SessionResult => ({
  itemId: 'x',
  correct,
  evidence: { score: 1, weight: 1, grade: 'good', flags, xp: 5 },
  misconceptions: [],
});

describe('firstTry', () => {
  it('counts only answers right on the first attempt without help', () => {
    expect(firstTry(res(true, ['clean']))).toBe(true);
    expect(firstTry(res(true, ['slow']))).toBe(true);
    expect(firstTry(res(true, ['after-retry']))).toBe(false);
    expect(firstTry(res(true, ['after-hint']))).toBe(false);
    expect(firstTry(res(true, ['after-explanation']))).toBe(false);
    expect(firstTry(res(false, ['revealed']))).toBe(false);
  });
});
