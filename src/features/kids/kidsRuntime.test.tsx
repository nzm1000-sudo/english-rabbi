import { StrictMode, type ReactNode } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { ServicesProvider, type AppServices } from '@/app/services';
import { TutorDB } from '@/data/schema';
import { LearningStore } from '@/data/store';
import { createStudent } from '@/domain/student/student';
import { useKidsSession } from './kidsSession';
import { HoldButton } from './ParentGate';
import { useSpeechSteps } from './speechSteps';
import { TimeGate } from './timeLimit';

function setup() {
  const db = new TutorDB(`kids-${Math.random()}`);
  const store = new LearningStore(db);
  const services = { db, store } as unknown as AppServices;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <ServicesProvider services={services}>{children}</ServicesProvider>
    </StrictMode>
  );
  return { db, store, wrapper };
}

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

describe('useSpeechSteps', () => {
  it('a new sequence drops the rest of the old one', async () => {
    const { result } = renderHook(() => useSpeechSteps());
    const said: string[] = [];
    const first = deferred();
    const old = result.current.run(() => first.promise, () => said.push('try again'));
    const now = result.current.run(() => said.push('well done'));
    first.resolve();
    expect(await old).toBe(false);
    expect(await now).toBe(true);
    expect(said).toEqual(['well done']);
  });

  it('says nothing more after the game left the screen', async () => {
    const { result, unmount } = renderHook(() => useSpeechSteps());
    const said: string[] = [];
    const first = deferred();
    const seq = result.current.run(() => first.promise, () => said.push('the word'));
    unmount();
    first.resolve();
    expect(await seq).toBe(false);
    expect(said).toEqual([]);
    expect(result.current.alive()).toBe(false);
  });
});

describe('useKidsSession', () => {
  const setVisibility = (v: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  afterEach(() => setVisibility('visible'));

  it('ends the session when the app goes to the background, and starts a new one on return', async () => {
    const { db, wrapper } = setup();
    const { unmount } = renderHook(() => useKidsSession('kid-1', 'kids:listen'), { wrapper });
    const open = async () => (await db.sessions.toArray()).filter((s) => !s.endedAt);
    await waitFor(async () => expect(await open()).toHaveLength(1));
    act(() => setVisibility('hidden'));
    await waitFor(async () => expect(await open()).toHaveLength(0));
    act(() => setVisibility('visible'));
    await waitFor(async () => expect(await open()).toHaveLength(1));
    unmount();
    await waitFor(async () => expect(await open()).toHaveLength(0));
  });
});

describe('HoldButton', () => {
  it('a quick tap with two fingers does not count as a long press', async () => {
    const done = vi.fn();
    render(
      <HoldButton onDone={done} label="יציאה">
        x
      </HoldButton>,
    );
    const b = screen.getByRole('button');
    fireEvent.pointerDown(b, { pointerId: 1 });
    fireEvent.pointerDown(b, { pointerId: 2 });
    await new Promise((r) => setTimeout(r, 50));
    fireEvent.pointerUp(b, { pointerId: 1 });
    fireEvent.pointerUp(b, { pointerId: 2 });
    await new Promise((r) => setTimeout(r, 1800));
    expect(done).not.toHaveBeenCalled();
  });
});

describe('TimeGate', () => {
  // The store counts the day from local midnight; a fixed midday keeps the
  // 12-minute session below inside today whatever the real clock says.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('does not start another round once the daily time is used up', async () => {
    const { store, wrapper } = setup();
    const now = Date.now();
    const student = { ...createStudent({ name: 'Ori' }, 'kid-2', now), stage: 'little' as const, kidsDailyLimit: 10 };
    const s = await store.startSession(student.id, 'kids:listen');
    await store.db.sessions.update(s.id, { startedAt: now - 12 * 60000, endedAt: now - 60000 });
    render(
      <TimeGate student={student} home={null}>
        <p>game</p>
      </TimeGate>,
      { wrapper },
    );
    expect(await screen.findByText('להיום סיימנו!')).toBeInTheDocument();
    expect(screen.queryByText('game')).not.toBeInTheDocument();
  });

  it('lets the round start while there is time left', async () => {
    const { wrapper } = setup();
    const student = { ...createStudent({ name: 'Ori' }, 'kid-3', Date.now()), stage: 'little' as const, kidsDailyLimit: 10 };
    render(
      <TimeGate student={student} home={null}>
        <p>game</p>
      </TimeGate>,
      { wrapper },
    );
    expect(await screen.findByText('game')).toBeInTheDocument();
  });
});

/** Regression: a book's screen time ran on through the reward screen until the child left it. */
it('a book ends its session when the reward shows', async () => {
  const { kidBooks } = await import('@content/kids');
  const { MemoryRouter, Route, Routes } = await import('react-router-dom');
  const { KidsBook } = await import('./KidsBooks');
  const db = new TutorDB(`kids-${Math.random()}`);
  const store = new LearningStore(db);
  const student = await store.createStudent({ name: 'דנה' });
  const idle = { status: 'idle' } as const;
  const speech = { speak: vi.fn(async () => 'done'), stop: vi.fn(), subscribe: () => () => {}, getState: () => idle };
  const services = { db, store, speech, settings: { get: () => undefined } } as unknown as AppServices;
  const book = kidBooks[0]!;
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[`/s/${student.id}/kids/books/${book.id}`]}>
        <Routes>
          <Route path="/s/:sid/kids/books/:bookId" element={<KidsBook />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  const open = async () => (await db.sessions.toArray()).filter((s) => !s.endedAt);
  await waitFor(async () => expect(await open()).toHaveLength(1));
  for (let i = 1; i < book.pages.length; i++) fireEvent.click(await screen.findByRole('button', { name: 'הדף הבא' }));
  fireEvent.click(await screen.findByRole('button', { name: 'סוף' }));
  await waitFor(async () => expect(await open()).toHaveLength(0));
  expect(await db.sessions.count()).toBe(1);
});
