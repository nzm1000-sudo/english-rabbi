import { isAbort, type SpeakRequest, type SpeechProvider, type Speaker } from './types';
import { canonicalSpeechText } from './textPrep';

/**
 * Single entry point for speaking English in the app.
 *  - Tries providers in priority order and falls back on failure, so the
 *    learner never gets an error just because one engine is unavailable.
 *  - Only one thing speaks at a time. A new request stops the previous one.
 *  - Exposes a tiny observable state for UI feedback (loading / playing).
 */
export type SpeechState = { status: 'idle' } | { status: 'loading' | 'playing'; key: string; provider?: string };

export interface SpeakOptions {
  accent: SpeakRequest['accent'];
  rate: SpeakRequest['rate'];
  speaker?: Speaker;
  voiceId?: string;
  /** Identifies the UI element, so only that button shows activity. */
  key?: string;
  /** Force one provider (voice lab comparisons). */
  provider?: string;
}

export interface SpeechEvents {
  onPlayed?: (info: { text: string; provider: string; key: string }) => void;
}

export class SpeechService {
  private state: SpeechState = { status: 'idle' };
  private listeners = new Set<() => void>();
  private stopListeners = new Set<() => void>();
  private current: AbortController | null = null;
  private active: SpeechProvider | null = null;

  constructor(private readonly providers: SpeechProvider[], private readonly events: SpeechEvents = {}) {}

  getProviders(): readonly SpeechProvider[] {
    return this.providers;
  }

  getState = (): SpeechState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  /**
   * Called on every stop, including the stop before each new sound. Other
   * players (the story player, a learner's own recording) pause here, so
   * "silence" really silences everything.
   */
  onStop = (fn: () => void): (() => void) => {
    this.stopListeners.add(fn);
    return () => this.stopListeners.delete(fn);
  };

  private set(s: SpeechState) {
    this.state = s;
    for (const l of this.listeners) l();
  }

  /** Resolves when done or stopped. Never throws for a stop. */
  async speak(text: string, opts: SpeakOptions): Promise<'done' | 'stopped' | 'failed'> {
    return this.run(opts.key ?? text, async (signal) => {
      await this.speakOne(canonicalSpeechText(text), opts, signal, opts.key ?? text);
    });
  }

  /** Speaks dialogue lines in order with consistent voices per speaker. */
  async speakDialogue(lines: { speaker: Speaker; text: string }[], opts: Omit<SpeakOptions, 'speaker'>): Promise<'done' | 'stopped' | 'failed'> {
    const key = opts.key ?? lines.map((l) => l.text).join(' ');
    return this.run(key, async (signal) => {
      for (const l of lines) {
        await this.speakOne(canonicalSpeechText(l.text), { ...opts, speaker: l.speaker }, signal, key);
        await new Promise((r) => setTimeout(r, 250));
      }
    });
  }

  stop(): void {
    this.current?.abort();
    this.current = null;
    this.active?.stop();
    this.set({ status: 'idle' });
    for (const l of this.stopListeners) l();
  }

  private async run(key: string, body: (signal: AbortSignal) => Promise<void>): Promise<'done' | 'stopped' | 'failed'> {
    this.stop();
    const ctrl = new AbortController();
    this.current = ctrl;
    this.set({ status: 'loading', key });
    try {
      await body(ctrl.signal);
      return 'done';
    } catch (e) {
      if (isAbort(e) || ctrl.signal.aborted) return 'stopped';
      console.warn('[speech] all providers failed', e);
      return 'failed';
    } finally {
      if (this.current === ctrl) {
        this.current = null;
        this.set({ status: 'idle' });
      }
    }
  }

  private async speakOne(text: string, opts: SpeakOptions, signal: AbortSignal, key: string): Promise<void> {
    const req: SpeakRequest & { onStart?: () => void } = {
      text,
      accent: opts.accent,
      rate: opts.rate,
      ...(opts.speaker ? { speaker: opts.speaker } : {}),
      ...(opts.voiceId ? { voiceId: opts.voiceId } : {}),
      signal,
    };
    let lastError: unknown = new Error('no speech provider available');
    const providers = opts.provider ? this.providers.filter((p) => p.id === opts.provider) : this.providers;
    for (const p of providers) {
      if (signal.aborted) throw new DOMException('stopped', 'AbortError');
      const ok = await p.canSpeak(req).catch(() => false);
      if (!ok) continue;
      try {
        this.active = p;
        req.onStart = () => this.set({ status: 'playing', key, provider: p.id });
        await p.speak(req);
        this.events.onPlayed?.({ text, provider: p.id, key });
        return;
      } catch (e) {
        if (isAbort(e)) throw e;
        lastError = e;
      }
    }
    throw lastError;
  }
}
