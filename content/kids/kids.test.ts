import fs from 'node:fs';
import path from 'node:path';
import { KidBook, KidWord, Phonics } from '@/domain/kids/schema';

const dir = path.resolve(__dirname);
const read = (f: string) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : undefined);
const LONG_DASH = /[—–]/;

describe('kids content', () => {
  const words = read('words.json');
  const phonics = read('phonics.json');
  const books = read('books.json');

  it.runIf(!!words)('words are valid and unique', () => {
    const problems: string[] = [];
    const ids = new Set<string>();
    for (const w of words) {
      const r = KidWord.safeParse(w);
      if (!r.success) problems.push(`${w.id}: ${r.error.message}`);
      if (ids.has(w.id)) problems.push(`${w.id}: duplicate`);
      ids.add(w.id);
      if (LONG_DASH.test(JSON.stringify(w))) problems.push(`${w.id}: long dash`);
    }
    expect(problems).toEqual([]);
  });

  it.runIf(!!phonics)('phonics is valid', () => {
    const r = Phonics.safeParse(phonics);
    expect(r.success ? [] : r.error.message).toEqual([]);
    expect(LONG_DASH.test(JSON.stringify(phonics))).toBe(false);
  });

  it.runIf(!!books)('books are valid', () => {
    const problems: string[] = [];
    for (const b of books) {
      const r = KidBook.safeParse(b);
      if (!r.success) problems.push(`${b.id}: ${r.error.message}`);
      if (LONG_DASH.test(JSON.stringify(b))) problems.push(`${b.id}: long dash`);
    }
    expect(problems).toEqual([]);
  });
});
