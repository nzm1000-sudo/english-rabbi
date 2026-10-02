import type { ReactNode } from 'react';

/**
 * Hebrew text that may contain English.
 * - Short English (1-3 words) stays inline, isolated as LTR so word order
 *   and punctuation stay correct.
 * - Longer English (a phrase or a sentence) gets its own LTR line. A Hebrew
 *   line that starts with an English sentence is hard to read in RTL.
 */
const LATIN_RUN = /(["(]?[A-Za-z][A-Za-z0-9'’\-+/=→ .,!?:;"()]*[A-Za-z0-9'’.!?")]|[A-Za-z])/g;
const BLOCK_WORDS = 4;

export type BidiPart = { kind: 'he' | 'en' | 'en-line'; text: string };

export function splitBidi(text: string): { latin: boolean; text: string }[] {
  const out: { latin: boolean; text: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(LATIN_RUN)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ latin: false, text: text.slice(last, i) });
    out.push({ latin: true, text: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ latin: false, text: text.slice(last) });
  return out;
}

export function layoutBidi(text: string): BidiPart[] {
  const parts: BidiPart[] = [];
  for (const p of splitBidi(text)) {
    if (!p.latin) {
      parts.push({ kind: 'he', text: p.text });
      continue;
    }
    const t = p.text.trim();
    // Real words only: "he / she / it" is three words, not five.
    const words = t.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    // Its own line only when it reads as a sentence, not as a list inside a Hebrew sentence.
    const sentenceLike = /^["(]?[A-Z]/.test(t) || /[.!?]["')]?$/.test(t);
    parts.push({ kind: words >= BLOCK_WORDS && sentenceLike ? 'en-line' : 'en', text: t });
  }
  // Hebrew fragments next to an English line lose their edge spaces;
  // fragments that are only punctuation or spaces are dropped.
  return parts
    .map((p, i) => {
      if (p.kind !== 'he') return p;
      const prevLine = parts[i - 1]?.kind === 'en-line';
      const nextLine = parts[i + 1]?.kind === 'en-line';
      let t = p.text;
      if (prevLine) t = t.replace(/^[\s.,;:]+/, '');
      if (nextLine) t = t.replace(/\s+$/, '');
      return { ...p, text: t };
    })
    .filter((p) => p.kind !== 'he' || /[^\s.,;:]/.test(p.text));
}

export function He({ children, className }: { children: string; className?: string }): ReactNode {
  return (
    <span className={`he ${className ?? ''}`.trim()} dir="rtl">
      {layoutBidi(children).map((p, i) =>
        p.kind === 'he' ? (
          p.text
        ) : p.kind === 'en' ? (
          <bdi key={i} dir="ltr" lang="en" className="en">
            {p.text}
          </bdi>
        ) : (
          <span key={i} dir="ltr" lang="en" className="en en-line">
            {p.text}
          </span>
        ),
      )}
    </span>
  );
}
