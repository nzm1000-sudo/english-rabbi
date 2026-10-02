import { ChoiceItem } from '@/domain/content/schema';
import { myWordsSession, wordItem } from './wordItems';

const w = (lemma: string, he: string, addedAt = 1) => ({ studentId: 's', lemma, he, addedAt });

describe('my words practice', () => {
  it('builds a valid choice item that shares the vocabulary unit', () => {
    const item = wordItem(w('Bread', 'לחם'), [w('oven', 'תנור'), w('house', 'בית')]);
    expect(ChoiceItem.safeParse(item).success).toBe(true);
    expect(item.unit).toBe('word:bread');
    expect(item.options[0]!.text).toBe('לחם');
    expect(new Set(item.options.map((o) => o.text)).size).toBe(4);
  });

  it('puts due words first', () => {
    const words = [w('a1', 'א', 1), w('b1', 'ב', 2), w('c1', 'ג', 3)];
    const units = new Map([
      ['word:a1', { card: { due: Date.now() + 1e9 } }],
      ['word:b1', { card: { due: 0 } }],
    ]) as never;
    expect(myWordsSession(words, units, Date.now()).map((i) => i.word!.lemma)).toEqual(['b1', 'c1', 'a1']);
  });
});
