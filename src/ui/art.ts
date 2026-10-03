import { picIds } from '@content/kids';

/** Names of the adult 3D illustrations (public/pics/a-<name>.webp, transparent). */
export type ArtName =
  | 'vocabulary' | 'grammar' | 'listening' | 'reading' | 'writing' | 'speaking'
  | 'stories' | 'path' | 'progress' | 'words' | 'lessons' | 'games' | 'test'
  | 'streak' | 'star' | 'parent' | 'settings' | 'hero-study' | 'empty' | 'continue'
  | 'lightning' | 'riddle' | 'target' | 'translate';

const available = new Set(picIds);

/** The illustration's URL, or undefined while it does not exist yet. */
export function art(name: ArtName): string | undefined {
  const id = `a-${name}`;
  return available.has(id) ? `pics/${id}.webp` : undefined;
}
