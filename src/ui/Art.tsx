import type { CSSProperties, ReactNode } from 'react';
import { art, type ArtName } from './art';

/**
 * A big 3D illustration (transparent webp). Until the file exists, a glossy
 * gradient orb with the SVG icon stands in, so layouts never change.
 * `tone` picks the orb gradient (a skill name, 'brand' or 'primary').
 */
export function Art({ name, size = 72, fallback, tone = 'brand', className = '' }: { name: ArtName; size?: number; fallback: ReactNode; tone?: string; className?: string }) {
  const src = art(name);
  const style = { '--art': `${size}px` } as CSSProperties;
  if (src) {
    return <img className={`art ${className}`.trim()} src={src} alt="" aria-hidden="true" width={size} height={size} style={style} loading="lazy" decoding="async" />;
  }
  return (
    <span className={`art art-orb orb-${tone} ${className}`.trim()} style={style} aria-hidden="true">
      {fallback}
    </span>
  );
}
