/**
 * Chunky, rounded icons for the children's area. One 24px grid, one 2.5px
 * stroke, round caps and joins, currentColor. Decorative (aria-hidden): the
 * button around each icon carries the Hebrew label.
 */
type P = { size?: number };
const svg = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
});

export const HomeIcon = ({ size = 32 }: P) => (
  <svg {...svg(size)}>
    <path d="M3.5 11.2 12 4l8.5 7.2" />
    <path d="M6 9.6V19a1.5 1.5 0 0 0 1.5 1.5H10v-5.5h4v5.5h2.5A1.5 1.5 0 0 0 18 19V9.6" />
  </svg>
);

export const DoorIcon = ({ size = 30 }: P) => (
  <svg {...svg(size)}>
    <path d="M6 20.5V5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 5v15.5" />
    <path d="M3.5 20.5h17" />
    <circle cx="14.6" cy="12.4" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

export const LockIcon = ({ size = 28 }: P) => (
  <svg {...svg(size)}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const SpeakerIcon = ({ size = 48 }: P) => (
  <svg {...svg(size)}>
    <path d="M3.5 9.5h3.2L11.5 5.5v13l-4.8-4H3.5z" fill="currentColor" />
    <path d="M15.2 9.2a4 4 0 0 1 0 5.6" />
    <path d="M18.2 6.4a8 8 0 0 1 0 11.2" />
  </svg>
);

export const TurtleIcon = ({ size = 32 }: P) => (
  <svg {...svg(size)}>
    <path d="M3.5 15.5a7 7 0 0 1 14 0z" />
    <path d="M8 10.2 10.5 15.5 13 10.2" />
    <path d="M17.5 14h1.6a2.4 2.4 0 0 0 0-4.8h-.4" />
    <path d="M6 15.5v2.5M15 15.5v2.5" />
  </svg>
);

export const ReplayIcon = ({ size = 28 }: P) => (
  <svg {...svg(size)}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4v4.5H15" />
  </svg>
);

export const AlbumIcon = ({ size = 28 }: P) => (
  <svg {...svg(size)}>
    <rect x="4.5" y="3" width="15" height="18" rx="3" />
    <path d="m12 8.2 1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" fill="currentColor" strokeWidth="1.2" />
  </svg>
);

export const BookIcon = ({ size = 28 }: P) => (
  <svg {...svg(size)}>
    <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" />
    <path d="M12 6.5V19" />
  </svg>
);

/** A right-pointing arrow; `left` flips it. Books are English, so pages turn left to right. */
export const ArrowIcon = ({ size = 32, left = false }: P & { left?: boolean }) => (
  <svg {...svg(size)} style={left ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M5 12h13.5" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

export const CheckIcon = ({ size = 28 }: P) => (
  <svg {...svg(size)} strokeWidth={3}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const CloseIcon = ({ size = 28 }: P) => (
  <svg {...svg(size)}>
    <path d="M17 7 7 17M7 7l10 10" />
  </svg>
);

/** A filled star with a darker edge (rewards). `on` = earned. */
export const StarIcon = ({ size = 36, on = true }: P & { on?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="k-star" data-on={on}>
    <path
      d="M12 2.8c.4 0 .8.2 1 .6l2.3 4.6 5 .8c.9.1 1.3 1.3.6 1.9l-3.6 3.6.9 5c.2.9-.8 1.6-1.6 1.2L12 18.1l-4.5 2.4c-.8.4-1.8-.3-1.6-1.2l.9-5-3.6-3.6c-.7-.6-.3-1.8.6-1.9l5-.8L11 3.4c.2-.4.6-.6 1-.6z"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

/** The sun at the center of the progress ring. */
export const SunIcon = ({ size = 30 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="k-sun">
    <g stroke="var(--k-sun-edge)" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7" />
    </g>
    <circle cx="12" cy="12" r="5.4" fill="var(--k-sun)" stroke="var(--k-sun-edge)" strokeWidth="1.8" />
  </svg>
);

/** Little sparkles that burst around a right answer (animated in kids.css). */
export const SparkleBurst = () => (
  <svg className="k-burst" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
      <g key={a} transform={`rotate(${a} 50 50)`}>
        <path
          className="k-burst-ray"
          style={{ animationDelay: `${(i % 2) * 60}ms` }}
          d={i % 2 ? 'M50 4.5 51.6 9 56 10.5 51.6 12 50 16.5 48.4 12 44 10.5 48.4 9z' : 'M50 1 52.2 7.3 58.5 9.5 52.2 11.7 50 18 47.8 11.7 41.5 9.5 47.8 7.3z'}
        />
      </g>
    ))}
  </svg>
);
