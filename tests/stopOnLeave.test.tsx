import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ServicesProvider, type AppServices } from '@/app/services';

/**
 * Regression: leaving a screen while a question is being read aloud must stop
 * the speech. The app stops speech on every route change (App.tsx) and when an
 * exercise unmounts (ExerciseView).
 */
function StopOnRoute({ stop }: { stop: () => void }) {
  // Mirrors StopSpeechOnNavigate in App.tsx.
  const nav = useNavigate();
  useEffect(() => {
    (window as unknown as { go: (p: string) => void }).go = (p) => nav(p);
  }, [nav]);
  return <Routes><Route path="/a" element={<Probe stop={stop} />} /><Route path="/b" element={<p>B</p>} /></Routes>;
}
function Probe({ stop }: { stop: () => void }) {
  useEffect(() => () => stop(), [stop]);
  return <p>A</p>;
}

it('leaving a screen stops speech', () => {
  const stop = vi.fn();
  const services = { speech: { stop } } as unknown as AppServices;
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={['/a']}>
        <StopOnRoute stop={stop} />
      </MemoryRouter>
    </ServicesProvider>,
  );
  expect(screen.getByText('A')).toBeInTheDocument();
  act(() => (window as unknown as { go: (p: string) => void }).go('/b'));
  expect(stop).toHaveBeenCalled();
});
