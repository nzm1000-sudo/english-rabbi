import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Layout primitives on the 8px grid. They render the .stack / .row / .grid
 * classes from src/app/styles/base.css, so screens need no inline styles.
 * gap is a step of the spacing scale: 0, 1 (4px, hairline), 2 (8), 3 (16),
 * 4 (24), 5 (32), 6 (40).
 */
export type Gap = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type Justify = 'start' | 'center' | 'end' | 'between';
type Tag = 'div' | 'section' | 'header' | 'footer' | 'article' | 'span' | 'ul' | 'nav';

interface BoxProps extends HTMLAttributes<HTMLElement> {
  as?: Tag;
  gap?: Gap;
  align?: Align;
  justify?: Justify;
  children?: ReactNode;
}

function classes(base: string, { gap, align, justify, className }: Pick<BoxProps, 'gap' | 'align' | 'justify' | 'className'>): string {
  return [base, gap !== undefined && `gap-${gap}`, align && `items-${align}`, justify && `justify-${justify}`, className].filter(Boolean).join(' ');
}

/** Vertical flow. Default gap 16. */
export function Stack({ as: As = 'div', gap, align, justify, className, ...rest }: BoxProps) {
  return <As className={classes('stack', { gap, align, justify, className })} {...rest} />;
}

/** Horizontal line, centered vertically. Default gap 16. */
export function Row({ as: As = 'div', gap, align, justify, wrap, className, ...rest }: BoxProps & { wrap?: boolean }) {
  return <As className={classes(wrap ? 'row wrap' : 'row', { gap, align, justify, className })} {...rest} />;
}

/** Equal columns (2 or 3). Default gap 16. */
export function Grid({ as: As = 'div', cols = 2, gap, align, className, ...rest }: Omit<BoxProps, 'justify'> & { cols?: 2 | 3 }) {
  return <As className={classes(cols === 3 ? 'grid-3' : 'grid-2', { gap, align, className })} {...rest} />;
}
