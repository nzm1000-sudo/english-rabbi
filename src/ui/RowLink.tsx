import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Art } from './Art';
import type { ArtName } from './art';
import { ChevronIcon } from './icons';

/** A list row with a 3D illustration (or its orb), title, one line, chevron. */
export function RowLink({ to, art, tone, icon, title, sub, subNode }: { to: string; art: ArtName; tone: string; icon: ReactNode; title: string; sub?: string; subNode?: ReactNode }) {
  return (
    <Link to={to} className="list-item">
      <Art name={art} size={44} tone={tone} fallback={icon} />
      <span className="grow stack gap-0">
        <strong>{title}</strong>
        {subNode ?? (sub && <span className="small muted clamp-1">{sub}</span>)}
      </span>
      <span className="chev">
        <ChevronIcon />
      </span>
    </Link>
  );
}

