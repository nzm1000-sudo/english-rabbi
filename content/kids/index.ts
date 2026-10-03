import type { KidBook, KidWord, Phonics } from '@/domain/kids/schema';

/** Kids content: picture words, phonics, little books and the sticker set. */
const files = import.meta.glob('./*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export interface StickerInfo {
  id: string;
  he: string;
  en: string;
  theme: string;
}

export const kidWords = (files['./words.json'] ?? []) as KidWord[];
export const phonics = (files['./phonics.json'] ?? { letters: [], families: [], sightWords: [] }) as Phonics;
export const kidBooks = (files['./books.json'] ?? []) as KidBook[];
export const stickers = (files['./stickers.json'] ?? []) as StickerInfo[];
