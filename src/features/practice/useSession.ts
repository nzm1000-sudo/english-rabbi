import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '@/app/services';
import { pickNext, predictSuccess, type Candidate } from '@/domain/learning/selector';
import { localDay, type ItemOutcome } from '@/domain/learning/events';
import type { Evidence } from '@/domain/learning/evidence';
import type { LearnerState } from '@/data/store';
import type { SavedWordRow } from '@/data/schema';
import type { Student } from '@/domain/student/student';
import type { ContentItem } from '@/domain/content/schema';
import { MODES, type PoolContext, type PracticeMode } from './modes';

export interface SessionResult {
  itemId: string;
  correct: boolean;
  evidence: Evidence;
  misconceptions: string[];
}

export type SessionStatus = 'loading' | 'active' | 'done' | 'empty';

/** Max questions in a row from one reading passage in adaptive sessions. */
const PASSAGE_RUN = 4;

/**
 * Drives one session of any mode. After every answer the learner state is
 * updated and the next item is chosen from the updated state, so each answer
 * changes what comes next. Fixed modes (exam, daily) follow a prepared list.
 */
export function useSession(student: Student, mode: PracticeMode, params: Record<string, string> = {}) {
  const { store, content } = useServices();
  const def = MODES[mode];
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [current, setCurrent] = useState<Candidate | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [total, setTotal] = useState(def.length);
  const [deadline, setDeadline] = useState<number | null>(null);
  const stateRef = useRef<LearnerState | null>(null);
  const wordsRef = useRef<SavedWordRow[] | undefined>(undefined);
  const recentRef = useRef<string[]>([]);
  const fixedRef = useRef<ContentItem[] | null>(null);
  const resultsRef = useRef<SessionResult[]>([]);
  const startedRef = useRef(0);
  const endedRef = useRef(false);
  const busyRef = useRef(false);
  const deadlineRef = useRef<number | null>(null);

  const ctx = useCallback(
    (): PoolContext => {
      const now = Date.now();
      return { registry: content, state: stateRef.current!, student, now, day: localDay(now), params, ...(wordsRef.current ? { savedWords: wordsRef.current } : {}) };
    },
    // params is created by the caller per render; its content is stable per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content, student],
  );

  const finish = useCallback(
    (sid: string, reason: 'finished' | 'left') => {
      if (endedRef.current) return;
      endedRef.current = true;
      setCurrent(null);
      void store.endSession(sid, reason);
      const rs = resultsRef.current;
      if (reason === 'finished' && def.game && rs.length) {
        const correct = rs.filter((r) => r.correct).length;
        const now = Date.now();
        const score = def.game === 'lightning' ? lightningScore(rs) : Math.round((correct / rs.length) * 100);
        void store.log(
          student.id,
          'game.finished',
          {
            game: def.game,
            day: localDay(now),
            correct,
            total: rs.length,
            score,
            durationMs: now - startedRef.current,
            ...(mode === 'exam' ? { meta: { track: params.track ?? student.goal.track } } : {}),
          },
          sid,
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def.game, mode, store, student.id, student.goal.track],
  );

  const next = useCallback(
    (sid: string) => {
      const st = stateRef.current;
      if (!st || endedRef.current) return;
      const done = () => {
        setStatus(recentRef.current.length ? 'done' : 'empty');
        finish(sid, 'finished');
      };
      if (deadlineRef.current && Date.now() >= deadlineRef.current) return done();

      let cand: Candidate | null = null;
      if (fixedRef.current) {
        const item = fixedRef.current[recentRef.current.length];
        if (item) cand = { item, score: 1, predicted: predictSuccess(item, st.skills, Date.now()), reasons: [] };
      } else if (recentRef.current.length < def.length) {
        const c = ctx();
        let pool = def.pool(c);
        // Keep the learner on the same reading passage for a few questions.
        const lastId = recentRef.current[recentRef.current.length - 1];
        const last = lastId ? content.getItem(lastId) : undefined;
        if (last?.passageId) {
          const limit = def.selection === 'placement' ? 2 : PASSAGE_RUN;
          const run = recentRef.current.slice(-limit).filter((id) => content.getItem(id)?.passageId === last.passageId).length;
          const same = pool.filter((i) => i.passageId === last.passageId && !recentRef.current.includes(i.id));
          if (run < limit && same.length) pool = same;
        }
        cand = pickNext(
          {
            now: c.now,
            mode: def.selection,
            items: pool,
            skills: st.skills,
            units: st.units,
            patterns: st.patterns,
            interests: student.interests,
            recent: recentRef.current,
            ...(def.targetSuccess ? { targetSuccess: def.targetSuccess } : {}),
          },
          Math.random,
        );
      }
      if (!cand) return done();
      recentRef.current = [...recentRef.current, cand.item.id];
      setCurrent(cand);
      setStatus('active');
      void store.log(student.id, 'item.presented', { itemId: cand.item.id, reasons: cand.reasons }, sid);
    },
    [content, ctx, def, finish, store, student.id, student.interests],
  );

  useEffect(() => {
    let cancelled = false;
    let sid = '';
    endedRef.current = false;
    recentRef.current = [];
    resultsRef.current = [];
    (async () => {
      const [st, session] = await Promise.all([store.loadLearnerState(student.id), store.startSession(student.id, mode)]);
      sid = session.id;
      if (cancelled) {
        endedRef.current = true;
        void store.endSession(sid, 'left');
        return;
      }
      stateRef.current = st;
      if (mode === 'mywords') wordsRef.current = await store.savedWords(student.id);
      startedRef.current = Date.now();
      if (def.fixed) {
        fixedRef.current = def.fixed(ctx());
        setTotal(fixedRef.current.length || 1);
      }
      if (def.timeLimitSec) {
        deadlineRef.current = Date.now() + def.timeLimitSec * 1000;
        setDeadline(deadlineRef.current);
      }
      setSessionId(sid);
      next(sid);
    })();
    return () => {
      cancelled = true;
      if (sid && !endedRef.current) {
        endedRef.current = true;
        void store.endSession(sid, 'left');
      }
    };
    // Start once per student and mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, mode]);

  /** Called by the timer when time is up. */
  const timeUp = useCallback(() => {
    if (!endedRef.current) {
      setStatus('done');
      finish(sessionId, 'finished');
    }
  }, [finish, sessionId]);

  const complete = useCallback(
    async (outcome: ItemOutcome) => {
      if (!current || busyRef.current) return;
      busyRef.current = true;
      try {
        const r = await store.completeItem({ studentId: student.id, sessionId, item: current.item, outcome, predicted: current.predicted });
        const st = stateRef.current!;
        for (const s of r.skills) st.skills.set(s.skillId, s);
        st.units.set(r.unit.unit, r.unit);
        for (const p of r.patterns) st.patterns.set(p.misconceptionId, p);
        const misconceptions = outcome.attempts.flatMap((a) => (a.misconception ? [a.misconception] : []));
        const res = { itemId: current.item.id, correct: outcome.finalCorrect && !outcome.revealed, evidence: r.evidence, misconceptions };
        resultsRef.current = [...resultsRef.current, res];
        setResults(resultsRef.current);
        next(sessionId);
      } finally {
        busyRef.current = false;
      }
    },
    [current, next, sessionId, store, student.id],
  );

  return { status, current, results, sessionId, total, index: recentRef.current.length, deadline, complete, timeUp, def };
}

/** Lightning: 10 per correct answer, +2 per answer in the current streak, capped. */
export function lightningScore(rs: { correct: boolean }[]): number {
  let streak = 0;
  let score = 0;
  for (const r of rs) {
    if (r.correct) {
      score += 10 + Math.min(10, streak * 2);
      streak++;
    } else streak = 0;
  }
  return score;
}
