import { dictionary } from './index';
import { lookup } from '@/services/dictionary';
import { contentRegistry as reg } from '../index';

describe('dictionary', () => {
  it('every entry has one or two meanings', () => {
    for (const [w, senses] of Object.entries(dictionary)) {
      expect(senses.length, w).toBeGreaterThan(0);
      expect(senses.length, w).toBeLessThanOrEqual(2);
      for (const s of senses) expect(s.lemma && s.he, w).toBeTruthy();
    }
  });

  it('knows the words of every English question and passage', () => {
    const texts: string[] = [];
    for (const i of reg.items) if ('promptLanguage' in i && i.promptLanguage === 'en') texts.push(i.prompt);
    for (const p of reg.passages.values()) texts.push(p.text);
    const missing = new Set<string>();
    for (const t of texts) for (const w of t.split(/\s+/)) if (/[A-Za-z]/.test(w) && !/_/.test(w) && !lookup(dictionary, w)) missing.add(w);
    expect([...missing]).toEqual([]);
  });
});
