import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ServicesProvider, type AppServices } from '@/app/services';
import { SpeechService } from '@/services/speech/speechService';
import type { SpeechRate } from '@/services/speech/types';
import { AudioPlayer } from './AudioPlayer';

/** Which file each object URL was made from. */
const fileOf = new Map<string, string>();
const blobFile = new WeakMap<Blob, string>();
const elements: FakeAudio[] = [];

/** Just enough of an audio element: every file is 2 seconds long. */
class FakeAudio extends EventTarget {
  private source = '';
  currentTime = 0;
  duration = NaN;
  paused = true;
  ended = false;
  preload = '';
  playbackRate = 1;
  defaultPlaybackRate = 1;
  preservesPitch = true;
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    super();
    elements.push(this);
  }
  get src() {
    return this.source;
  }
  set src(v: string) {
    this.source = v;
    this.currentTime = 0;
    this.duration = 2;
    setTimeout(() => this.onloadedmetadata?.(), 0);
  }
  getAttribute(name: string) {
    return name === 'src' && this.source ? this.source : null;
  }
  removeAttribute() {
    this.source = '';
    this.duration = NaN;
  }
  load() {}
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

function setup(status = 200) {
  vi.stubGlobal('Audio', FakeAudio);
  let n = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    const u = `blob:${++n}`;
    fileOf.set(u, blobFile.get(b as Blob) ?? '?');
    return u;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const b = new Blob([url]);
      blobFile.set(b, url);
      return { ok: status === 200, status, blob: async () => b } as Response;
    }),
  );
  const recorded = {
    clipsFor: vi.fn(async ({ rate }: { rate: SpeechRate }) => ({ urls: [`${rate}.mp3`], playbackRate: 1 })),
  };
  const services = { recorded, speech: new SpeechService([]), settings: { get: () => undefined } } as unknown as AppServices;
  render(
    <ServicesProvider services={services}>
      <AudioPlayer segments={[{ text: 'It is Friday morning.' }]} />
    </ServicesProvider>,
  );
  return recorded;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  elements.length = 0;
});

describe('AudioPlayer', () => {
  it('speeds up in place and switches to slow recordings without stopping', async () => {
    setup();
    const play = await screen.findByRole('button', { name: 'ניגון' });
    await waitFor(() => expect(play).toBeEnabled());
    await act(async () => fireEvent.click(play));
    const el = elements.find((e) => !e.paused)!;
    expect(fileOf.get(el.src)).toBe('normal.mp3');
    el.currentTime = 1;
    const chip = () => screen.getByRole('button', { name: /^מהירות/ });
    // Faster: same file, faster playback, still playing.
    fireEvent.click(chip());
    expect(chip()).toHaveTextContent('1.25×');
    expect(fileOf.get(el.src)).toBe('normal.mp3');
    expect(el.playbackRate).toBeCloseTo(1.25);
    expect(el.paused).toBe(false);
    fireEvent.click(chip());
    expect(el.playbackRate).toBeCloseTo(1.5);
    // Slower: the slow recording takes over at the same point and keeps playing.
    fireEvent.click(chip());
    expect(chip()).toHaveTextContent('0.65×');
    await waitFor(() => expect(fileOf.get(el.src)).toBe('slow.mp3'));
    expect(el.paused).toBe(false);
    expect(el.currentTime).toBeCloseTo(1);
    expect(el.playbackRate).toBeCloseTo(0.8);
  });

  it('downloads each speed once: many speed taps never fetch again', async () => {
    const recorded = setup();
    const play = await screen.findByRole('button', { name: 'ניגון' });
    await waitFor(() => expect(play).toBeEnabled());
    await waitFor(() => expect(recorded.clipsFor).toHaveBeenCalledTimes(2));
    await act(async () => fireEvent.click(play));
    const el = elements.find((e) => !e.paused)!;
    const fetches = vi.mocked(fetch).mock.calls.length;
    for (let i = 0; i < 12; i++) fireEvent.click(screen.getByRole('button', { name: /^מהירות/ }));
    await waitFor(() => expect(el.paused).toBe(false));
    expect(vi.mocked(fetch).mock.calls.length).toBe(fetches);
    expect(recorded.clipsFor).toHaveBeenCalledTimes(2);
  });

  it('after a speed change while paused, play resumes in the new recording at the same place', async () => {
    setup();
    const play = await screen.findByRole('button', { name: 'ניגון' });
    await waitFor(() => expect(play).toBeEnabled());
    await act(async () => fireEvent.click(play));
    const el = elements.find((e) => !e.paused)!;
    el.currentTime = 1;
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'השהיה' })));
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: /^מהירות/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^מהירות/ })).toHaveTextContent('0.8×'));
    await waitFor(() => expect(el.getAttribute('src')).toBeNull());
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'ניגון' })));
    expect(fileOf.get(el.src)).toBe('slow.mp3');
    expect(el.currentTime).toBeCloseTo(1);
  });

  it('falls back to a speaker button when the files cannot be loaded', async () => {
    setup(404);
    expect(await screen.findByRole('button', { name: 'השמעה' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'נגן הקראה' })).toBeNull();
  });
});
