import type { Bilingual } from '../content/schema';

/**
 * How much Hebrew the teacher uses. Driven by the learner's estimated level,
 * so explanations shift gradually from Hebrew to English as the child grows.
 */
export type SupportLanguage = 'he' | 'mixed' | 'en';

export function supportLanguage(theta: number): SupportLanguage {
  if (theta < -0.5) return 'he';
  if (theta < 0.6) return 'mixed';
  return 'en';
}

export interface DisplayText {
  primary: string;
  primaryLang: 'he' | 'en';
  secondary?: string;
  secondaryLang?: 'he' | 'en';
}

export function chooseText(t: Bilingual, mode: SupportLanguage): DisplayText {
  switch (mode) {
    case 'he':
      return { primary: t.he, primaryLang: 'he' };
    case 'mixed':
      return { primary: t.en, primaryLang: 'en', secondary: t.he, secondaryLang: 'he' };
    case 'en':
      return { primary: t.en, primaryLang: 'en' };
  }
}
