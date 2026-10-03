import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ServicesProvider, type AppServices } from '@/app/services';
import { TutorDB } from '@/data/schema';
import { LearningStore } from '@/data/store';
import { contentRegistry } from '@content/index';
import type { MatchWord } from './matchWords';
import { MatchGame } from './MatchGame';

const WORDS: MatchWord[] = [];
for (const i of contentRegistry.items) {
  if (!i.word || WORDS.some((w) => w.lemma === i.word!.lemma || w.he === i.word!.he)) continue;
  WORDS.push({ lemma: i.word.lemma, he: i.word.he, item: i });
  if (WORDS.length === 2) break;
}

vi.mock('./matchWords', () => ({ pickMatchWords: () => WORDS }));

let go: (to: string) => void = () => {};
function Nav() {
  go = useNavigate();
  return null;
}

/** Regression: the 450ms pause after the last pair logged game.finished even when the game was left in it. */
it('a game left right after the last pair is not logged as finished', async () => {
  const db = new TutorDB(`match-${Math.random()}`);
  const store = new LearningStore(db);
  const student = await store.createStudent({ name: 'דנה' });
  const idle = { status: 'idle' } as const;
  const speech = { speak: vi.fn(async () => 'done'), stop: vi.fn(), subscribe: () => () => {}, getState: () => idle };
  const services = { db, store, content: contentRegistry, speech, settings: { get: () => undefined } } as unknown as AppServices;
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[`/s/${student.id}/match`]}>
        <Nav />
        <Routes>
          <Route path="/s/:sid/match" element={<MatchGame />} />
          <Route path="/s/:sid" element={<p>home</p>} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  for (const w of WORDS) {
    fireEvent.click(await screen.findByRole('button', { name: w.lemma }, { timeout: 4000 }));
    fireEvent.click(screen.getByRole('button', { name: w.he }));
  }
  act(() => go(`/s/${student.id}`));
  await screen.findByText('home');
  await new Promise((r) => setTimeout(r, 700));
  const types = (await db.events.toArray()).map((e) => e.type);
  expect(types).not.toContain('game.finished');
  await waitFor(async () => expect((await db.sessions.toArray()).every((s) => s.endedAt)).toBe(true));
});
