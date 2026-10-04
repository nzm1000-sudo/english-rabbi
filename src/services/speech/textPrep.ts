import type { Speaker } from './types';

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

/** How a question with a gap is read aloud: "She has worked here blank 2019." */
export function questionSpeech(prompt: string): string {
  return prompt.replace(/_{3,}/g, 'blank');
}

const SPEAKER_LABEL = /(?:^|\s+)([A-Z][A-Za-z']*(?: [A-Z][A-Za-z']*)?):\s+/g;

/**
 * A listening dialogue written as one string ("Dan: Are you coming? Maya: I
 * can't.") split into lines with alternating voices, so the names are not
 * read aloud and each person keeps one voice: the first person is A, the
 * second B, a third A again. Null when the text is not such a dialogue
 * (it must start with a label and have at least two different people).
 */
export function dialogueLines(text: string): { speaker: Speaker; text: string }[] | null {
  const clean = text.replace(/\s+/g, ' ').trim();
  const marks = [...clean.matchAll(SPEAKER_LABEL)];
  if (marks.length < 2 || marks[0]!.index !== 0) return null;
  const names = [...new Set(marks.map((m) => m[1]!))];
  if (names.length < 2) return null;
  const lines: { speaker: Speaker; text: string }[] = [];
  marks.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1]!.index! : clean.length;
    const line = clean.slice(start, end).trim();
    if (line) lines.push({ speaker: names.indexOf(m[1]!) % 2 === 0 ? 'A' : 'B', text: line });
  });
  return lines.length >= 2 ? lines : null;
}
