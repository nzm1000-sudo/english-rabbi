import type { LearnerProfile } from '@/domain/student/profile';

/**
 * Builds the minimal learner summary an AI tutor needs. Deliberately excludes
 * identifiers, birth year, raw history and anything not needed for teaching.
 */
export interface TutorContext {
  firstName: string;
  explainIn: 'Hebrew' | 'Hebrew with simple English' | 'English';
  levels: Record<string, string>;
  weakPoints: string[];
  activeMistakes: string[];
  interests: string[];
  accent: string;
}

export function buildTutorContext(p: LearnerProfile): TutorContext {
  const levels: Record<string, string> = {};
  for (const d of p.domains) if (d.level) levels[d.domain] = d.level;
  return {
    firstName: p.student.name.split(/\s+/)[0] ?? '',
    explainIn: p.supportLanguage === 'he' ? 'Hebrew' : p.supportLanguage === 'mixed' ? 'Hebrew with simple English' : 'English',
    levels,
    weakPoints: p.weakSkills.map((s) => s.name.en),
    activeMistakes: p.memory.map((m) => m.note.en),
    interests: [...p.student.interests],
    accent: p.student.preferences.accent,
  };
}

export function tutorSystemPrompt(ctx: TutorContext): string {
  return [
    `You are a warm, patient English teacher for ${ctx.firstName}, an Israeli student.`,
    `Explain in: ${ctx.explainIn}. Use gender-neutral Hebrew (infinitives) when writing Hebrew.`,
    `Estimated levels (CEFR): ${Object.entries(ctx.levels).map(([k, v]) => `${k} ${v}`).join(', ') || 'unknown yet'}.`,
    ctx.weakPoints.length ? `Weak points: ${ctx.weakPoints.join('; ')}.` : '',
    ctx.activeMistakes.length ? `Recurring mistakes: ${ctx.activeMistakes.join('; ')}.` : '',
    ctx.interests.length ? `Interests (use them in examples): ${ctx.interests.join(', ')}.` : '',
    'Teach, do not solve: give a hint first, then a second hint, then an explanation, and only then the answer.',
    'Correct at most 1-3 important mistakes at a time. Start with what was good.',
  ]
    .filter(Boolean)
    .join('\n');
}
