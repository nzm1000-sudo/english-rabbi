import { PcmRecorder } from './pcmRecorder';

/** A microphone whose permission answer arrives when the test says so. */
function fakeMic() {
  const tracks: { stopped: boolean; stop: () => void }[] = [];
  const pending: (() => void)[] = [];
  const getUserMedia = vi.fn(
    () =>
      new Promise((resolve) => {
        pending.push(() => {
          const t = { stopped: false, stop: () => void (t.stopped = true) };
          tracks.push(t);
          resolve({ getTracks: () => [t] });
        });
      }),
  );
  return { tracks, grant: () => pending.shift()?.(), getUserMedia };
}

class FakeAudioContext {
  sampleRate = 48000;
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  createScriptProcessor = () => ({ connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null });
  destination = {};
}

describe('PcmRecorder microphone', () => {
  let mic: ReturnType<typeof fakeMic>;
  beforeEach(() => {
    mic = fakeMic();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: mic.getUserMedia } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('turns the microphone off when it is granted after leaving the screen', async () => {
    const r = new PcmRecorder();
    const started = r.start();
    r.release();
    mic.grant();
    await expect(started).rejects.toMatchObject({ name: 'AbortError' });
    expect(mic.tracks.map((t) => t.stopped)).toEqual([true]);
  });

  it('keeps only one microphone when started twice', async () => {
    const r = new PcmRecorder();
    const first = r.start();
    const second = r.start();
    mic.grant();
    mic.grant();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await second;
    r.release();
    expect(mic.tracks.map((t) => t.stopped)).toEqual([true, true]);
  });
});
