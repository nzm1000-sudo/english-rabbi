import type { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import processorUrl from '@soundtouchjs/audio-worklet/processor?url';

/** Loaded only where worklets exist: the module extends AudioWorkletNode. */
type SoundTouch = typeof import('@soundtouchjs/audio-worklet').SoundTouchNode;

/** A recording ready to play: its length, and what the engine needs to play it. */
export interface PreparedClip {
  duration: number;
  /** Object URL of the file. */
  url: string;
}

/**
 * Plays one recorded clip at a time, at a speed that can change while it plays.
 * `play` while playing moves to the new clip without a gap.
 */
export interface ClipEngine {
  /** Reads a recording. Null when it cannot be played. */
  prepare(blob: Blob): Promise<PreparedClip | null>;
  /** Frees a clip that will not be played again. */
  release(clip: PreparedClip): void;
  play(clip: PreparedClip, offset: number, rate: number): Promise<void>;
  /** Gets a clip ready to start at once (the next sentence, the other speed). */
  preload(clip: PreparedClip): void;
  /** The point in `to` that says what `from` says at `t` (another speed of the same sentence). */
  map(from: PreparedClip, t: number, to: PreparedClip): number;
  pause(): void;
  setRate(rate: number): void;
  /** Seconds into the current clip. */
  time(): number;
  readonly playing: boolean;
  /** The current clip played to its end. */
  onEnded: () => void;
  /** Call inside a tap: browsers start sound only from a user gesture. */
  unlock(): void;
  dispose(): void;
}

/** Proportional position: right when both files have the same silence around the speech. */
const proportional = (from: PreparedClip, t: number, to: PreparedClip) => (from.duration > 0 ? Math.min(1, t / from.duration) * to.duration : 0);

/** Where the speech starts and ends: some files are padded with silence to a minimum length. */
function speechBounds(b: AudioBuffer): [number, number] {
  const x = b.getChannelData(0);
  const win = Math.max(1, Math.round(b.sampleRate / 100));
  let first = -1;
  let last = -1;
  for (let i = 0; i + win <= x.length; i += win) {
    let sum = 0;
    for (let k = i; k < i + win; k++) sum += x[k]! * x[k]!;
    if (Math.sqrt(sum / win) > 0.01) {
      if (first < 0) first = i;
      last = i + win;
    }
  }
  return first < 0 ? [0, b.duration] : [first / b.sampleRate, last / b.sampleRate];
}

/** Length of a recording, read from the file's header. */
function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => resolve(0);
    a.src = url;
  });
}

async function prepareBlob(blob: Blob): Promise<PreparedClip | null> {
  const url = URL.createObjectURL(blob);
  const duration = await probeDuration(url);
  if (duration > 0) return { duration, url };
  URL.revokeObjectURL(url);
  return null;
}

/** Engines that sound now; the shared context sleeps when none does. */
const sounding = new Set<object>();
let sleepTimer: ReturnType<typeof setTimeout> | undefined;
function setSounding(ctx: AudioContext, engine: object, on: boolean) {
  if (on) sounding.add(engine);
  else sounding.delete(engine);
  clearTimeout(sleepTimer);
  if (!sounding.size) sleepTimer = setTimeout(() => !sounding.size && ctx.state === 'running' && void ctx.suspend(), 3000);
}

type Ctx = { ctx: AudioContext; ready: Promise<SoundTouch | null> };
let shared: Ctx | null = null;

/** One audio context for the app, with the time-stretcher loaded. */
function audioContext(): Ctx | null {
  if (shared) return shared;
  const AC = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC || typeof AudioWorkletNode === 'undefined') return null;
  try {
    const ctx = new AC({ latencyHint: 'playback' });
    const ready = import('@soundtouchjs/audio-worklet').then(
      async ({ SoundTouchNode }) => {
        await SoundTouchNode.register(ctx, processorUrl);
        return SoundTouchNode;
      },
      () => null,
    );
    shared = { ctx, ready: ready.catch(() => null) };
    return shared;
  } catch {
    return null;
  }
}

/**
 * Web Audio engine: the clip is decoded and played through a time-stretcher
 * (SoundTouch). Speed is a parameter of the running stream, so changing it
 * never restarts anything; changing clips is scheduled on the audio clock.
 */
class StretchEngine implements ClipEngine {
  onEnded = () => {};
  private st: SoundTouchNode | null = null;
  private src: AudioBufferSourceNode | null = null;
  private startAt = 0;
  private from = 0;
  private rate = 1;
  private duration = 0;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private bounds = new Map<string, [number, number]>();
  private turn = 0;

  constructor(
    private readonly ctx: AudioContext,
    private readonly Stretcher: SoundTouch,
  ) {}

  get playing() {
    return !!this.src;
  }

  prepare = prepareBlob;

  release(clip: PreparedClip) {
    this.buffers.delete(clip.url);
    this.bounds.delete(clip.url);
    URL.revokeObjectURL(clip.url);
  }

  /** Decoded audio of a clip; the last few stay in memory. */
  private decode(clip: PreparedClip) {
    let b = this.buffers.get(clip.url);
    if (!b) {
      b = fetch(clip.url)
        .then((r) => r.arrayBuffer())
        .then((data) => this.ctx.decodeAudioData(data))
        .then((buf) => {
          this.bounds.set(clip.url, speechBounds(buf));
          return buf;
        })
        .catch(() => null);
      this.buffers.set(clip.url, b);
      while (this.buffers.size > 6) this.buffers.delete(this.buffers.keys().next().value!);
    }
    return b;
  }

  preload(clip: PreparedClip) {
    void this.decode(clip);
  }

  map(from: PreparedClip, t: number, to: PreparedClip) {
    const a = this.bounds.get(from.url);
    const b = this.bounds.get(to.url);
    if (!a || !b) return proportional(from, t, to);
    // Silence before the speech maps to the start, after it to the end.
    if (t <= a[0]) return b[0];
    if (t >= a[1]) return b[1];
    return b[0] + ((t - a[0]) / (a[1] - a[0])) * (b[1] - b[0]);
  }

  unlock() {
    // iOS: play through the silent switch, like a media app.
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  async play(clip: PreparedClip, offset: number, rate: number) {
    const mine = ++this.turn;
    this.unlock();
    const buffer = await this.decode(clip);
    if (mine !== this.turn) return;
    if (!buffer) throw new Error('audio decode failed');
    if (this.ctx.state !== 'running') await this.ctx.resume();
    if (mine !== this.turn) return;
    if (!this.st) {
      this.st = new this.Stretcher({ context: this.ctx, outputChannelCount: 1 });
      this.st.connect(this.ctx.destination);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    this.st.playbackRate.value = rate;
    src.connect(this.st);
    // The old clip stops at the very moment the new one starts.
    const when = this.ctx.currentTime + 0.02;
    this.stopSource(when);
    src.start(when, Math.max(0, Math.min(offset, buffer.duration - 0.01)));
    src.onended = () => {
      if (this.src !== src) return;
      this.from = this.time();
      this.src = null;
      setSounding(this.ctx, this, false);
      this.onEnded();
    };
    this.src = src;
    setSounding(this.ctx, this, true);
    this.startAt = when;
    this.from = offset;
    this.rate = rate;
    this.duration = buffer.duration;
  }

  private stopSource(when = this.ctx.currentTime) {
    const old = this.src;
    if (!old) return;
    this.src = null;
    old.onended = null;
    try {
      old.stop(when);
    } catch {
      // Already stopped.
    }
  }

  pause() {
    this.turn++;
    this.from = this.time();
    this.stopSource();
    setSounding(this.ctx, this, false);
    // Drop what the stretcher still holds, so a later play starts clean.
    this.st?.disconnect();
    this.st = null;
  }

  setRate(rate: number) {
    if (this.src) {
      this.from = this.time();
      this.startAt = Math.max(this.ctx.currentTime, this.startAt);
      const now = this.ctx.currentTime;
      this.src.playbackRate.setValueAtTime(rate, now);
      this.st?.playbackRate.setValueAtTime(rate, now);
    }
    this.rate = rate;
  }

  time() {
    if (!this.src) return this.from;
    const t = this.from + Math.max(0, this.ctx.currentTime - this.startAt) * this.rate;
    return Math.min(t, this.duration);
  }

  dispose() {
    this.pause();
    for (const url of this.buffers.keys()) URL.revokeObjectURL(url);
    this.buffers.clear();
  }
}

/**
 * Fallback for browsers without Web Audio worklets: one audio element whose
 * playback rate changes in place.
 */
class ElementEngine implements ClipEngine {
  onEnded = () => {};
  private el = new Audio();
  private turn = 0;

  constructor() {
    this.el.addEventListener('ended', () => this.onEnded());
  }

  get playing() {
    return !this.el.paused && !this.el.ended;
  }

  prepare = prepareBlob;

  release(clip: PreparedClip) {
    if (this.el.src !== clip.url) URL.revokeObjectURL(clip.url);
  }

  unlock() {}

  preload() {}

  map = proportional;

  async play(clip: PreparedClip, offset: number, rate: number) {
    const mine = ++this.turn;
    const el = this.el;
    if (el.src !== clip.url) el.src = clip.url;
    (el as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
    el.preservesPitch = true;
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
    el.currentTime = offset;
    try {
      await el.play();
    } catch (e) {
      // A play cut short by a newer one is not an error.
      if (mine === this.turn && (e as Error)?.name !== 'AbortError') throw e;
    }
  }

  pause() {
    this.turn++;
    this.el.pause();
  }

  setRate(rate: number) {
    this.el.defaultPlaybackRate = rate;
    this.el.playbackRate = rate;
  }

  time() {
    return this.el.currentTime;
  }

  dispose() {
    this.pause();
    this.el.removeAttribute('src');
    this.el.load();
  }
}

/** A Web Audio engine when the stretcher loads, otherwise the audio element one. */
export async function createClipEngine(): Promise<ClipEngine> {
  const c = audioContext();
  const Stretcher = c && (await c.ready);
  if (c && Stretcher) return new StretchEngine(c.ctx, Stretcher);
  return new ElementEngine();
}
