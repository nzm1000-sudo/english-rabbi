import type { CSSProperties } from 'react';
import type { Picture as P } from '@/domain/kids/schema';
import { wordPic } from './pics';

/**
 * A picture card face: a 3D illustration when there is one for the word,
 * otherwise the emoji; a paint drop for colors; or dots for counting.
 * `size` is the box in px; `fill` makes it fill its card instead.
 */
export function Picture({ picture, word, size = 72, fill = false }: { picture: P; word?: string; size?: number; fill?: boolean }) {
  const src = picture.emoji ? wordPic(word) : undefined;
  const box = (fill ? { '--kid-size': '100%' } : { '--kid-size': `${size}px` }) as CSSProperties;
  if (src) {
    return <img className={`kid-pic${fill ? ' fill' : ''}`} src={src} alt="" width={fill ? 480 : size} height={fill ? 480 : size} draggable={false} decoding="async" style={box} />;
  }
  if (picture.color) {
    return (
      <span className={`kid-paint${fill ? ' fill' : ''}`} style={box} aria-hidden="true">
        <span className="kid-swatch" style={{ background: picture.color }} />
      </span>
    );
  }
  if (picture.count !== undefined) {
    const n = picture.count;
    return (
      <span className={`kid-dots${fill ? ' fill' : ''}`} data-n={n} style={box} aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <i key={i} />
        ))}
      </span>
    );
  }
  return (
    <span className={`kid-emoji${fill ? ' fill' : ''}`} style={box} aria-hidden="true">
      {picture.emoji}
    </span>
  );
}
