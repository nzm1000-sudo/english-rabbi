import type { CSSProperties } from 'react';
import type { Picture as P } from '@/domain/kids/schema';
import { wordPic } from './pics';

/**
 * A picture card face: a 3D illustration when there is one for the word,
 * otherwise the emoji; a color swatch; or dots for counting.
 */
export function Picture({ picture, word, size = 72 }: { picture: P; word?: string; size?: number }) {
  const src = picture.emoji ? wordPic(word) : undefined;
  if (src) {
    return <img className="kid-pic" src={src} alt="" width={size} height={size} draggable={false} style={{ '--kid-size': `${size}px` } as CSSProperties} />;
  }
  if (picture.color) {
    return <span className="kid-swatch" style={{ background: picture.color, width: size, height: size }} aria-hidden="true" />;
  }
  if (picture.count !== undefined) {
    const n = picture.count;
    const dot = Math.max(10, Math.round(size / (n > 6 ? 5 : 4)));
    return (
      <span className="kid-dots" style={{ width: size * 1.3, gap: dot / 3 }} aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <i key={i} style={{ width: dot, height: dot }} />
        ))}
      </span>
    );
  }
  return (
    <span className="kid-emoji" style={{ fontSize: size }} aria-hidden="true">
      {picture.emoji}
    </span>
  );
}
