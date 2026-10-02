import type { BagrutTrack } from '../curriculum/israel';
import type { CefrLevel } from '../skills/cefr';

/**
 * Student: the identity and settings of one child.
 * Everything the app learns about the child lives in separate per-student
 * tables (skill states, unit memories, mistake patterns, events), keyed by
 * studentId. See LearnerProfile for the assembled view.
 */
export const INTERESTS = [
  'music', 'sports', 'fashion', 'technology', 'games', 'movies',
  'school', 'travel', 'food', 'animals', 'science', 'books',
] as const;
export type Interest = (typeof INTERESTS)[number];

export const INTEREST_LABELS: Record<Interest, string> = {
  music: 'מוזיקה', sports: 'ספורט', fashion: 'אופנה', technology: 'טכנולוגיה',
  games: 'משחקים', movies: 'סרטים', school: 'בית ספר', travel: 'טיולים',
  food: 'אוכל', animals: 'בעלי חיים', science: 'מדע', books: 'ספרים',
};

export type Accent = 'en-US' | 'en-GB';
export type SpeechRate = 'slow' | 'normal' | 'fast';

export interface LearningGoal {
  /** 'general' when the child is not on a bagrut track yet. */
  track: BagrutTrack | 'general';
  /** Optional explicit target that overrides the track default. */
  targetLevel?: CefrLevel;
}

export interface StudentPreferences {
  accent: Accent;
  speechRate: SpeechRate;
  dailyGoalMinutes: number;
  /** Preferred voice per accent, chosen in the voice lab. */
  voiceIds?: Partial<Record<Accent, string>>;
}

export interface Student {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  birthYear?: number;
  schoolGrade?: number;
  goal: LearningGoal;
  interests: Interest[];
  preferences: StudentPreferences;
  /** Hue 0..359 for the avatar. Purely visual. */
  hue: number;
  /** Archived students are hidden but their history is kept. */
  archived: boolean;
}

export const DEFAULT_PREFERENCES: StudentPreferences = {
  accent: 'en-US',
  speechRate: 'normal',
  dailyGoalMinutes: 10,
};

export interface NewStudentInput {
  name: string;
  goal?: LearningGoal;
  interests?: Interest[];
  birthYear?: number;
  schoolGrade?: number;
  preferences?: Partial<StudentPreferences>;
}

export function validateStudentName(name: string): string | null {
  const n = name.trim();
  if (!n) return 'נא להזין שם';
  if (n.length > 40) return 'השם ארוך מדי';
  return null;
}

export function createStudent(input: NewStudentInput, id: string, now: number): Student {
  const err = validateStudentName(input.name);
  if (err) throw new Error(err);
  return {
    id,
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
    ...(input.birthYear ? { birthYear: input.birthYear } : {}),
    ...(input.schoolGrade ? { schoolGrade: input.schoolGrade } : {}),
    goal: input.goal ?? { track: 'general' },
    interests: input.interests ?? [],
    preferences: { ...DEFAULT_PREFERENCES, ...input.preferences },
    hue: hashHue(id),
    archived: false,
  };
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
