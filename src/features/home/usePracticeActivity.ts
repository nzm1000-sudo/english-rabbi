import { useLiveQuery } from 'dexie-react-hooks';
import { useServices } from '@/app/services';
import type { EventType, GameResult } from '@/domain/learning/events';
import { lastUsedByPath, type ActivityRow } from './practiceActivity';

const TRACKED: EventType[] = ['lesson.viewed', 'speaking.shadowed', 'game.finished', 'story.completed'];

/** How far back "last used" looks: enough for the week bar and the "last" mark. */
const WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Catalog path -> last time the student used it (sessions with at least one
 * answer, finished games and stories, lessons viewed, sentences shadowed).
 * Undefined while loading.
 */
export function usePracticeActivity(studentId: string | undefined): Map<string, number> | undefined {
  const { db } = useServices();
  return useLiveQuery(async () => {
    if (!studentId) return new Map<string, number>();
    const from = Date.now() - WINDOW_MS;
    // One indexed lookup per event type: these are few, unlike the answer events.
    const [sessions, ...byType] = await Promise.all([
      db.sessions.where('[studentId+startedAt]').between([studentId, from], [studentId, Infinity]).toArray(),
      ...TRACKED.map((t) => db.events.where('[studentId+type]').equals([studentId, t]).filter((e) => e.at >= from).toArray()),
    ]);
    const events = byType.flat();
    const rows: ActivityRow[] = sessions.filter((s) => s.completed > 0).map((s) => ({ session: s.mode, at: s.endedAt ?? s.startedAt }));
    for (const e of events) {
      // Finished games and stories count even when they log no answers (the matching game).
      if (e.type === 'game.finished') rows.push({ session: (e.payload as GameResult).game, at: e.at });
      else if (e.type === 'story.completed') rows.push({ session: 'story', at: e.at });
      else rows.push({ event: e.type, at: e.at });
    }
    return lastUsedByPath(rows);
  }, [db, studentId]);
}
