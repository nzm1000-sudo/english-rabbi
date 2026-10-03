/**
 * Fixed Hebrew phrases spoken to children. tools/tts-prerender/hebrew.mjs
 * records each one (plus topic, sticker and book names) with a natural
 * Hebrew voice. A phrase missing here falls back to the phone's own voice.
 * No imports: the recording tool reads this file directly.
 */
export const PRAISE = ['כל הכבוד!', 'יופי!', 'מעולה!', 'נכון מאוד!', 'איזה יופי!'];

export const KIDS_PHRASES = [
  ...PRAISE,
  'איפה',
  'נסו שוב',
  'באיזו אות זה מתחיל?',
  'בונים את המילה',
  'איפה המילה',
  'איזו אות?',
  'בונים מילה',
  'מילים קסומות',
  'קוראים ומתאימים',
  'זוגות',
  'ספרונים',
  'המדבקות שלי',
  'כל הכבוד! אספתם את כל המדבקות',
];

export const newStickerPhrase = (name: string) => `מדבקה חדשה! ${name}`;
