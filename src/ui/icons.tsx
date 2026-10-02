/** Minimal inline icons. 1.75px strokes, currentColor. */
type P = { size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export const SpeakerIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
);
export const StopIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" /></svg>
);
/** Points to the reading direction's "back" (right in RTL). */
export const BackIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}><path d="m9 6 6 6-6 6" /></svg>
);
/** Points forward in RTL (left). */
export const ChevronIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}><path d="m15 6-6 6 6 6" /></svg>
);
export const GearIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);
export const CloseIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const PlusIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
);
export const CheckIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}><path d="m5 12 5 5 9-10" /></svg>
);

/* Skill and game icons. 24px grid, 1.9px stroke, rounded. */
const ico = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export const VocabIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 21H20" /><path d="M9 8h7M9 11.5h5" /></svg>
);
export const GrammarIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><path d="M17.25 13.5v7.5M13.5 17.25H21" /></svg>
);
export const ReadingIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M2 5c3-1.5 6.5-1.5 10 1 3.5-2.5 7-2.5 10-1v14c-3-1.5-6.5-1.5-10 1-3.5-2.5-7-2.5-10-1z" /><path d="M12 6v14" /></svg>
);
export const ListenIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4.5" height="6.5" rx="1.8" /><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.8" /></svg>
);
export const WriteIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /><path d="M14 6l3 3" /></svg>
);
export const SpeakIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><rect x="9" y="2.5" width="6" height="11.5" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4" /></svg>
);
export const TrophyIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.4M17 6h2.5a2.5 2.5 0 0 1-2.6 3.4M12 14v3.5M8.5 21h7M9.5 17.5h5V21h-5z" /></svg>
);
export const BoltIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" /></svg>
);
export const ExamIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><rect x="5" y="3.5" width="14" height="18" rx="2.5" /><path d="M9 3.5V2.5h6v1M8.5 10l1.5 1.5 3-3M8.5 16h7" /></svg>
);
export const RiddleIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" /><path d="M9.8 9.4a2.4 2.4 0 0 1 4.6.9c0 1.6-2.4 2-2.4 3.4M12 16.5h.01" /></svg>
);
export const GymIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></svg>
);
export const LessonIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>
);
export const FlameIcon = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#FF8A3D" d="M12 2c.6 3.2 4.5 5.4 4.5 10.2A4.6 4.6 0 0 1 12 17a4.6 4.6 0 0 1-4.5-4.8c0-1.9.8-3.2 1.8-4.4.2 1.4 1 2.4 2 2.7C11 7.6 11.2 4.6 12 2z" />
    <path fill="#FF5A36" d="M12 22a7.5 7.5 0 0 1-7.5-7.6c0-2.8 1.3-5 3-6.8 0 2.4 1.1 4 2.6 4.6-.5-3 .4-6.6 2.4-9.2 1 4 7 6.7 7 11.4A7.5 7.5 0 0 1 12 22z" opacity=".9" />
    <path fill="#FFD25A" d="M12 22a3.6 3.6 0 0 1-3.6-3.7c0-1.8 1.4-3 2.4-4.4.3 1.2 1 1.8 1.8 2 .2-1.3.8-2.4 1.6-3.2.6 1.6 2 2.6 2 5.6A3.6 3.6 0 0 1 12 22z" />
  </svg>
);
export const StarIcon = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#FFC531" stroke="#E8A400" strokeWidth="1.2" strokeLinejoin="round" d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2-4.6-4.4 6.3-.9z" />
  </svg>
);
export const TargetIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
);
export const RepeatIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5" /></svg>
);
export const ChatIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></svg>
);
export const XIcon = ({ size = 22 }: P) => (
  <svg {...ico(size)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);

export const TurtleIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M4 15c0-4 3.6-7 8-7s8 3 8 7z" /><path d="M8.5 9.2 10 15M15.5 9.2 14 15M4 15h16" /><path d="M20 13.5c1.4 0 2-.9 2-2" /><path d="M6.5 15v2.5M17.5 15v2.5" /></svg>
);

export const BookIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M5 4.5h9a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h9" /><path d="M9 8h4" /></svg>
);
export const MicIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" /></svg>
);
export const BookmarkIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M6.5 4h11v16l-5.5-4-5.5 4z" /></svg>
);
export const SearchIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg>
);
export const TranslateIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M4 6h9M8.5 4v2M6 6c.8 3 2.8 5.3 5.5 6.5M11 6c-.8 3-2.8 5.5-5.5 7" /><path d="m13 20 4-9 4 9M14.5 17h5" /></svg>
);
export const LinkIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
);
export const TreeIcon = ({ size = 24 }: P) => (
  <svg {...ico(size)}><circle cx="12" cy="5.5" r="2.5" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="12" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /><path d="M12 8v8M12 12H5.5v4M12 12h6.5v4" /></svg>
);
