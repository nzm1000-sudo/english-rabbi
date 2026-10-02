import { audioKey } from '../audioKey';
import type { AudioPlayback } from '../playback/audioPlayer';
import { abortError, type SpeakRequest, type SpeechProvider, type SpeechVoice } from '../types';
import { NEURAL_VOICES, RATE_FACTOR } from '../voiceProfiles';

/**
 * Neural TTS on the family's home server. Speaks the OpenAI-compatible
 * `/v1/audio/speech` protocol, which Kokoro-FastAPI (Apache-2.0) and other
 * self-hosted servers implement. Only English learning text is sent; no
 * learner data. Generated audio is cached locally, so a repeated phrase is
 * never generated twice. Disabled until a server URL is configured.
 */
export interface AudioCache {
  get(key: string): Promise<Blob | undefined>;
  put(key: string, blob: Blob, meta: { provider: string; voiceId: string; text: string }): Promise<void>;
}

export interface RemoteTtsConfig {
  baseUrl: string;
  model?: string;
  timeoutMs?: number;
}

export class RemoteTtsProvider implements SpeechProvider {
  readonly id = 'home-server';
  readonly label = 'שרת ביתי';
  private healthy: boolean | null = null;

  constructor(
    private readonly config: RemoteTtsConfig,
    private readonly playback: AudioPlayback,
    private readonly cache: AudioCache,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  async canSpeak(): Promise<boolean> {
    if (!this.config.baseUrl) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    // A failed request marks the server unhealthy for this app session.
    return this.healthy !== false;
  }

  async speak(req: SpeakRequest & { onStart?: () => void }): Promise<void> {
    const voice = NEURAL_VOICES[req.accent][req.speaker ?? 'A'];
    const key = audioKey(voice, req.rate, req.text);
    let blob = await this.cache.get(key);
    if (!blob) {
      blob = await this.generate(req.text, voice, RATE_FACTOR[req.rate], req.signal);
      await this.cache.put(key, blob, { provider: this.id, voiceId: voice, text: req.text });
    }
    if (req.signal?.aborted) throw abortError();
    req.onStart?.();
    await this.playback.play(blob, req.signal);
  }

  private async generate(text: string, voice: string, speed: number, signal?: AbortSignal): Promise<Blob> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.config.timeoutMs ?? 8000);
    signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
    try {
      const res = await this.fetchFn(`${this.config.baseUrl.replace(/\/$/, '')}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.config.model ?? 'kokoro', input: text, voice, speed, response_format: 'mp3' }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`tts server ${res.status}`);
      this.healthy = true;
      return await res.blob();
    } catch (e) {
      if (signal?.aborted) throw abortError();
      this.healthy = false;
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  stop(): void {
    this.playback.stop();
  }

  async voices(): Promise<SpeechVoice[]> {
    return Object.entries(NEURAL_VOICES).flatMap(([accent, v]) =>
      Object.values(v).map((id) => ({ id, name: id, lang: accent, accent: accent as SpeechVoice['accent'], quality: 'neural' as const, provider: this.id, offline: false })),
    );
  }
}
