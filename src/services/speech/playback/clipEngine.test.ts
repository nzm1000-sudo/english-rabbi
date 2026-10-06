import { createClipEngine, type PreparedClip } from './clipEngine';

/** A 100 Hz buffer of `duration` seconds, silent except between `from` and `to`. */
function fakeBuffer(duration: number, from: number, to: number) {
  const x = new Float32Array(duration * 100);
  for (let i = from * 100; i < to * 100; i++) x[i] = 0.5;
  return { duration, sampleRate: 100, getChannelData: () => x };
}
const buffers = new Map<ArrayBuffer, ReturnType<typeof fakeBuffer>>();

/** A fake audio graph that records what was scheduled. */
class Param {
  value = 1;
  setValueAtTime(v: number) {
    this.value = v;
  }
}
const sources: FakeSource[] = [];
class FakeSource {
  buffer: { duration: number } | null = null;
  playbackRate = new Param();
  onended: (() => void) | null = null;
  started: [number, number] | null = null;
  stoppedAt: number | null = null;
  constructor() {
    sources.push(this);
  }
  connect() {}
  start(when: number, offset: number) {
    this.started = [when, offset];
  }
  stop(when: number) {
    this.stoppedAt = when;
  }
}
class FakeContext {
  currentTime = 10;
  state = 'running';
  destination = {};
  resume = async () => {};
  createBufferSource = () => new FakeSource();
  decodeAudioData = async (data: ArrayBuffer) => buffers.get(data) ?? fakeBuffer(4, 0, 4);
}
const stretchers: FakeStretcher[] = [];
class FakeStretcher {
  playbackRate = new Param();
  constructor() {
    stretchers.push(this);
  }
  connect() {}
  disconnect() {}
  static register = async () => {};
}

vi.mock('@soundtouchjs/audio-worklet', () => ({ SoundTouchNode: FakeStretcher }));

const files: Record<string, ArrayBuffer> = {};
const clip = (url: string): PreparedClip => ({ url, duration: 4 });

beforeEach(() => {
  sources.length = 0;
  stretchers.length = 0;
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('AudioWorkletNode', class {});
  vi.stubGlobal('fetch', async (url: string) => ({ arrayBuffer: async () => files[url] ?? new ArrayBuffer(8) }));
});

describe('Web Audio clip engine', () => {
  it('changes speed in the running stream, and switches clips on the audio clock', async () => {
    const engine = await createClipEngine();
    await engine.play(clip('blob:normal'), 1, 1);
    expect(sources).toHaveLength(1);
    const first = sources[0]!;
    expect(first.started?.[1]).toBe(1);

    // Faster: no new source, no stop. Only the rate changes.
    engine.setRate(1.5);
    expect(sources).toHaveLength(1);
    expect(first.stoppedAt).toBeNull();
    expect(first.playbackRate.value).toBe(1.5);
    expect(stretchers[0]!.playbackRate.value).toBe(1.5);

    // Another recording: the new one starts exactly when the old one stops.
    await engine.play(clip('blob:slow'), 1.2, 0.8);
    const second = sources[1]!;
    expect(first.stoppedAt).toBe(second.started![0]);
    expect(engine.playing).toBe(true);
    expect(stretchers).toHaveLength(1);
  });

  it('reports the end of a clip, but not of one it replaced', async () => {
    const engine = await createClipEngine();
    const ended = vi.fn();
    engine.onEnded = ended;
    await engine.play(clip('blob:a'), 0, 1);
    await engine.play(clip('blob:b'), 0, 1);
    sources[0]!.onended?.();
    expect(ended).not.toHaveBeenCalled();
    sources[1]!.onended?.();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(engine.playing).toBe(false);
  });

  it('maps by the speech, not the padding: a short sentence padded to the same length', async () => {
    const engine = await createClipEngine();
    // Normal: speech 0.2–1.0 s of 2 s. Slow: speech 0.2–1.2 s of 2 s.
    files['blob:n'] = new ArrayBuffer(1);
    files['blob:s'] = new ArrayBuffer(2);
    buffers.set(files['blob:n'], fakeBuffer(2, 0.2, 1));
    buffers.set(files['blob:s'], fakeBuffer(2, 0.2, 1.2));
    const n = { url: 'blob:n', duration: 2 };
    const s = { url: 'blob:s', duration: 2 };
    engine.preload(n);
    engine.preload(s);
    await engine.play(n, 0, 1);
    // Halfway through the speech of the normal file is halfway through the slow one.
    expect(engine.map(n, 0.6, s)).toBeCloseTo(0.7);
    // Proportional would have said 0.6, inside the word instead of at the same point.
    expect(engine.map(n, 1.5, s)).toBeCloseTo(1.2);
  });
});
