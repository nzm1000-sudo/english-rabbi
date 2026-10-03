import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { ServicesProvider, type AppServices } from '@/app/services';
import { TutorDB } from '@/data/schema';
import { LearningStore } from '@/data/store';
import { contentRegistry } from '@content/index';
import { createStudent } from '@/domain/student/student';
import { useSession } from './useSession';

/**
 * Regression: under React StrictMode the effect runs twice. The first
 * (cancelled) run used to mark the shared "ended" flag when its slow start
 * resolved, so the second run never showed a question ("טוען…" forever).
 */
it('starts a session under StrictMode', async () => {
  const db = new TutorDB(`session-${Math.random()}`);
  const services = { db, store: new LearningStore(db), content: contentRegistry } as unknown as AppServices;
  const student = createStudent({ name: 'Test' }, 'student-1', Date.now());
  function Probe() {
    const s = useSession(student, 'vocabulary');
    return <p>{s.status === 'active' && s.current ? 'question' : s.status}</p>;
  }
  render(
    <StrictMode>
      <ServicesProvider services={services}>
        <Probe />
      </ServicesProvider>
    </StrictMode>,
  );
  expect(await screen.findByText('question', {}, { timeout: 4000 })).toBeInTheDocument();
});

/**
 * Regression: a fast double tap on "המשך" called complete() a second time
 * from the previous render, before the next question was shown. The same
 * answer was saved twice and the next question was skipped.
 */
it('ignores a second complete() for a question already answered', async () => {
  const db = new TutorDB(`session-${Math.random()}`);
  const services = { db, store: new LearningStore(db), content: contentRegistry } as unknown as AppServices;
  const student = createStudent({ name: 'Test' }, 'student-2', Date.now());
  let latest: ReturnType<typeof useSession> | undefined;
  function Probe() {
    latest = useSession(student, 'vocabulary');
    return <p>{latest.status === 'active' && latest.current ? `q:${latest.current.item.id}` : latest.status}</p>;
  }
  render(
    <ServicesProvider services={services}>
      <Probe />
    </ServicesProvider>,
  );
  await screen.findByText(/^q:/, {}, { timeout: 4000 });
  const stale = latest!;
  const first = stale.current!.item.id;
  const outcome = { finalCorrect: true, attempts: [], hintsUsed: 0, explanationShown: false, revealed: false, skipped: true, responseMs: 1000, answerChanges: 0, replays: 0 };
  await act(() => stale.complete(outcome));
  await act(() => stale.complete(outcome));
  expect(latest!.results.map((r) => r.itemId)).toEqual([first]);
  expect(latest!.index).toBe(2);
  const saved = (await db.events.toArray()).filter((e) => e.type === 'item.completed').length;
  expect(saved).toBe(1);
});

/**
 * Regression: the answer used to be saved only on "המשך". Leaving or
 * reloading on the feedback strip re-asked the same question, so a quiz or
 * exam answer could be tried again and the score inflated.
 */
it('saves the answer when given, and a reload goes on to the next question', async () => {
  localStorage.clear();
  const db = new TutorDB(`session-${Math.random()}`);
  const services = { db, store: new LearningStore(db), content: contentRegistry } as unknown as AppServices;
  const student = createStudent({ name: 'Test' }, 'student-3', Date.now());
  let latest: ReturnType<typeof useSession> | undefined;
  function Probe() {
    latest = useSession(student, 'quiz');
    return <p>{latest.status === 'active' && latest.current ? `q:${latest.current.item.id}` : latest.status}</p>;
  }
  const tree = (
    <ServicesProvider services={services}>
      <Probe />
    </ServicesProvider>
  );
  const first = render(tree);
  await screen.findByText(/^q:/, {}, { timeout: 4000 });
  const asked = latest!.current!.item.id;
  const wrong = { finalCorrect: false, attempts: [{ answer: 'x', correct: false, atMs: 1 }], hintsUsed: 0, explanationShown: false, revealed: true, skipped: false, responseMs: 1000, answerChanges: 0, replays: 0 };
  // The learner answers ("בדיקה") and leaves on the feedback, without "המשך".
  const stale = latest!;
  await act(() => stale.record(wrong));
  await act(() => stale.record(wrong));
  expect(latest!.results.map((r) => r.itemId)).toEqual([asked]);
  expect((await db.events.toArray()).filter((e) => e.type === 'item.completed')).toHaveLength(1);
  first.unmount();

  render(tree);
  await screen.findByText(/^q:/, {}, { timeout: 4000 });
  expect(latest!.current!.item.id).not.toBe(asked);
  expect(latest!.results.map((r) => [r.itemId, r.correct])).toEqual([[asked, false]]);
  expect(latest!.index).toBe(2);
  // "המשך" after an early save does not save the answer again.
  const again = latest!;
  await act(() => again.record(wrong));
  await act(() => again.complete(wrong));
  expect((await db.events.toArray()).filter((e) => e.type === 'item.completed')).toHaveLength(2);
});
