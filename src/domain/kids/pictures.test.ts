import { describe, expect, it } from 'vitest';
import { kidBooks, kidWords, phonics, picIds } from '@content/kids';
import { KID_TOPICS } from './schema';
import { bookPageId, bookSlug, emojiWords, scenePictureIds, splitEmoji, topicPictureId, wordId } from './pictures';

const available = new Set(picIds);
const emoji = emojiWords(kidWords, phonics);
const ctx = { available, emoji };

describe('kids picture mapping', () => {
  it('names book page pictures with dashes instead of dots', () => {
    expect(bookSlug('kb.little.farm')).toBe('kb-little-farm');
    expect(bookPageId('kb.young.big-bun', 3)).toBe('b-kb-young-big-bun-3');
    expect(wordId('Teddy Bear')).toBe('w-teddy-bear');
  });

  it('splits emoji strings into single emoji', () => {
    expect(splitEmoji('🐄🐑🐔')).toEqual(['🐄', '🐑', '🐔']);
    expect(splitEmoji('🕯️🕯️🍞').length).toBe(3);
  });

  it('gives every topic but numbers an existing picture', () => {
    for (const t of KID_TOPICS) {
      const id = topicPictureId(t, available);
      if (t === 'numbers') expect(id).toBeUndefined();
      else expect(id && available.has(id), t).toBe(true);
    }
    expect(topicPictureId('animals', available)).toBe('w-lion');
    expect(topicPictureId('animals', new Set())).toBeUndefined();
  });

  it('illustrates a page from its scene emoji first', () => {
    expect(scenePictureIds('🐄', 'I see a cow.', ctx)).toEqual(['w-cow']);
    expect(scenePictureIds('🐄🐑🐔🐐', 'I see the farm!', ctx)).toEqual(['w-cow', 'w-sheep']);
    expect(scenePictureIds('🕯️🕯️🍞😊', 'We say Shabbat Shalom!', ctx)).toEqual(['w-candles', 'w-challah']);
    expect(scenePictureIds('☔', 'I take my umbrella.', ctx)).toEqual(['w-umbrella']);
  });

  it('prefers the storybook characters when their pictures exist', () => {
    const withChars = { available: new Set([...picIds, 'c-ari', 'c-ima']), emoji };
    expect(scenePictureIds('🧒🍞', 'Ari has a big bun.', withChars)).toEqual(['c-ari', 'w-challah']);
    expect(scenePictureIds('👩🕯️🕯️', 'Ima lights the candles.', withChars)).toEqual(['c-ima', 'w-candles']);
    expect(scenePictureIds('👧😢', 'Now Tamar is sad.', { available: new Set([...picIds, 'c-tamar']), emoji })).toEqual(['c-tamar']);
    expect(scenePictureIds('🧒🍞', 'Ari has a big bun.', { available: new Set(['w-brother', 'w-challah']), emoji })).toEqual(['w-brother', 'w-challah']);
  });

  it('falls back to nouns in the sentence, skipping words with misleading pictures', () => {
    expect(scenePictureIds('❓', 'I see a rainbow!', ctx)).toEqual(['w-rainbow']);
    expect(scenePictureIds('❓', 'We light one candle.', ctx)).toEqual([]);
    expect(scenePictureIds('❓', 'Ari can help.', ctx)).toEqual([]);
  });

  it('returns nothing when no picture exists, so the page shows its placeholder', () => {
    expect(scenePictureIds('🐄', 'I see a cow.', { available: new Set(), emoji })).toEqual([]);
  });

  it('illustrates most book pages', () => {
    const pages = kidBooks.flatMap((b) => b.pages);
    const shown = pages.filter((p) => scenePictureIds(p.scene ?? '', p.en, ctx).length > 0);
    expect(shown.length / pages.length).toBeGreaterThan(0.7);
  });
});
