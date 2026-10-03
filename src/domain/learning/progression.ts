import type { LearnerProfile } from '../student/profile';
import type { GameResult } from './events';
import { heCount } from '@/domain/text/heCount';

/**
 * Ranks and achievements.
 *
 * A rank needs three things at once: points (effort), words that are
 * actually remembered (retrievability >= 0.7), and mastered skills. Points
 * alone never raise a rank, so grinding easy items does not work.
 */
export interface Rank {
  level: number;
  name: string;
  he: string;
  xp: number;
  words: number;
  mastered: number;
}

export const RANKS: readonly Rank[] = [
  { level: 1, name: 'Starter', he: 'צעד ראשון', xp: 0, words: 0, mastered: 0 },
  { level: 2, name: 'Explorer', he: 'מגלים מילים', xp: 200, words: 10, mastered: 0 },
  { level: 3, name: 'Builder', he: 'בונים יסודות', xp: 600, words: 30, mastered: 3 },
  { level: 4, name: 'Navigator', he: 'מתמצאים בשפה', xp: 1500, words: 80, mastered: 8 },
  { level: 5, name: 'Achiever', he: 'משיגים יעדים', xp: 3000, words: 150, mastered: 15 },
  { level: 6, name: 'Expert', he: 'שליטה בטוחה', xp: 6000, words: 250, mastered: 25 },
  { level: 7, name: 'Master', he: 'רמה גבוהה מאוד', xp: 10000, words: 400, mastered: 35 },
];

export interface RankProgress {
  current: Rank;
  next: Rank | null;
  /** 0..1, limited by the weakest requirement. */
  progress: number;
  /** What is still missing for the next rank, in Hebrew. */
  missing: string[];
}

export function rankFor(xp: number, words: number, mastered: number): RankProgress {
  let current = RANKS[0]!;
  for (const r of RANKS) if (xp >= r.xp && words >= r.words && mastered >= r.mastered) current = r;
  const next = RANKS.find((r) => r.level === current.level + 1) ?? null;
  if (!next) return { current, next: null, progress: 1, missing: [] };
  const part = (have: number, from: number, to: number) => (to <= from ? 1 : Math.min(1, Math.max(0, (have - from) / (to - from))));
  const progress = Math.min(part(xp, current.xp, next.xp), part(words, current.words, next.words), part(mastered, current.mastered, next.mastered));
  const missing: string[] = [];
  if (xp < next.xp) missing.push(`עוד ${heCount(next.xp - xp, 'נקודה אחת', 'נקודות')}`);
  if (words < next.words) missing.push(next.words - words === 1 ? 'עוד מילה אחת שנזכרת היטב' : `עוד ${next.words - words} מילים שנזכרות היטב`);
  if (mastered < next.mastered) missing.push(`עוד ${heCount(next.mastered - mastered, 'מיומנות אחת', 'מיומנויות')} בשליטה מלאה`);
  return { current, next, progress, missing };
}

export function rankOf(p: LearnerProfile): RankProgress {
  return rankFor(p.activity.xpTotal, p.words.learned.length, p.masteredCount);
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
}

export function achievements(p: LearnerProfile, games: readonly GameResult[]): Achievement[] {
  const best = (g: GameResult['game'], f: (r: GameResult) => number) => Math.max(0, ...games.filter((r) => r.game === g).map(f));
  const list: [string, string, string, boolean][] = [
    ['first-steps', 'התחלה', 'לסיים 20 תרגילים', p.activity.itemsTotal >= 20],
    ['streak-7', 'שבוע ברצף', '7 ימי לימוד ברצף', p.activity.streakDays >= 7],
    ['streak-30', 'חודש ברצף', '30 ימי לימוד ברצף', p.activity.streakDays >= 30],
    ['words-50', '50 מילים', '50 מילים שנזכרות היטב', p.words.learned.length >= 50],
    ['words-200', '200 מילים', '200 מילים שנזכרות היטב', p.words.learned.length >= 200],
    ['mastery-5', 'חמש מיומנויות', '5 מיומנויות בשליטה מלאה', p.masteredCount >= 5],
    ['repair', 'טעות שתוקנה', 'טעות שחזרה כמה פעמים ותוקנה', p.repairedPatterns >= 1],
    ['quiz-perfect', 'חידון מושלם', 'כל התשובות נכונות בחידון', games.some((g) => g.game === 'quiz' && g.correct === g.total && g.total >= 8)],
    ['lightning-15', 'סבב בזק', '15 תשובות נכונות בסבב בזק אחד', best('lightning', (g) => g.correct) >= 15],
    ['exam-85', 'מבחן מצוין', '85 ומעלה במבחן', best('exam', (g) => g.score) >= 85],
    ['daily-7', 'שבעה אתגרים', '7 אתגרים יומיים', new Set(games.filter((g) => g.game === 'daily').map((g) => g.day)).size >= 7],
    ['answers-1000', 'אלף תשובות', '1000 תרגילים', p.activity.itemsTotal >= 1000],
  ];
  return list.map(([id, title, description, earned]) => ({ id, title, description, earned }));
}
