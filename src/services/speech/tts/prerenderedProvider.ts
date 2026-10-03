import { audioKey } from '../audioKey';
import type { AudioPlayback } from '../playback/audioPlayer';
import { abortError, type SpeakRequest, type SpeechProvider, type SpeechVoice } from '../types';
import { NEURAL_VOICES } from '../voiceProfiles';
import { splitSentences } from '../textPrep';

/**
 * Plays neural-voice audio files generated ahead of time by
 * tools/tts-prerender (Kokoro-82M). Works fully offline once the files are
 * cached by the service worker. Covers only fixed content (words, example
 * sentences, listening items). Anything else falls through to the next
 * provider.
 */
export interface PrerenderManifest {
  version: 1;
  engine: string;
  /** audioKey -> relative url */
  entries: Record<string, string>;
}

const SLOWER_PLAYBACK = 0.8;

interface Playable {
  urls: string[];
  playbackRate: number;
}

export class PrerenderedProvider implements SpeechProvider {
  readonly id = 'prerendered';
  readonly label = 'קול טבעי מוקלט מראש';
  private manifest: PrerenderManifest | null = null;
  private loading: Promise<PrerenderManifest | null> | null = null;

  constructor(
    private readonly playback: AudioPlayback,
    private readonly manifestUrl = 'audio/manifest.json',
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  private async load(): Promise<PrerenderManifest | null> {
    if (this.manifest) return this.manifest;
    this.loading ??= this.fetchFn(this.manifestUrl)
      .then((r) => (r.ok ? (r.json() as Promise<PrerenderManifest>) : null))
      .catch(() => null)
      .then((m) => (this.manifest = m));
    return this.loading;
  }

  /**
   * Files for this request: one file for the whole text, or one per
   * sentence for long texts (reading passages). Undefined if any is missing.
   */
  private urlsFor(req: SpeakRequest, m: PrerenderManifest): Playable | undefined {
    const voice = NEURAL_VOICES[req.accent][req.speaker ?? 'A'];
    const find = (rate: string): string[] | undefined => {
      const whole = m.entries[audioKey(voice, rate, req.text)];
      if (whole) return [whole];
      const parts = splitSentences(req.text);
      if (parts.length < 2) return undefined;
      const urls = parts.map((p) => m.entries[audioKey(voice, rate, p)]);
      return urls.every(Boolean) ? (urls as string[]) : undefined;
    };
    // "Slower" plays the engine-made slow recording a little slower again.
    const rate = req.rate === 'slower' ? 'slow' : req.rate;
    const exact = find(rate);
    if (exact) return { urls: exact, playbackRate: req.rate === 'slower' ? SLOWER_PLAYBACK : 1 };
    // Questions and answers are recorded at normal speed only; slow them down on playback.
    if (rate === 'slow') {
      const normal = find('normal');
      if (normal) return { urls: normal, playbackRate: req.rate === 'slower' ? 0.7 : 0.85 };
    }
    return undefined;
  }

  async canSpeak(req: SpeakRequest): Promise<boolean> {
    const m = await this.load();
    return !!m && !!this.urlsFor(req, m);
  }

  async speak(req: SpeakRequest & { onStart?: () => void }): Promise<void> {
    const m = await this.load();
    const found = m && this.urlsFor(req, m);
    if (!found) throw new Error('not pre-rendered');
    const { urls, playbackRate } = found;
    // Fetch whole files (not Range requests) so the service worker can cache
    // them; play from memory. First file is fetched before reporting "playing".
    let next = this.fetchAudio(urls[0]!, req.signal);
    for (let i = 0; i < urls.length; i++) {
      const blob = await next;
      if (req.signal?.aborted) throw abortError();
      if (i + 1 < urls.length) next = this.fetchAudio(urls[i + 1]!, req.signal);
      if (i === 0) req.onStart?.();
      await this.playback.play(blob, req.signal, playbackRate);
    }
  }

  private async fetchAudio(url: string, signal?: AbortSignal): Promise<Blob> {
    const res = await this.fetchFn(url, signal ? { signal } : undefined);
    if (!res.ok) throw new Error(`audio ${res.status}`);
    return res.blob();
  }

  /** Downloads every file into the offline cache. Reports progress. */
  async downloadAll(onProgress: (done: number, total: number) => void, concurrency = 6): Promise<{ done: number; failed: number }> {
    const m = await this.load();
    if (!m) return { done: 0, failed: 0 };
    const urls = [...new Set(Object.values(m.entries))];
    let done = 0;
    let failed = 0;
    let i = 0;
    const worker = async () => {
      while (i < urls.length) {
        const url = urls[i++]!;
        try {
          const r = await this.fetchFn(url);
          if (!r.ok) failed++;
          else await r.arrayBuffer();
        } catch {
          failed++;
        }
        onProgress(++done, urls.length);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return { done, failed };
  }

  stop(): void {
    this.playback.stop();
  }

  async voices(): Promise<SpeechVoice[]> {
    return Object.entries(NEURAL_VOICES).flatMap(([accent, v]) =>
      Object.values(v).map((id) => ({ id, name: id, lang: accent, accent: accent as SpeechVoice['accent'], quality: 'neural' as const, provider: this.id, offline: true })),
    );
  }
}
