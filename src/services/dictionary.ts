import type { Sense } from '@content/dictionary';

let loaded: Promise<Record<string, Sense[]>> | null = null;

/** Loads the dictionary once (a separate chunk, also available offline). */
export function loadDictionary(): Promise<Record<string, Sense[]>> {
  loaded ??= import('@content/dictionary').then((m) => m.dictionary);
  return loaded;
}

/** Lowercase lookup key of a token: no surrounding punctuation, straight apostrophes. */
export function wordKey(token: string): string {
  return token
    .replace(/[‘’]/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .toLowerCase();
}

/** Senses for a word, trying simple base forms when the exact form is missing. */
export function lookup(dict: Record<string, Sense[]>, word: string): Sense[] | undefined {
  const w = wordKey(word);
  if (!w) return undefined;
  const tries = [
    w,
    w.endsWith("'s") ? w.slice(0, -2) : '',
    w.replace(/ies$/, 'y'),
    w.replace(/es$/, ''),
    w.replace(/s$/, ''),
    w.replace(/ed$/, ''),
    w.replace(/ed$/, 'e'),
    w.replace(/ing$/, ''),
    w.replace(/ing$/, 'e'),
    w.replace(/ly$/, ''),
  ];
  for (const t of tries) if (t && dict[t]) return dict[t];
  if (w === 'a.m' || w === 'p.m') return [{ lemma: `${w}.`, he: w === 'a.m' ? 'לפני הצהריים' : 'אחרי הצהריים' }];
  // Hyphenated words ("car-free", "ten-kilometre"): the meaning of each part.
  if (w.includes('-')) {
    const parts = w.split('-').map((p) => lookup(dict, p)?.[0]);
    if (parts.every(Boolean)) return [{ lemma: w, he: parts.map((p) => p!.he).join(' + ') }];
  }
  return undefined;
}
