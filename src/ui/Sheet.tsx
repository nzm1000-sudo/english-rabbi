import { useEffect, type ReactNode } from 'react';
import { CloseIcon } from './icons';

/** Full-height bottom sheet for reading a lesson without leaving the exercise. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="icon-btn" onClick={onClose} aria-label="סגירה">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
