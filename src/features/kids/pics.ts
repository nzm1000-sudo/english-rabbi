import { picIds } from '@content/kids';

/** Ids of the 3D illustrations in public/pics (see tools/pics/import.mjs). */
const available = new Set(picIds);

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function url(id: string): string | undefined {
  return available.has(id) ? `pics/${id}.webp` : undefined;
}

/** The illustration for an English picture word, if there is one. */
export const wordPic = (en: string | undefined) => (en ? url(`w-${slug(en)}`) : undefined);
export const stickerPic = (id: string) => url(`s-${id}`);
export const mascotPic = (name = 'owl') => url(`m-${name}`);
