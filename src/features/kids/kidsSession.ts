import { useCallback, useEffect, useRef } from 'react';
import { useServices } from '@/app/services';

/**
 * Screen-time session for a game or a book. It is open only while the app is
 * on screen: when the phone locks or the app goes to the background (and is
 * maybe never opened again) the session ends, and a new one starts when the
 * child comes back. Otherwise a session left open would count every minute
 * until midnight toward the daily limit.
 *
 * `sessionId.current` is the open session ('' when none); `finish()` ends it
 * for good (the round is over, nothing restarts it).
 */
export function useKidsSession(studentId: string | undefined, mode: string) {
  const { store } = useServices();
  const current = useRef<Promise<string> | null>(null);
  const sessionId = useRef('');
  const finished = useRef(false);

  const stop = useCallback(
    (reason: 'finished' | 'left') => {
      const p = current.current;
      current.current = null;
      sessionId.current = '';
      void p?.then((id) => store.endSession(id, reason));
    },
    [store],
  );

  useEffect(() => {
    if (!studentId) return;
    finished.current = false;
    const begin = () => {
      if (current.current || finished.current || document.visibilityState === 'hidden') return;
      const p: Promise<string> = store.startSession(studentId, mode).then((s) => {
        if (current.current === p) sessionId.current = s.id;
        return s.id;
      });
      current.current = p;
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? stop('left') : begin());
    begin();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop('left');
    };
  }, [store, studentId, mode, stop]);

  const finish = useCallback(() => {
    finished.current = true;
    stop('finished');
  }, [stop]);

  return { sessionId, finish };
}
