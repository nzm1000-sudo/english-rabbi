import type { Domain } from '@/domain/skills/taxonomy';
import { GROUPS, type PracticeGroup } from './practiceCatalog';

/**
 * What the student did with each practice mode in the catalog: when each was
 * last used, what to recommend, and what to try next. Pure functions; the
 * hook in usePracticeActivity.ts feeds them from the database.
 */

/** Where a catalog path leaves its trace: a session mode, or an event type. */
export type ActivitySource = { session: string } | { event: 'lesson.viewed' | 'speaking.shadowed' };

export function sourceOf(path: string): ActivitySource | null {
  if (path.startsWith('practice/')) return { session: path.slice('practice/'.length) };
  if (path === 'stories') return { session: 'story' };
  if (path === 'match') return { session: 'match' };
  if (path === 'words') return { session: 'mywords' };
  if (path === 'learn') return { event: 'lesson.viewed' };
  if (path === 'shadow') return { event: 'speaking.shadowed' };
  return null;
}

/** A finished bit of practice: a session with at least one answer, or a logged event. */
export type ActivityRow = { session: string; at: number } | { event: string; at: number };

/** Catalog path -> last time it was used. */
export function lastUsedByPath(rows: readonly ActivityRow[]): Map<string, number> {
  const latest = new Map<string, number>();
  for (const r of rows) {
    const key = 'session' in r ? `s:${r.session}` : `e:${r.event}`;
    if ((latest.get(key) ?? 0) < r.at) latest.set(key, r.at);
  }
  const out = new Map<string, number>();
  for (const g of GROUPS)
    for (const it of g.items) {
      const src = sourceOf(it.path);
      const at = src && latest.get('session' in src ? `s:${src.session}` : `e:${src.event}`);
      if (at) out.set(it.path, at);
    }
  return out;
}

/** Sunday 00:00 local time of the week that holds `now` (the Israeli week). */
export function weekStart(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

/** The group's most recently used mode, if any. */
export function lastInGroup(g: PracticeGroup, used: ReadonlyMap<string, number>): string | null {
  let best: string | null = null;
  let at = 0;
  for (const it of g.items) {
    const t = used.get(it.path) ?? 0;
    if (t > at) [best, at] = [it.path, t];
  }
  return best;
}

/** How many of the group's modes were used since `since`. */
export function triedSince(g: PracticeGroup, used: ReadonlyMap<string, number>, since: number): number {
  return g.items.filter((it) => (used.get(it.path) ?? 0) >= since).length;
}

/**
 * The one mode that trains the student's weakest area best. Words due for
 * review win for vocabulary, since spaced review is what holds them.
 */
export function recommendedPath(weakDomain: Domain | null, due: number): string | null {
  switch (weakDomain) {
    case 'grammar':
      return 'practice/fix';
    case 'vocabulary':
      return due > 0 ? 'practice/review' : 'practice/families';
    case 'reading':
      return 'stories';
    case 'writing':
      return 'practice/translate';
    case 'listening':
    case 'speaking':
      return 'shadow';
    default:
      return null;
  }
}

export function groupOf(path: string): PracticeGroup | undefined {
  return GROUPS.find((g) => g.items.some((it) => it.path === path));
}

/**
 * Up to `n` other modes from the same group, for the end of a round: the ones
 * not tried this week first, then the least recently used; catalog order
 * breaks ties.
 */
export function nextInGroup(path: string, used: ReadonlyMap<string, number>, since: number, n = 3) {
  const g = groupOf(path);
  if (!g) return null;
  const others = g.items
    .map((it, i) => ({ it, i, at: used.get(it.path) ?? 0 }))
    .filter((x) => x.it.path !== path)
    .sort((a, b) => Number(a.at >= since) - Number(b.at >= since) || a.at - b.at || a.i - b.i)
    .slice(0, n)
    .map((x) => x.it);
  return { group: g, items: others };
}
