import { useMemo, type CSSProperties } from 'react';

const COLORS = ['#5b3df5', '#b81e6a', '#f59f00', '#0a6fb8', '#1e7f34', '#9c36b5', '#ff922b'];

/** Lightweight CSS confetti. Hidden when the user prefers reduced motion. */
export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const left = (i * 37) % 100;
        return {
          left: `${left}%`,
          background: COLORS[i % COLORS.length],
          '--x': `${((i * 53) % 120) - 60}px`,
          '--r': `${360 + ((i * 97) % 540)}deg`,
          '--d': `${1.6 + ((i * 13) % 12) / 10}s`,
          '--delay': `${((i * 7) % 10) / 20}s`,
          width: i % 3 === 0 ? 7 : 10,
          height: i % 2 === 0 ? 14 : 9,
        } as CSSProperties;
      }),
    [pieces],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {items.map((s, i) => (
        <i key={i} style={s} />
      ))}
    </div>
  );
}
