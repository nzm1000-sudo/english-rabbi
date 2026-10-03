import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * A button a small child will not press by accident: it must be held for
 * 1.5 seconds. Used to leave the little children's area.
 */
export function HoldButton({ onDone, label, children, wide = false }: { onDone: () => void; label: string; children: ReactNode; wide?: boolean }) {
  const [p, setP] = useState(0);
  const timer = useRef<number | null>(null);
  const start = useRef(0);

  const stop = () => {
    if (timer.current) cancelAnimationFrame(timer.current);
    timer.current = null;
    setP(0);
  };
  const tick = () => {
    const v = Math.min(1, (performance.now() - start.current) / 1500);
    setP(v);
    if (v >= 1) {
      stop();
      onDone();
    } else timer.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => stop(), []);

  return (
    <button
      type="button"
      className={`hold-btn${wide ? ' wide' : ''}`}
      aria-label={label}
      title="להחזיק לחוץ"
      onPointerDown={(e) => {
        e.preventDefault();
        start.current = performance.now();
        timer.current = requestAnimationFrame(tick);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      style={{ '--hold': `${Math.round(p * 360)}deg` } as CSSProperties}
    >
      {children}
    </button>
  );
}
