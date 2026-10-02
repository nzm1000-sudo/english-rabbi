import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useServices } from './services';
import { buildLearnerProfile, type LearnerProfile } from '@/domain/student/profile';
import { localDay } from '@/domain/learning/events';
import type { Student } from '@/domain/student/student';

export function useStudents(includeArchived = false): Student[] | undefined {
  const { store } = useServices();
  return useLiveQuery(() => store.listStudents(includeArchived), [store, includeArchived]);
}

/** undefined while loading, null if not found. */
export function useStudent(id: string | undefined): Student | null | undefined {
  const { store } = useServices();
  return useLiveQuery(async () => (id ? ((await store.getStudent(id)) ?? null) : null), [store, id]);
}

/** Live learner profile. Recomputes when this student's data changes. */
export function useProfile(student: Student | null | undefined): LearnerProfile | undefined {
  const { store, content } = useServices();
  const data = useLiveQuery(
    async () => (student ? { state: await store.loadLearnerState(student.id), daily: await store.dailyStats(student.id) } : undefined),
    [store, student?.id],
  );
  return useMemo(() => {
    if (!student || !data) return undefined;
    const now = Date.now();
    return buildLearnerProfile(student, data.state, data.daily, (id) => content.misconceptions.get(id), now, localDay(now));
  }, [student, data, content]);
}
