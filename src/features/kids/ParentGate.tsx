import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const HOLD_MS = 1500;

/**
 * A button a small child will not press by accident: it must be held for
 * 1.5 seconds. A ring around it fills while it is held, so a parent can see
 * what is happening. Used to leave the children's area and to add time.
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
    const v = Math.min(1, (performance.now() - start.current) / HOLD_MS);
    setP(v);
    if (v >= 1) {
      stop();
      onDone();
    } else timer.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => stop(), []);

  const r = 29;
  const c = 2 * Math.PI * r;
  return (
    <button
      type="button"
      className={`hold-btn${wide ? ' wide' : ''}`}
      aria-label={label}
      title="להחזיק לחוץ"
      data-holding={p > 0}
      onPointerDown={(e) => {
        e.preventDefault();
        start.current = performance.now();
        timer.current = requestAnimationFrame(tick);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      style={{ '--hold-p': p } as CSSProperties}
    >
      {!wide && (
        <svg className="hold-ring" viewBox="0 0 64 64" aria-hidden="true">
          <circle className="hold-track" cx="32" cy="32" r={r} />
          <circle className="hold-value" cx="32" cy="32" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
        </svg>
      )}
      <span className="hold-face">{children}</span>
    </button>
  );
}
