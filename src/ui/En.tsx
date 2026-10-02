import type { ReactNode } from 'react';

/** English text inside the Hebrew UI: isolated LTR, English lang for screen readers and hyphenation. */
export function En({ children, as: Tag = 'span', className = '' }: { children: ReactNode; as?: 'span' | 'p' | 'div'; className?: string }) {
  return (
    <Tag lang="en" dir="ltr" className={`en ${className}`.trim()}>
      {children}
    </Tag>
  );
}
