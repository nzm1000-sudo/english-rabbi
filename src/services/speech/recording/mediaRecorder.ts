import type { Recorder, RecordingResult } from './types';

/**
 * Records the microphone with MediaRecorder. The audio stays in memory on
 * this device: nothing is uploaded or stored.
 */
export class MediaRecorderRecorder implements Recorder {
  private rec: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  async start(signal?: AbortSignal): Promise<void> {
    this.release();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    if (signal?.aborted) {
      this.release();
      throw new DOMException('stopped', 'AbortError');
    }
    // Safari records audio/mp4, Chrome audio/webm. Let the browser choose.
    this.rec = new MediaRecorder(this.stream);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start();
    this.startedAt = Date.now();
    signal?.addEventListener('abort', () => this.release(), { once: true });
  }

  stop(): Promise<RecordingResult> {
    const rec = this.rec;
    if (!rec || rec.state === 'inactive') return Promise.reject(new Error('not recording'));
    return new Promise((resolve) => {
      rec.onstop = () => {
        const mimeType = rec.mimeType || 'audio/mp4';
        const blob = new Blob(this.chunks, { type: mimeType });
        const durationMs = Date.now() - this.startedAt;
        this.release();
        resolve({ blob, mimeType, durationMs });
      };
      rec.stop();
    });
  }

  /** Stops the microphone so the browser's recording indicator turns off. */
  release(): void {
    if (this.rec && this.rec.state !== 'inactive') {
      this.rec.onstop = null;
      this.rec.stop();
    }
    this.rec = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
