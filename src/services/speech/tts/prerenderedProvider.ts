import { audioKey } from '../audioKey';
import type { AudioPlayback } from '../playback/audioPlayer';
import { abortError, type SpeakRequest, type SpeechProvider, type SpeechVoice } from '../types';
import { NEURAL_VOICES } from '../voiceProfiles';

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

  private urlFor(req: SpeakRequest, m: PrerenderManifest): string | undefined {
    const voice = NEURAL_VOICES[req.accent][req.speaker ?? 'A'];
    return m.entries[audioKey(voice, req.rate, req.text)];
  }

  async canSpeak(req: SpeakRequest): Promise<boolean> {
    const m = await this.load();
    return !!m && !!this.urlFor(req, m);
  }

  async speak(req: SpeakRequest & { onStart?: () => void }): Promise<void> {
    const m = await this.load();
    const url = m && this.urlFor(req, m);
    if (!url) throw new Error('not pre-rendered');
    if (req.signal?.aborted) throw abortError();
    req.onStart?.();
    await this.playback.play(url, req.signal);
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
