import { abortError, type SpeakRequest, type SpeechProvider, type SpeechVoice } from '../types';
import { splitSentences } from '../textPrep';
import { accentOf, inferQuality, rankVoices } from './voiceRanking';

/**
 * Built-in device voices through the Web Speech API. Always available
 * offline, zero cost. Quality depends on the device: on iPhone, Safari
 * exposes only the pre-installed voices, not downloaded Enhanced/Premium ones.
 * Used as the universal fallback.
 */
const RATE: Record<SpeakRequest['rate'], number> = { slower: 0.65, slow: 0.8, normal: 1, fast: 1.15 };

export class WebSpeechProvider implements SpeechProvider {
  readonly id = 'web-speech';
  readonly label = 'קול מובנה במכשיר';
  private cached: SpeechVoice[] | null = null;
  private native = new Map<string, SpeechSynthesisVoice>();

  constructor(
    private readonly synth: SpeechSynthesis | undefined = globalThis.speechSynthesis,
    private readonly Utterance: typeof SpeechSynthesisUtterance | undefined = globalThis.SpeechSynthesisUtterance,
  ) {}

  async voices(): Promise<SpeechVoice[]> {
    if (!this.synth) return [];
    if (this.cached?.length) return this.cached;
    let list = this.synth.getVoices();
    if (!list.length) {
      // Voices load asynchronously on most browsers.
      list = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
        const t = setTimeout(() => resolve(this.synth!.getVoices()), 1200);
        this.synth!.addEventListener?.('voiceschanged', () => {
          clearTimeout(t);
          resolve(this.synth!.getVoices());
        }, { once: true });
      });
    }
    this.native = new Map(list.map((v) => [v.voiceURI, v]));
    this.cached = list.map((v) => ({
      id: v.voiceURI,
      name: v.name,
      lang: v.lang,
      accent: accentOf(v.lang),
      quality: inferQuality(v.name),
      provider: this.id,
      offline: v.localService,
    }));
    return this.cached;
  }

  async canSpeak(): Promise<boolean> {
    return !!this.synth && !!this.Utterance;
  }

  async pickVoice(req: SpeakRequest): Promise<SpeechSynthesisVoice | undefined> {
    const all = await this.voices();
    if (req.voiceId && this.native.has(req.voiceId)) {
      const chosen = this.native.get(req.voiceId)!;
      if (req.speaker !== 'B') return chosen;
    }
    const ranked = rankVoices(all, req.accent).filter((v) => v.accent === req.accent);
    const pool = ranked.length ? ranked : rankVoices(all, req.accent);
    // Speaker B: the best voice that differs from speaker A's.
    const first = req.voiceId && this.native.has(req.voiceId) ? all.find((v) => v.id === req.voiceId) : pool[0];
    const pick = req.speaker === 'B' ? (pool.find((v) => v.id !== first?.id) ?? first) : first;
    return pick ? this.native.get(pick.id) : undefined;
  }

  async speak(req: SpeakRequest & { onStart?: () => void }): Promise<void> {
    const synth = this.synth;
    const U = this.Utterance;
    if (!synth || !U) throw new Error('speech synthesis unavailable');
    if (req.signal?.aborted) throw abortError();
    const voice = await this.pickVoice(req);
    if (synth.speaking || synth.pending) {
      synth.cancel();
      // iOS drops an utterance queued in the same tick as cancel().
      await new Promise((r) => setTimeout(r, 60));
    }
    const chunks = splitSentences(req.text);
    let started = false;
    for (const chunk of chunks) {
      if (req.signal?.aborted) throw abortError();
      await new Promise<void>((resolve, reject) => {
        const u = new U(chunk);
        u.lang = voice?.lang ?? req.accent;
        if (voice) u.voice = voice;
        u.rate = RATE[req.rate];
        u.pitch = 1;
        const onAbort = () => {
          synth.cancel();
          reject(abortError());
        };
        u.onstart = () => {
          if (!started) {
            started = true;
            req.onStart?.();
          }
        };
        u.onend = () => {
          req.signal?.removeEventListener('abort', onAbort);
          resolve();
        };
        u.onerror = (e) => {
          req.signal?.removeEventListener('abort', onAbort);
          if (e.error === 'interrupted' || e.error === 'canceled') reject(abortError());
          else reject(new Error(`speech error: ${e.error}`));
        };
        req.signal?.addEventListener('abort', onAbort, { once: true });
        synth.speak(u);
      });
    }
  }

  stop(): void {
    this.synth?.cancel();
  }
}
