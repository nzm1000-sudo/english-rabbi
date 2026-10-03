import { levenshtein, normalizeAnswer } from './answerCheck';

export type WordStatus = 'ok' | 'close' | 'wrong' | 'missed';

export interface ReadingResult {
  words: { text: string; status: WordStatus; heard?: string }[];
  /** Share of target words read right (close counts half). */
  score: number;
}

const NUMBERS: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', '11': 'eleven', '12': 'twelve',
};

function norm(w: string): string {
  const n = normalizeAnswer(w).replace(/[^\p{L}\p{N}' ]/gu, '').replace(/'s$/, '');
  return NUMBERS[n] ?? n;
}

function similar(a: string, b: string): 'ok' | 'close' | 'wrong' {
  if (a === b) return 'ok';
  if (a.length >= 4 && levenshtein(a, b) <= 1) return 'close';
  return 'wrong';
}

/**
 * Compares what the learner read with the sentence. Words are aligned with an
 * edit distance, so one skipped or extra word does not shift the rest.
 * Transcription tends to "hear" a real word, so this checks reading, not accent.
 */
export function compareReading(target: string, heard: string): ReadingResult {
  const shown = target.split(/\s+/).filter(Boolean);
  const t = shown.flatMap((w) => norm(w).split(' ').filter(Boolean).map((n) => ({ shown: w, n })));
  const h = heard.split(/\s+/).map(norm).flatMap((w) => w.split(' ')).filter(Boolean);
  const n = t.length;
  const m = h.length;
  const cost = (i: number, j: number) => (similar(t[i]!.n, h[j]!) === 'wrong' ? 1 : similar(t[i]!.n, h[j]!) === 'close' ? 0.4 : 0);
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j * 0.7 : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i]![j] = Math.min(d[i - 1]![j - 1]! + cost(i - 1, j - 1), d[i - 1]![j]! + 1, d[i]![j - 1]! + 0.7);
    }
  }
  // Walk back to label every target word.
  const status: { status: WordStatus; heard?: string }[] = new Array(n);
  let i = n;
  let j = m;
  while (i > 0) {
    if (j > 0 && Math.abs(d[i]![j]! - (d[i - 1]![j - 1]! + cost(i - 1, j - 1))) < 1e-9) {
      const s = similar(t[i - 1]!.n, h[j - 1]!);
      status[i - 1] = { status: s, ...(s !== 'ok' ? { heard: h[j - 1]! } : {}) };
      i--;
      j--;
    } else if (Math.abs(d[i]![j]! - (d[i - 1]![j]! + 1)) < 1e-9) {
      status[i - 1] = { status: 'missed' };
      i--;
    } else j--;
  }
  // Back to the words as shown (a contraction may have expanded to two).
  const words: ReadingResult['words'] = [];
  let k = 0;
  for (const w of shown) {
    const parts = norm(w).split(' ').filter(Boolean).length;
    const st = status.slice(k, k + parts);
    k += parts;
    if (!parts) continue;
    const worst = st.find((s) => s.status === 'missed') ?? st.find((s) => s.status === 'wrong') ?? st.find((s) => s.status === 'close') ?? st[0]!;
    words.push({ text: w, status: worst.status, ...(worst.heard ? { heard: worst.heard } : {}) });
  }
  const pts = words.reduce((s, w) => s + (w.status === 'ok' ? 1 : w.status === 'close' ? 0.5 : 0), 0);
  return { words, score: words.length ? pts / words.length : 0 };
}
