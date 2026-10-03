import type { ReactNode } from 'react';

/**
 * Hebrew text that may contain English.
 * - Short English (1-3 words) stays inline, isolated as LTR so word order
 *   and punctuation stay correct.
 * - Longer English (a phrase or a sentence) gets its own LTR line. A Hebrew
 *   line that starts with an English sentence is hard to read in RTL.
 * - Parentheses stay balanced: "(much / many)" is one LTR run, but in
 *   "(o אחת)" the "(" belongs to the Hebrew, so it mirrors correctly.
 * - "=" after English never starts a line by itself.
 */
const LATIN_RUN = /(["(]?[A-Za-z][A-Za-z0-9'’\-+/=→ .,!?:;"()]*[A-Za-z0-9'’.!?")]|[A-Za-z])/g;
const BLOCK_WORDS = 4;

export type BidiPart = { kind: 'he' | 'en' | 'en-line'; text: string };

/**
 * Splits a Latin run at any parenthesis or quote without a partner inside the
 * run. The unmatched mark goes to the Hebrew side, so the browser mirrors it
 * with the Hebrew text it belongs to.
 */
function balance(run: string): { latin: boolean; text: string }[] {
  const stack: number[] = [];
  const lone = new Set<number>();
  let quote = -1;
  for (let i = 0; i < run.length; i++) {
    const ch = run[i];
    if (ch === '(') stack.push(i);
    else if (ch === ')') {
      if (stack.length) stack.pop();
      else lone.add(i);
    } else if (ch === '"') quote = quote < 0 ? i : -1;
  }
  stack.forEach((i) => lone.add(i));
  if (quote >= 0) lone.add(quote);
  if (!lone.size) return [{ latin: true, text: run }];
  const out: { latin: boolean; text: string }[] = [];
  let cur = '';
  const flush = () => {
    if (!cur) return;
    const m = cur.match(/^(\s*)(.*?)(\s*)$/s)!;
    if (m[1]) out.push({ latin: false, text: m[1] });
    if (m[2]) out.push({ latin: /[A-Za-z]/.test(m[2]), text: m[2] });
    if (m[3]) out.push({ latin: false, text: m[3] });
    cur = '';
  };
  for (let i = 0; i < run.length; i++) {
    if (lone.has(i)) {
      flush();
      out.push({ latin: false, text: run[i]! });
    } else cur += run[i];
  }
  flush();
  return out;
}

export function splitBidi(text: string): { latin: boolean; text: string }[] {
  const out: { latin: boolean; text: string }[] = [];
  const push = (latin: boolean, t: string) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev && prev.latin === latin) prev.text += t;
    else out.push({ latin, text: t });
  };
  let last = 0;
  for (const m of text.matchAll(LATIN_RUN)) {
    const i = m.index ?? 0;
    if (i > last) push(false, text.slice(last, i));
    for (const piece of balance(m[0])) push(piece.latin, piece.text);
    last = i + m[0].length;
  }
  if (last < text.length) push(false, text.slice(last));
  return out;
}

export function layoutBidi(text: string, inline = false): BidiPart[] {
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
    parts.push({ kind: !inline && words >= BLOCK_WORDS && sentenceLike ? 'en-line' : 'en', text: t });
  }
  // "ask a question = לשאול שאלה": after an English line the "=" ends that
  // line; after inline English it is glued so it never opens a line.
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i]!;
    const prev = parts[i - 1]!;
    if (p.kind !== 'he' || !/^\s*=/.test(p.text)) continue;
    if (prev.kind === 'en-line') {
      prev.text = `${prev.text} =`;
      p.text = p.text.replace(/^\s*=\s*/, '');
    } else if (prev.kind === 'en') {
      p.text = p.text.replace(/^\s*=/, '\u00a0=');
    }
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

/** Short English runs (a word or a pattern) never break across lines. */
const SHORT_EN = 22;

/**
 * Hebrew text with English inside. `inline` keeps every English run inside
 * the line (labels, titles); by default long English sentences get a line.
 */
export function He({ children, className, inline = false }: { children: string; className?: string; inline?: boolean }): ReactNode {
  return (
    <span className={`he ${className ?? ''}`.trim()} dir="rtl">
      {layoutBidi(children, inline).map((p, i) =>
        p.kind === 'he' ? (
          p.text
        ) : p.kind === 'en' ? (
          <bdi key={i} dir="ltr" lang="en" className={p.text.length <= SHORT_EN ? 'en wt' : 'en'}>
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
