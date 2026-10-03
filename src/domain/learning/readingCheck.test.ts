import { compareReading } from './readingCheck';

describe('reading check', () => {
  it('marks every word right for a perfect reading', () => {
    const r = compareReading('Tamar puts the bread in the oven.', 'Tamar puts the bread in the oven');
    expect(r.words.every((w) => w.status === 'ok')).toBe(true);
    expect(r.score).toBe(1);
  });

  it('finds a skipped word and a wrong word without shifting the rest', () => {
    const r = compareReading('Ari walks to shul with Grandpa.', 'Ari walk to with grandpa');
    expect(r.words.map((w) => w.status)).toEqual(['ok', 'close', 'ok', 'missed', 'ok', 'ok']);
  });

  it('accepts contractions and numbers written either way', () => {
    expect(compareReading("I'm 12 today.", 'I am twelve today').score).toBe(1);
  });

  it('marks a different word as wrong', () => {
    const r = compareReading('The cat is big.', 'The dog is big');
    expect(r.words[1]).toEqual({ text: 'cat', status: 'wrong', heard: 'dog' });
  });
});
