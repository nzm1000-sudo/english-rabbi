/** Speech-to-text (future stage). Implementations: on-device, home server (e.g. Whisper). */
export interface RecognitionResult {
  transcript: string;
  confidence: number;
  words?: { text: string; startMs: number; endMs: number; confidence: number }[];
}

export interface SpeechRecognizer {
  readonly id: string;
  readonly runsOnDevice: boolean;
  recognize(audio: Blob, opts: { lang: string; expectedText?: string }): Promise<RecognitionResult>;
}
