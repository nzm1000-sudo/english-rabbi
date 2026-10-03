import { kidWords, phonics, picIds } from '@content/kids';
import type { KidTopic } from '@/domain/kids/schema';
import { bookPageId, emojiWords, scenePictureIds, slug, topicPictureId } from '@/domain/kids/pictures';

/** Ids of the 3D illustrations in public/pics (see tools/pics/import.mjs). */
const available = new Set(picIds);
const emoji = emojiWords(kidWords, phonics);

const url = (id: string): string | undefined => (available.has(id) ? `pics/${id}.webp` : undefined);

/** The illustration for an English picture word, if there is one. */
export const wordPic = (en: string | undefined) => (en ? url(`w-${slug(en)}`) : undefined);
export const stickerPic = (id: string) => url(`s-${id}`);
/** The 3D sticker, or the older flat SVG when it has no 3D version yet. */
export const stickerSrc = (id: string) => stickerPic(id) ?? `stickers/${id}.svg`;
/** The 3D sticker as a mask (its transparent background gives the outline), for locked silhouettes. */
export const stickerShape = (id: string) => stickerPic(id);
export const mascotPic = (name = 'owl') => url(`m-${name}`);
export const topicPic = (topic: KidTopic) => {
  const id = topicPictureId(topic, available);
  return id ? url(id) : undefined;
};
/** A full illustration made for this book page, when one exists. */
export const bookPagePic = (bookId: string, pageIndex: number) => url(bookPageId(bookId, pageIndex));
/** One or two word pictures that compose a page (or cover) scene. */
export const scenePics = (scene: string, text: string, max = 2) =>
  scenePictureIds(scene, text, { available, emoji }, max).map((id) => `pics/${id}.webp`);
