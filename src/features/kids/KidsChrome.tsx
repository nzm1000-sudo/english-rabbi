import { useId, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HomeIcon, SunIcon } from './KidIcons';
import { mascotPic } from './pics';

/** Topic tile tints (tokens.css --k-*). Labels always stay --k-ink. */
export type Tint = 'sky' | 'mint' | 'peach' | 'butter' | 'lilac' | 'rose';

/** Symmetric kids header: 64 | title | 64. Both side slots always render. */
export function KidsTopBar({ start, title, end }: { start?: ReactNode; title?: ReactNode; end?: ReactNode }) {
  return (
    <header className="k-top">
      <div className="k-top-slot">{start}</div>
      {title ? <h1 className="k-top-title">{title}</h1> : <div />}
      <div className="k-top-slot">{end}</div>
    </header>
  );
}

/** Round 64px icon link (home, back to the shelf). */
export function KidsIconLink({ to, label, children }: { to: string; label: string; children?: ReactNode }) {
  return (
    <Link to={to} className="k-icon-btn" aria-label={label}>
      {children ?? <HomeIcon />}
    </Link>
  );
}

/** Round progress ring with a sun in the middle: how far into the round. */
export function ProgressRing({ value, total }: { value: number; total: number }) {
  const size = 64;
  const stroke = 7;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const v = total ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <div className="k-ring" role="img" aria-label={`${value} מתוך ${total}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="k-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="k-ring-value" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      <SunIcon size={28} />
    </div>
  );
}

/** The owl mascot (a friendly owl holding a book), with a gentle idle bob. */
export function Owl({ size = 96, bob = true }: { size?: number; bob?: boolean }) {
  const src = mascotPic('owl');
  if (!src) return null;
  return <img className={`k-owl${bob ? ' bob' : ''}`} src={src} alt="" width={size} height={size} draggable={false} style={{ '--owl': `${size}px` } as CSSProperties} />;
}

/** The owl saying something, in a speech bubble that points at it. */
export function OwlSays({ title, line, size = 96 }: { title: ReactNode; line?: ReactNode; size?: number }) {
  return (
    <div className="k-owl-says">
      <Owl size={size} />
      <div className="k-bubble">
        <strong className="k-bubble-title">{title}</strong>
        {line && <span className="k-bubble-line">{line}</span>}
      </div>
    </div>
  );
}

/** Art for a tile: a 3D picture in a framed squircle, or drawn art. */
export function TileArt({ src, children }: { src?: string | undefined; children?: ReactNode }) {
  if (src) return <img className="k-tile-pic" src={src} alt="" width={240} height={240} draggable={false} decoding="async" />;
  return <span className="k-tile-pic art">{children}</span>;
}

/** Toy blocks with letters or digits ("ABC", "123"), drawn when there is no picture. */
export function Blocks({ text }: { text: string }) {
  return (
    <span className="k-blocks" dir="ltr" aria-hidden="true">
      {[...text].map((ch, i) => (
        <span key={i} className={`k-block b${i % 3}`}>
          {ch}
        </span>
      ))}
    </span>
  );
}

/** Memory art: two face-down cards and one face-up picture. */
export function MemoryArt({ src }: { src?: string | undefined }) {
  return (
    <span className="k-memory-art" aria-hidden="true">
      <span className="k-mini-card back a">
        <CardBack />
      </span>
      <span className="k-mini-card front b">{src ? <img src={src} alt="" draggable={false} /> : null}</span>
    </span>
  );
}

/** The designed back of a memory card: a warm pattern with a sun badge. */
export function CardBack() {
  const id = `k${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className="k-card-back" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`${id}d`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx="7" cy="7" r="2.1" fill="rgb(255 255 255 / 0.22)" />
        </pattern>
        <radialGradient id={`${id}g`} cx="0.5" cy="0.38" r="0.75">
          <stop offset="0" stopColor="#FB923C" />
          <stop offset="1" stopColor="#C2410C" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}g)`} />
      <rect width="100" height="100" fill={`url(#${id}d)`} />
      <rect x="7" y="7" width="86" height="86" rx="14" fill="none" stroke="rgb(255 248 238 / 0.55)" strokeWidth="2.5" strokeDasharray="1 6" strokeLinecap="round" />
      <circle cx="50" cy="50" r="19" fill="#FFF8EE" />
      <g stroke="#B45309" strokeWidth="3" strokeLinecap="round">
        <path d="M50 37v3M50 60v3M37 50h3M60 50h3M40.8 40.8l2.1 2.1M57.1 57.1l2.1 2.1M40.8 59.2l2.1-2.1M57.1 42.9l2.1-2.1" />
      </g>
      <circle cx="50" cy="50" r="6.5" fill="#F59E0B" stroke="#B45309" strokeWidth="2.2" />
    </svg>
  );
}

/** A tile on the kids home: square, tinted, picture on top, one-line label. `feature` = wide row tile. */
export function KidTile({
  to,
  label,
  tint,
  art,
  badge,
  feature = false,
  onTap,
}: {
  to: string;
  label: string;
  tint: Tint;
  art: ReactNode;
  badge?: ReactNode;
  feature?: boolean;
  onTap?: () => void;
}) {
  return (
    <Link to={to} className={`k-tile${feature ? ' feature' : ''}`} data-tint={tint} onClick={onTap}>
      <span className="k-tile-art">{art}</span>
      <span className="k-tile-label">{label}</span>
      {badge !== undefined && <span className="k-badge">{badge}</span>}
    </Link>
  );
}

/** A grid of tiles; an odd last tile spans both columns as a wide feature tile. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="k-grid">{children}</div>;
}

/** Empty or finished state: the owl, a title, one line, one action. */
export function KidsMessage({ title, line, action, owl = true }: { title: string; line?: string; action?: ReactNode; owl?: boolean }) {
  return (
    <div className="k-message">
      {owl && <Owl size={136} />}
      <h2 className="k-message-title">{title}</h2>
      {line && <p className="k-message-line">{line}</p>}
      {action}
    </div>
  );
}
