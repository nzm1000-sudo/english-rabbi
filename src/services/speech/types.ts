import type { Accent, SpeechRate } from '@/domain/student/student';

/**
 * Speech layer contracts.
 *
 * The speech stack is split into independent parts so each can be replaced
 * without touching the others or the learning engine:
 *
 *   tts/            text -> speech (SpeechProvider implementations)
 *   playback/       plays audio blobs/urls, one at a time
 *   recording/      microphone capture (future)
 *   recognition/    speech -> text (future)
 *   pronunciation/  compares a recording with a model (future)
 *
 * Privacy: TTS only sends English learning text, never learner data.
 * Recording, recognition and pronunciation handle the child's voice and must
 * stay on-device or on the home server unless the parent explicitly approves.
 */
export type { Accent, SpeechRate };

export type VoiceQuality = 'neural' | 'premium' | 'enhanced' | 'standard' | 'novelty' | 'unknown';

/** Dialogue role. A and B get two distinct, consistent voices. */
export type Speaker = 'A' | 'B';

export interface SpeechVoice {
  id: string;
  name: string;
  lang: string;
  accent: Accent | 'other';
  quality: VoiceQuality;
  provider: string;
  offline: boolean;
}

export interface SpeakRequest {
  text: string;
  accent: Accent;
  rate: SpeechRate;
  speaker?: Speaker;
  /** Explicit voice choice (from the voice lab). Providers may ignore unknown ids. */
  voiceId?: string;
  signal?: AbortSignal;
}

export interface SpeechProvider {
  readonly id: string;
  readonly label: string;
  /** Cheap check: can this provider handle this exact request right now? */
  canSpeak(req: SpeakRequest): Promise<boolean>;
  /** Resolves when playback ends. Rejects with AbortError when stopped. */
  speak(req: SpeakRequest): Promise<void>;
  stop(): void;
  voices(): Promise<SpeechVoice[]>;
}

export function abortError(): DOMException {
  return new DOMException('speech stopped', 'AbortError');
}

export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
