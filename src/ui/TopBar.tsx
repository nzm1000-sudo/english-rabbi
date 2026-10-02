import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from './icons';

export function TopBar({ title, back, end }: { title?: ReactNode; back?: string; end?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      {back !== undefined ? (
        <button className="icon-btn" onClick={() => nav(back)} aria-label="חזרה">
          <BackIcon />
        </button>
      ) : (
        <span style={{ width: 44 }} />
      )}
      {title ? <h1 className="grow" style={{ textAlign: 'center' }}>{title}</h1> : <span className="grow" />}
      {end ?? <span style={{ width: 44 }} />}
    </header>
  );
}
