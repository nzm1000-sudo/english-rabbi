import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Art } from '@/ui/Art';
import { RowLink } from '@/ui/RowLink';
import { ChevronIcon } from '@/ui/icons';
import { heCount } from '@/domain/text/heCount';
import { GROUPS, REVIEW_GROUP, REVIEW_PATH } from './practiceCatalog';

const storageKey = (studentId: string) => `home.openGroup.${studentId}`;

function readOpen(studentId: string): string | null {
  try {
    const v = localStorage.getItem(storageKey(studentId));
    return GROUPS.some((g) => g.id === v) ? v : null;
  } catch {
    return null;
  }
}

function saveOpen(studentId: string, id: string | null): void {
  try {
    if (id) localStorage.setItem(storageKey(studentId), id);
    else localStorage.removeItem(storageKey(studentId));
  } catch {
    // Private mode or storage blocked: the group simply starts closed next time.
  }
}

/**
 * The practice catalog on the home screen: four group headers, one opens at a
 * time and fans out its practice modes below it (WAI-ARIA accordion: header
 * buttons with aria-expanded, arrow keys move between headers). The open group
 * is remembered per student (render it with key={studentId}).
 */
export function PracticeGroups({ studentId, due }: { studentId: string; due: number }) {
  const [open, setOpen] = useState<string | null>(() => readOpen(studentId));
  const uid = useId();
  const headers = useRef<(HTMLButtonElement | null)[]>([]);
  const panels = useRef<Record<string, HTMLDivElement | null>>({});
  const justOpened = useRef<string | null>(null);

  // Bring a freshly opened group fully into view (only if it is cut off).
  useEffect(() => {
    if (!open || justOpened.current !== open) return;
    justOpened.current = null;
    const panel = panels.current[open];
    if (!panel || typeof panel.scrollIntoView !== 'function') return;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => panel.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' }), still ? 0 : 220);
    return () => clearTimeout(t);
  }, [open]);

  const toggle = (id: string) => {
    const next = open === id ? null : id;
    justOpened.current = next;
    setOpen(next);
    saveOpen(studentId, next);
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = GROUPS.length - 1;
    const to = e.key === 'ArrowDown' ? (i === last ? 0 : i + 1) : e.key === 'ArrowUp' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1;
    if (to < 0) return;
    e.preventDefault();
    headers.current[to]?.focus();
  };

  return (
    <div className="list pgroups">
      {GROUPS.map((g, i) => {
        const isOpen = open === g.id;
        const headId = `${uid}-h-${g.id}`;
        const panelId = `${uid}-p-${g.id}`;
        const reviewDue = g.id === REVIEW_GROUP && due > 0;
        return (
          <div key={g.id} className="pgroup" data-open={isOpen || undefined}>
            <h3 className="pgroup-h">
              <button
                ref={(el) => {
                  headers.current[i] = el;
                }}
                type="button"
                id={headId}
                className="list-item pgroup-btn"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(g.id)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <Art name={g.art} size={44} tone={g.tone} fallback={g.icon} />
                <span className="grow stack gap-0">
                  <span className="pgroup-title">
                    <strong>{g.title}</strong>
                    {reviewDue && <span className="pgroup-due">{due} לחזרה</span>}
                  </span>
                  <span className="small muted clamp-1">
                    {heCount(g.items.length, 'תרגול אחד', 'תרגולים')} · {g.lead}
                  </span>
                </span>
                <span className="chev pgroup-chev" aria-hidden="true">
                  <ChevronIcon />
                </span>
              </button>
            </h3>
            <div
              ref={(el) => {
                panels.current[g.id] = el;
              }}
              id={panelId}
              role="region"
              aria-labelledby={headId}
              className="pgroup-panel"
              // Closed: out of the tab order and hidden from screen readers (aria-hidden
              // as well, for browsers without inert).
              inert={!isOpen}
              aria-hidden={!isOpen}
            >
              <div className="pgroup-items">
                {g.items.map((it) => (
                  <RowLink
                    key={it.path}
                    to={`/s/${studentId}/${it.path}`}
                    art={it.art}
                    tone={it.tone}
                    icon={it.icon}
                    title={it.title}
                    sub={it.path === REVIEW_PATH && due > 0 ? `${heCount(due, 'מילה אחת', 'מילים')} לחזרה היום` : it.sub}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
