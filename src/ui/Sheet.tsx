import { useEffect, useId, type ReactNode } from 'react';
import { CloseIcon } from './icons';
import { Button } from './Button';

/**
 * Bottom sheet: a lesson, an explanation, a confirmation. Closes on the
 * backdrop, the close button and Escape. With `title` the header shows it
 * centered between two equal slots.
 */
export function Sheet({
  open,
  onClose,
  children,
  label,
  title,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  title?: ReactNode;
  /** Sticky actions at the bottom of the sheet. */
  footer?: ReactNode;
}) {
  const titleId = useId();
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
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        {...(title ? { 'aria-labelledby': titleId } : { 'aria-label': label })}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <span aria-hidden="true" />
          {title ? (
            <h2 className="sheet-title" id={titleId}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button className="icon-btn" onClick={onClose} aria-label="סגירה">
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

/** A confirmation in place of window.confirm(): title, one line, the action and a way back. */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'ביטול',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      label={title}
      title={title}
      footer={
        <div className="btn-row">
          <Button size="lg" onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button size="lg" variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="sheet-text">{body}</div>
    </Sheet>
  );
}
