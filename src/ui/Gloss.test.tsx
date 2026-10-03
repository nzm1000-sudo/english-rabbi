import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ServicesProvider, type AppServices } from '@/app/services';
import { GlossProvider, useGloss } from './Gloss';

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
