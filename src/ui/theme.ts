import type { Domain } from '@/domain/skills/taxonomy';

/** One color per skill area. Used for tiles, icons and progress. */
export type Tone = Domain | 'games' | 'primary';

export const DOMAIN_TONE: Record<Domain, Tone> = {
  vocabulary: 'vocabulary',
  grammar: 'grammar',
  reading: 'reading',
  listening: 'listening',
  writing: 'writing',
  speaking: 'speaking',
};
