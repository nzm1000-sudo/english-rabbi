import { render, screen, act, fireEvent } from '@testing-library/react';
import { App } from './App';
import { ServicesProvider, type AppServices } from './services';
import { Settings } from './settings';
import { TutorDB } from '@/data/schema';
import { LearningStore } from '@/data/store';
import { parentGate } from './parentGate';

function services(): AppServices {
  const db = new TutorDB('parent-gate-test');
  return { db, store: new LearningStore(db), settings: new Settings(db), speech: { stop: () => {} } } as unknown as AppServices;
}

describe('parent gate', () => {
  it('a link or the back button to the parent area lands on the picker', async () => {
    parentGate.lock();
    window.location.hash = '#/parent';
    render(
      <ServicesProvider services={services()}>
        <App />
      </ServicesProvider>,
    );
    expect(await screen.findByText('למי התור ללמוד?')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/');
  });

  it('opens after the long press, and the picker locks it again', async () => {
    parentGate.lock();
    window.location.hash = '#/';
    render(
      <ServicesProvider services={services()}>
        <App />
      </ServicesProvider>,
    );
    const gate = await screen.findByRole('button', { name: 'מצב הורה: להחזיק לחוץ כדי להיכנס' });
    // The press is timed with animation frames: fake them (only them) so a busy machine cannot stretch it.
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      fireEvent.pointerDown(gate);
      act(() => vi.advanceTimersByTime(1400));
      expect(parentGate.isUnlocked()).toBe(false);
      act(() => vi.advanceTimersByTime(200));
    } finally {
      vi.useRealTimers();
    }
    expect(parentGate.isUnlocked()).toBe(true);
    expect(await screen.findByText('מצב הורה', { selector: 'h1, .topbar *' })).toBeInTheDocument();
    // Wait for the router inside act, so the picker's effect (the lock) has run before the check.
    await act(async () => {
      const changed = new Promise((r) => window.addEventListener('hashchange', r, { once: true }));
      window.location.hash = '#/';
      await changed;
    });
    expect(screen.getByText('למי התור ללמוד?')).toBeInTheDocument();
    expect(parentGate.isUnlocked()).toBe(false);
  });
});
