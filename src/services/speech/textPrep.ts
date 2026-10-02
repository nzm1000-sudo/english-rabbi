/**
 * Splits text into sentence-sized chunks for engines that misbehave on long
 * utterances (Chrome stops after ~15s; iOS can drop long text). Splitting at
 * sentence boundaries keeps natural intonation inside each sentence.
 * Abbreviations like "Mr." and decimals like "3.5" are not split.
 */
const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|St|Prof|Sr|Jr|vs|etc|e\.g|i\.e)\.$/i;

export function splitSentences(text: string, maxLen = 220): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const raw = clean.split(/(?<=[.!?]["')\]]?)\s+(?=["'(]?[A-Z0-9])/);
  const merged: string[] = [];
  for (const r of raw) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && ABBREV.test(prev)) merged[merged.length - 1] = `${prev} ${r}`;
    else merged.push(r);
  }
  return merged.flatMap((p) => (p.length > maxLen ? splitLong(p, maxLen) : [p]));
}

function splitLong(s: string, maxLen: number): string[] {
  const out: string[] = [];
  let buf = '';
  for (const piece of s.split(/(?<=[,;:])\s+/)) {
    if ((buf + ' ' + piece).trim().length > maxLen && buf) {
      out.push(buf.trim());
      buf = piece;
    } else buf = `${buf} ${piece}`.trim();
  }
  if (buf) out.push(buf);
  return out;
}

/** Canonical text form used for cache keys. */
export function canonicalSpeechText(text: string): string {
  return text.normalize('NFC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}
