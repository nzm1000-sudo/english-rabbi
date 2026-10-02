import type { CSSProperties } from 'react';

export function Avatar({ name, hue, size = 44 }: { name: string; hue: number; size?: number }) {
  const style = { '--hue': hue, width: size, height: size } as CSSProperties;
  return (
    <span className="avatar" style={style} aria-hidden="true">
      {name.trim().charAt(0)}
    </span>
  );
}
