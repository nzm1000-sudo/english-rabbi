import { useLiveQuery } from 'dexie-react-hooks';
import { useServices } from '@/app/services';
import type { GameResult } from '@/domain/learning/events';

/** All game results of a student, oldest first. */
export function useGameHistory(studentId: string | undefined): GameResult[] | undefined {
  const { db } = useServices();
  return useLiveQuery(async () => {
    if (!studentId) return [];
    const rows = await db.events.where('[studentId+type]').equals([studentId, 'game.finished']).sortBy('id');
    return rows.map((e) => e.payload as GameResult);
  }, [db, studentId]);
}
