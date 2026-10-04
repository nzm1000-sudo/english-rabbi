import { contentRegistry as reg } from './index';
import { splitBidi } from '@/ui/He';
import type { Explain } from '@/domain/content/schema';

/** Hebrew fields of an explanation: English inside them is words, never sentences. */
function hebrewFields(e: Explain): string[] {
  return [
    e.title,
    e.rule,
    e.why,
    e.remember,
    ...e.examples.map((x) => x.he),
    ...e.check.flatMap((c) => [c.when, c.then]),
    ...e.exceptions.map((x) => x.he),
  ];
}

const MAX_EN_WORDS = 4;

describe('explanations by age', () => {
  const explained = [...reg.anchors.values()].filter((a) => a.levels);

  it('exist and load', () => {
    expect(explained.length).toBeGreaterThan(0);
  });

  it('keep English sentences out of Hebrew text, so the line never flips', () => {
    const bad: string[] = [];
    for (const a of explained) {
      for (const [level, e] of Object.entries(a.levels!)) {
        for (const text of hebrewFields(e)) {
          for (const run of splitBidi(text).filter((p) => p.latin)) {
            const words = run.text.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
            if (words > MAX_EN_WORDS) bad.push(`${a.id}/${level}: "${run.text.trim()}"`);
          }
          if (/(^|\s)-[A-Za-z]/.test(text)) bad.push(`${a.id}/${level}: hyphen before English in "${text}"`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('stay short enough to read on a phone', () => {
    for (const a of explained) {
      for (const [level, e] of Object.entries(a.levels!)) {
        const where = `${a.id}/${level}`;
        expect(e.examples.length, where).toBeLessThanOrEqual(4);
        expect(e.check.length, where).toBeLessThanOrEqual(4);
        expect(e.exceptions.length, where).toBeLessThanOrEqual(3);
        expect(e.rule.length, where).toBeLessThanOrEqual(level === 'kids' ? 180 : 260);
        expect(e.why.length, where).toBeLessThanOrEqual(level === 'kids' ? 180 : 260);
      }
    }
  });
});
