/**
 * Short spoken Hebrew instructions for children who cannot read yet
 * ("איפה?", "כל הכבוד!"), with the phone's own Hebrew voice (on iPhone,
 * Carmit). Nothing is downloaded or sent anywhere. If the phone has no
 * Hebrew voice, it stays silent and the picture and English word still work.
 */
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

/** Speaks Hebrew and resolves when done (or at once when there is no voice). */
export function speakHebrew(text: string): Promise<void> {
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

export function stopHebrew(): void {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
