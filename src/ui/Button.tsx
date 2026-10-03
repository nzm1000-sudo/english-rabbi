import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  /** Shows a spinner in place of the label and keeps the width. */
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/** Classes for a button-looking element (also used by kids screens through the .btn classes). */
export function buttonClass({ variant = 'secondary', size = 'md', block, loading, className }: Omit<Common, 'icon' | 'children'>): string {
  return ['btn', `btn-${variant}`, `btn-${size}`, block && 'btn-block', loading && 'is-loading', className].filter(Boolean).join(' ');
}

function Inner({ icon, loading, children }: Pick<Common, 'icon' | 'loading' | 'children'>) {
  return (
    <>
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      {icon && <span className="btn-icon">{icon}</span>}
      {children !== undefined && <span className="btn-label">{children}</span>}
    </>
  );
}

/**
 * The one button. Variants: primary (accent fill, one per screen),
 * secondary (outlined), tertiary (text only), danger (only in confirm sheets).
 * Sizes: lg 56 (sticky bars), md 48, sm 40 visual with a 48 hit area.
 */
export function Button({ variant, size, block, loading, icon, className, children, type = 'button', disabled, ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block, loading, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Inner icon={icon} loading={loading}>
        {children}
      </Inner>
    </button>
  );
}

/** A router link that looks like a Button. */
export function ButtonLink({ to, replace, variant, size, block, icon, className, children, ...rest }: Common & { to: string; replace?: boolean; 'aria-label'?: string }) {
  return (
    <Link to={to} replace={replace} className={buttonClass({ variant, size, block, className })} {...rest}>
      <Inner icon={icon}>{children}</Inner>
    </Link>
  );
}
