import { audioKey } from './audioKey';
import type { AudioPlayback } from './playback/audioPlayer';
import { isAbort } from './types';

/**
 * Short spoken Hebrew for children who cannot read yet ("איפה?", "כל הכבוד!").
 * Plays a natural Hebrew recording made ahead of time (tools/tts-prerender/
 * hebrew.mjs). A phrase that was not recorded uses the phone's own Hebrew
 * voice. Nothing is sent anywhere.
 */

// Keep in sync with tools/tts-prerender/hebrew.mjs. Gemini recordings: a
// female voice for the game guide, a male one for names (the tool picks).
export const HEBREW_VOICE = 'gemini-he-1';
// The older Microsoft recordings, played when a Gemini one is missing.
export const HEBREW_FALLBACK_VOICE = 'he-IL-AvriNeural';
const MANIFEST_URL = 'audio/he/manifest.json';

let playback: AudioPlayback | null = null;
let manifest: Promise<Record<string, string>> | null = null;
let current: AbortController | null = null;

/** Uses the app's audio element, so it plays on iPhone after the first tap. */
export function setHebrewPlayback(p: AudioPlayback): void {
  playback = p;
}

function entries(): Promise<Record<string, string>> {
  manifest ??= fetch(MANIFEST_URL)
    .then((r) => (r.ok ? (r.json() as Promise<{ entries: Record<string, string> }>) : { entries: {} }))
    .then((m) => m.entries ?? {})
    .catch(() => {
      manifest = null;
      return {};
    });
  return manifest;
}

/** Speaks Hebrew and resolves when done. Never rejects. */
export async function speakHebrew(text: string): Promise<void> {
  stopHebrew();
  const ctrl = (current = new AbortController());
  const all = playback ? await entries() : {};
  const url = all[audioKey(HEBREW_VOICE, 'normal', text)] ?? all[audioKey(HEBREW_FALLBACK_VOICE, 'normal', text)];
  if (ctrl.signal.aborted) return;
  if (url && playback) {
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`audio ${res.status}`);
      const blob = await res.blob();
      if (ctrl.signal.aborted) return;
      await playback.play(blob, ctrl.signal);
      return;
    } catch (e) {
      // Stopped, or another sound took over: stay quiet.
      if (ctrl.signal.aborted || isAbort(e)) return;
      // A broken file: fall back to the phone's voice below.
    }
  }
  return deviceVoice(text);
}

export function stopHebrew(): void {
  if (current) {
    current.abort();
    current = null;
  }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

let cached: SpeechSynthesisVoice | null | undefined;

function hebrewVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  if (cached !== undefined && cached !== null) return cached;
  const voices = speechSynthesis.getVoices();
  cached = voices.find((v) => v.lang.toLowerCase().startsWith('he')) ?? voices.find((v) => v.lang.toLowerCase().startsWith('iw')) ?? null;
  return cached;
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    cached = undefined;
  });
}

function deviceVoice(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL';
    const v = hebrewVoice();
    if (v) u.voice = v;
    u.rate = 0.95;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    // Safety net: some browsers never fire onend.
    setTimeout(resolve, 600 + text.length * 120);
  });
}
