import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
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
