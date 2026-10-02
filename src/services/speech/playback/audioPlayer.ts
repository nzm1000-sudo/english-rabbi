import { abortError } from '../types';

/**
 * Plays one audio source at a time. Starting a new one stops the previous
 * one cleanly. Independent of how the audio was produced.
 */
export interface AudioPlayback {
  play(src: Blob | string, signal?: AbortSignal): Promise<void>;
  stop(): void;
}

export class HtmlAudioPlayback implements AudioPlayback {
  private el: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private rejectCurrent: ((e: unknown) => void) | null = null;

  play(src: Blob | string, signal?: AbortSignal): Promise<void> {
    this.stop();
    const url = typeof src === 'string' ? src : (this.objectUrl = URL.createObjectURL(src));
    const el = (this.el ??= new Audio());
    el.preload = 'auto';
    el.src = url;
    return new Promise<void>((resolve, reject) => {
      this.rejectCurrent = reject;
      const done = () => {
        cleanup();
        resolve();
      };
      const fail = () => {
        cleanup();
        reject(new Error(`audio playback failed: ${el.error?.message ?? 'unknown'}`));
      };
      const abort = () => {
        cleanup();
        this.stop();
        reject(abortError());
      };
      const cleanup = () => {
        el.removeEventListener('ended', done);
        el.removeEventListener('error', fail);
        signal?.removeEventListener('abort', abort);
        this.rejectCurrent = null;
      };
      el.addEventListener('ended', done);
      el.addEventListener('error', fail);
      signal?.addEventListener('abort', abort);
      el.play().catch((e) => {
        cleanup();
        reject(e);
      });
    });
  }

  stop(): void {
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute('src');
      this.el.load();
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    const r = this.rejectCurrent;
    this.rejectCurrent = null;
    r?.(abortError());
  }
}
