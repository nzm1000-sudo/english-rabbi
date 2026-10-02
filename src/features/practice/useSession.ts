import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '@/app/services';
import { pickNext, type Candidate } from '@/domain/learning/selector';
import type { ItemOutcome } from '@/domain/learning/events';
import type { Evidence } from '@/domain/learning/evidence';
import type { LearnerState } from '@/data/store';
import type { Student } from '@/domain/student/student';
import { MODES, type PracticeMode } from './modes';

export interface SessionResult {
  itemId: string;
  evidence: Evidence;
  misconceptions: string[];
}

export type SessionStatus = 'loading' | 'active' | 'done' | 'empty';

/**
 * Drives one practice session. After every answer the learner state is
 * updated, and the next item is chosen from the updated state, so each
 * answer changes what comes next.
 */
export function useSession(student: Student, mode: PracticeMode) {
  const { store, content } = useServices();
  const def = MODES[mode];
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [current, setCurrent] = useState<Candidate | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const stateRef = useRef<LearnerState | null>(null);
  const recentRef = useRef<string[]>([]);
  const endedRef = useRef(false);
  const busyRef = useRef(false);

  const next = useCallback(
    (sid: string) => {
      const st = stateRef.current;
      if (!st) return;
      if (recentRef.current.length >= def.length) {
        setCurrent(null);
        setStatus('done');
        endedRef.current = true;
        void store.endSession(sid, 'finished');
        return;
      }
      const now = Date.now();
      const cand = pickNext(
        {
          now,
          mode: def.selection,
          items: def.pool(content.items, st.units, now),
          skills: st.skills,
          units: st.units,
          patterns: st.patterns,
          interests: student.interests,
          recent: recentRef.current,
        },
        Math.random,
      );
      if (!cand) {
        setCurrent(null);
        setStatus(recentRef.current.length ? 'done' : 'empty');
        endedRef.current = true;
        void store.endSession(sid, 'finished');
        return;
      }
      recentRef.current = [...recentRef.current, cand.item.id];
      setCurrent(cand);
      setStatus('active');
      void store.log(student.id, 'item.presented', { itemId: cand.item.id, reasons: cand.reasons }, sid);
    },
    [content.items, def, store, student.id, student.interests],
  );

  useEffect(() => {
    let cancelled = false;
    let sid = '';
    endedRef.current = false;
    recentRef.current = [];
    (async () => {
      const [st, session] = await Promise.all([store.loadLearnerState(student.id), store.startSession(student.id, mode)]);
      sid = session.id;
      if (cancelled) {
        void store.endSession(sid, 'left');
        return;
      }
      stateRef.current = st;
      setSessionId(sid);
      next(sid);
    })();
    return () => {
      cancelled = true;
      if (sid && !endedRef.current) void store.endSession(sid, 'left');
    };
    // Start once per student and mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, mode]);

  const complete = useCallback(
    async (outcome: ItemOutcome) => {
      if (!current || busyRef.current) return;
      busyRef.current = true;
      try {
        const r = await store.completeItem({
          studentId: student.id,
          sessionId,
          item: current.item,
          outcome,
          predicted: current.predicted,
        });
        const st = stateRef.current!;
        for (const s of r.skills) st.skills.set(s.skillId, s);
        st.units.set(r.unit.unit, r.unit);
        for (const p of r.patterns) st.patterns.set(p.misconceptionId, p);
        const misconceptions = outcome.attempts.flatMap((a) => (a.misconception ? [a.misconception] : []));
        setResults((xs) => [...xs, { itemId: current.item.id, evidence: r.evidence, misconceptions }]);
        next(sessionId);
      } finally {
        busyRef.current = false;
      }
    },
    [current, next, sessionId, store, student.id],
  );

  return { status, current, results, sessionId, total: def.length, index: recentRef.current.length, complete };
}
