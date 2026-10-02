/**
 * Microphone recording (future stage).
 * Recordings of the child's voice stay on the device unless a parent
 * explicitly approves sending them somewhere (e.g. the home server).
 */
export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface Recorder {
  isSupported(): boolean;
  /** Asks for microphone permission if needed. */
  start(signal?: AbortSignal): Promise<void>;
  stop(): Promise<RecordingResult>;
}
