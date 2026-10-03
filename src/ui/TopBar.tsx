import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from './icons';

/**
 * Screen header with three symmetric slots: start (back), centered title, end.
 * Both side slots always render at the same width, so the title stays centered
 * whatever sits beside it. `wide` makes both side slots 64px (timers, counters).
 */
export function TopBar({
  title,
  center,
  back,
  start,
  end,
  wide = false,
  label,
}: {
  title?: ReactNode;
  /** Non-heading content for the middle slot (e.g. a progress bar). */
  center?: ReactNode;
  back?: string;
  /** Replaces the back button. */
  start?: ReactNode;
  end?: ReactNode;
  wide?: boolean;
  /** Accessible name for the header when there is no title. */
  label?: string;
}) {
  const nav = useNavigate();
  return (
    <header className={`topbar${wide ? ' wide' : ''}`} aria-label={label}>
      <div className="topbar-slot">
        {start ??
          (back !== undefined && (
            <button className="icon-btn" onClick={() => nav(back)} aria-label="חזרה">
              <BackIcon />
            </button>
          ))}
      </div>
      {title !== undefined ? <h1 className="topbar-title">{title}</h1> : <div className="topbar-center">{center}</div>}
      <div className="topbar-slot end">{end}</div>
    </header>
  );
}
