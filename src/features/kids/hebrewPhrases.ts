/**
 * Fixed Hebrew phrases spoken to children. tools/tts-prerender/hebrew.mjs
 * records each one (plus topic, sticker and book names) with a natural
 * Hebrew voice. A phrase missing here falls back to the phone's own voice.
 * No imports: the recording tool reads this file directly.
 */
export const PRAISE = ['כל הכבוד!', 'יופי!', 'מעולה!', 'נכון מאוד!', 'איזה יופי!'];

/** Said during a game or a reward: the female guide voice. */
export const GUIDE_PHRASES = [
  ...PRAISE,
  'איפה',
  'נסו שוב',
  'באיזו אות זה מתחיל?',
  'בונים את המילה',
  'איפה המילה',
  'איזו אות?',
  'בונים מילה',
  'כל הכבוד! אספתם את כל המדבקות',
];

/** Names of places in the kids area: the male voice, like topic, book and sticker names. */
export const MENU_PHRASES = ['מילים קסומות', 'קוראים ומתאימים', 'זוגות', 'ספרונים', 'המדבקות שלי'];

export const KIDS_PHRASES = [...GUIDE_PHRASES, ...MENU_PHRASES];

export const newStickerPhrase = (name: string) => `מדבקה חדשה! ${name}`;
