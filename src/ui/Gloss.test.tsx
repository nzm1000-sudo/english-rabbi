import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ServicesProvider, type AppServices } from '@/app/services';
import { GlossProvider, GlossScope, TapText, useGloss } from './Gloss';
import { useState } from 'react';

let go: (path: string) => void = () => {};

function Screen() {
  const g = useGloss();
  go = useNavigate();
  return (
    <main className="screen">
      <button onClick={() => g?.open({ word: 'kitchen', senses: [{ lemma: 'kitchen', he: 'מטבח' }] })}>word</button>
    </main>
  );
}

const IDLE = { status: 'idle' } as const;

it('the meaning popup belongs to one screen: the next story starts without it', async () => {
  const services = {
    store: { savedWords: async () => [], saveWord: vi.fn(async () => {}), removeWord: vi.fn() },
    speech: { speak: vi.fn(async () => 'done'), subscribe: () => () => {}, getState: () => IDLE },
    settings: { get: () => undefined },
  } as unknown as AppServices;
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={['/s/x/stories/a']}>
        <Routes>
          <Route
            path="/s/:sid/stories/:storyId"
            element={
              <GlossProvider>
                <Screen />
              </GlossProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  fireEvent.click(screen.getByText('word'));
  expect(screen.getByRole('dialog', { name: 'פירוש המילה' })).toHaveTextContent('מטבח');
  await act(async () => go('/s/x/stories/b'));
  expect(screen.queryByRole('dialog')).toBeNull();
});

/**
 * Regression: in timed rounds (lightning, exam) a tapped word was saved to
 * "המילים שלי", and the popup stayed open on the next question.
 */
it('a scope can show without saving, and closes its popup when it ends', async () => {
  const saveWord = vi.fn(async () => {});
  const services = {
    store: { savedWords: async () => [], saveWord, removeWord: vi.fn() },
    speech: { speak: vi.fn(async () => 'done'), subscribe: () => () => {}, getState: () => IDLE },
    settings: { get: () => undefined },
  } as unknown as AppServices;
  let next: () => void = () => {};
  function Question() {
    const [n, setN] = useState(0);
    next = () => setN((x) => x + 1);
    return (
      <GlossScope key={n} save={false}>
        <p>
          <TapText text="the kitchen" />
        </p>
      </GlossScope>
    );
  }
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={['/s/x/practice/lightning']}>
        <Routes>
          <Route
            path="/s/:sid/practice/:mode"
            element={
              <GlossProvider>
                <Question />
              </GlossProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  fireEvent.click(await screen.findByText('kitchen', { selector: '.word-tap' }, { timeout: 4000 }));
  expect(screen.getByRole('dialog', { name: 'פירוש המילה' })).toBeInTheDocument();
  expect(saveWord).not.toHaveBeenCalled();
  expect(screen.queryByText('שומרים...')).toBeNull();
  await act(async () => next());
  expect(screen.queryByRole('dialog')).toBeNull();
});
