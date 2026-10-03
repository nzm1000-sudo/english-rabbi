import { useEffect, useState, type ReactNode } from 'react';

/**
 * Circular progress. Fills from empty on first show (instantly with reduced
 * motion, through the CSS transition). `onLight` uses the tone color.
 */
export function Ring({
  value,
  size = 72,
  stroke = 7,
  onLight = false,
  className = '',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  onLight?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(v));
    return () => cancelAnimationFrame(t);
  }, [v]);
  return (
    <div className={`ring${onLight ? ' on-light' : ''} ${className}`.trim()} style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v * 100)}%`}>
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
          strokeDashoffset={c * (1 - shown)}
          opacity={shown > 0 ? 1 : 0}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}
