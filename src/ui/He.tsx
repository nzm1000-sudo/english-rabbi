import type { ReactNode } from 'react';

/**
 * Hebrew text that may contain English words or sentences. Each Latin run is
 * isolated as LTR, so punctuation and word order stay correct in RTL.
 */
const LATIN_RUN = /(["(]?[A-Za-z][A-Za-z0-9'’\-+/=→ .,!?:;"()]*[A-Za-z0-9'’.!?")]|[A-Za-z])/g;

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

export function He({ children, className }: { children: string; className?: string }): ReactNode {
  return (
    <span className={className} dir="rtl">
      {splitBidi(children).map((p, i) =>
        p.latin ? (
          <bdi key={i} dir="ltr" lang="en" className="en">
            {p.text}
          </bdi>
        ) : (
          p.text
        ),
      )}
    </span>
  );
}
