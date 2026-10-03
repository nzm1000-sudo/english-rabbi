import { heCount } from './heCount';
import { RANKS, rankFor } from '@/domain/learning/progression';

/** Regression: "שוחזרו 1 תלמידים", "1 מילים לחזרה": one is said in the singular. */
it('heCount', () => {
  expect(heCount(1, 'תלמיד אחד', 'תלמידים')).toBe('תלמיד אחד');
  expect(heCount(0, 'תלמיד אחד', 'תלמידים')).toBe('0 תלמידים');
  expect(heCount(3, 'תלמיד אחד', 'תלמידים')).toBe('3 תלמידים');
});

it('rank progress says one missing word in the singular', () => {
  const next = RANKS[1]!;
  expect(rankFor(next.xp, next.words - 1, next.mastered).missing).toContain('עוד מילה אחת שנזכרת היטב');
});
