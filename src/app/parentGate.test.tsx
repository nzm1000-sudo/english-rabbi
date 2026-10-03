import { render, screen, act } from '@testing-library/react';
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
    await screen.findByText('למי התור ללמוד?');
    parentGate.unlock();
    await act(async () => {
      window.location.hash = '#/parent';
    });
    expect(await screen.findByText('מצב הורה', { selector: 'h1, .topbar *' })).toBeInTheDocument();
    await act(async () => {
      window.location.hash = '#/';
    });
    await screen.findByText('למי התור ללמוד?');
    expect(parentGate.isUnlocked()).toBe(false);
  });
});
