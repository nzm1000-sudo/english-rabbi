/**
 * Deterministic cache key for generated audio. Shared by the app and by the
 * offline pre-render tool (tools/tts-prerender), so it must stay dependency
 * free. Changing it invalidates all cached audio.
 */
export function audioKey(voice: string, rate: string, text: string): string {
  const input = `${voice}|${rate}|${text.normalize('NFC').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()}`;
  return fnv1a(input, 0x811c9dc5) + fnv1a(input, 0x01000193 ^ 0x5bd1e995);
}

function fnv1a(s: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
