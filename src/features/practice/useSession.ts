import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '@/app/services';
import { pickNext, predictSuccess, type Candidate } from '@/domain/learning/selector';
import { localDay, type ItemOutcome } from '@/domain/learning/events';
import type { Evidence } from '@/domain/learning/evidence';
import type { LearnerState } from '@/data/store';
import type { SavedWordRow } from '@/data/schema';
import { paramsKey, resume } from '@/app/resume';
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
  const [resumed, setResumed] = useState(false);

  /** Keeps the place in this session so leaving the app does not lose it. Timed rounds are not kept. */
  const persist = useCallback(() => {
    if (def.timeLimitSec || endedRef.current) return;
    const fixed = fixedRef.current;
    const generated = !!fixed?.some((i) => !content.getItem(i.id));
    resume.saveSession(student.id, {
      mode,
      paramsKey: paramsKey(params),
      title: def.title,
      recent: recentRef.current,
      results: resultsRef.current,
      total: fixed ? fixed.length || 1 : def.length,
      ...(fixed ? (generated ? { fixedItems: fixed } : { fixedIds: fixed.map((i) => i.id) }) : {}),
    });
    // params is stable for the session (see ctx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, def, mode, student.id]);
  const recentRef = useRef<string[]>([]);
  const fixedRef = useRef<ContentItem[] | null>(null);
  const resultsRef = useRef<SessionResult[]>([]);
  const startedRef = useRef(0);
  const endedRef = useRef(false);
  const busyRef = useRef(false);
  /** The presented question already answered; a stale second tap must not record it again. */
  const answeredRef = useRef<Candidate | null>(null);
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
        resume.clearSession(student.id, mode);
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
      persist();
      setCurrent(cand);
      setStatus('active');
      void store.log(student.id, 'item.presented', { itemId: cand.item.id, reasons: cand.reasons }, sid);
    },
    [content, ctx, def, finish, persist, store, student.id, student.interests],
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
        // This run was replaced (StrictMode re-run or a new student/mode).
        // Close only its own session; endedRef now belongs to the newer run.
        void store.endSession(sid, 'left');
        return;
      }
      stateRef.current = st;
      if (mode === 'mywords') wordsRef.current = await store.savedWords(student.id);
      startedRef.current = Date.now();
      const snap = def.timeLimitSec ? undefined : resume.getSession(student.id, mode);
      const same = snap && snap.mode === mode && snap.paramsKey === paramsKey(params) && snap.recent.length > 0;
      if (def.fixed) {
        const restored = same
          ? snap.fixedItems
            ? (snap.fixedItems as ContentItem[])
            : snap.fixedIds?.flatMap((id) => content.getItem(id) ?? [])
          : undefined;
        fixedRef.current = restored?.length ? restored : def.fixed(ctx());
        setTotal(fixedRef.current.length || 1);
      }
      if (def.timeLimitSec) {
        deadlineRef.current = Date.now() + def.timeLimitSec * 1000;
        setDeadline(deadlineRef.current);
      }
      setSessionId(sid);
      if (same) {
        // Continue where the learner stopped: the same items, results and progress.
        const find = (id: string) => fixedRef.current?.find((i) => i.id === id) ?? content.getItem(id);
        const results = snap.results as SessionResult[];
        const pendingId = snap.recent.length > results.length ? snap.recent[snap.recent.length - 1] : undefined;
        const pending = pendingId ? find(pendingId) : undefined;
        recentRef.current = pending ? snap.recent : snap.recent.slice(0, results.length);
        resultsRef.current = results;
        setResults(results);
        setResumed(true);
        if (pending) {
          setCurrent({ item: pending, score: 1, predicted: predictSuccess(pending, st.skills, Date.now()), reasons: [] });
          setStatus('active');
          return;
        }
      }
      next(sid);
    })();
    return () => {
      cancelled = true;
      // sid is set only once this run has started; a run still loading closes its session itself.
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
      // A fast second tap can reach this with the previous question still in
      // its closure (before the next one renders): ignore it, or the same
      // answer is saved twice and the next question is skipped.
      if (!current || busyRef.current || answeredRef.current === current) return;
      busyRef.current = true;
      answeredRef.current = current;
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
      } catch (e) {
        // Not saved: the same question may be answered again.
        answeredRef.current = null;
        throw e;
      } finally {
        busyRef.current = false;
      }
    },
    [current, next, sessionId, store, student.id],
  );

  /** Drops the saved place; the caller starts a fresh round. */
  const discardSaved = useCallback(() => resume.clearSession(student.id, mode), [student.id, mode]);

  return { status, current, results, sessionId, total, index: recentRef.current.length, deadline, complete, timeUp, def, resumed, discardSaved };
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
