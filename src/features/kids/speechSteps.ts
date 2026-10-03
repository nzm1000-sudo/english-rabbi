import { useCallback, useEffect, useRef } from 'react';

/** A pause between spoken steps. */
export const pause = (ms: number) => () => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Spoken feedback in a game, one sequence at a time. Starting a new sequence
 * drops the rest of the previous one, and leaving the game drops everything,
 * so a stale "try again" never cuts into the praise for the right answer and
 * nothing is said (or done) after the child went home.
 *
 * `run` resolves to true when every step ran; `alive()` is false once the
 * game has left the screen.
 */
export function useSpeechSteps() {
  const state = useRef({ gen: 0, alive: true });
  useEffect(() => {
    const st = state.current;
    st.alive = true;
    return () => {
      st.alive = false;
      st.gen++;
    };
  }, []);
  const run = useCallback(async (...steps: (() => unknown)[]): Promise<boolean> => {
    const st = state.current;
    const mine = ++st.gen;
    for (const step of steps) {
      if (!st.alive || st.gen !== mine) return false;
      await step();
    }
    return st.alive && st.gen === mine;
  }, []);
  const alive = useCallback(() => state.current.alive, []);
  return { run, alive };
}
