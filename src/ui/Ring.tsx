import type { ReactNode } from 'react';

/** Circular progress. `onLight` uses the tone color instead of white. */
export function Ring({ value, size = 72, stroke = 7, onLight = false, children }: { value: number; size?: number; stroke?: number; onLight?: boolean; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`ring${onLight ? ' on-light' : ''}`} style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v * 100)}%`}>
      <svg width={size} height={size}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}
