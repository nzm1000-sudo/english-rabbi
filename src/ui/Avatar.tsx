import type { CSSProperties } from 'react';

export function Avatar({ name, hue, size = 44 }: { name: string; hue: number; size?: number }) {
  const style = { '--hue': hue, width: size, height: size } as CSSProperties;
  return (
    <span className="avatar" style={style} aria-hidden="true">
      {initial(name)}
    </span>
  );
}

/** First visible character. An emoji or accented letter is several code units; charAt(0) would cut it in half. */
export function initial(name: string): string {
  const n = name.trim();
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) return new Seg(undefined, { granularity: 'grapheme' }).segment(n)[Symbol.iterator]().next().value?.segment ?? '';
  return Array.from(n)[0] ?? '';
}
