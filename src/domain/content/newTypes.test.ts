import { applyFix, FixItem, glossFor, storyWords } from './schema';
import { checkFix } from '../learning/answerCheck';

const base = {
  id: 'fix.t', type: 'fix', skill: 'grammar.present-simple', level: 'A2', source: 'original',
  instruction: { he: 'למצוא', en: 'Find' }, explanation: { he: 'הסבר', en: 'Why' },
};

describe('spot the mistake', () => {
  it('applies a replacement and keeps punctuation', () => {
    expect(applyFix('Dan go to school.', 1, 'goes')).toBe('Dan goes to school.');
    expect(applyFix('She is happy, isnt she?', 3, "isn't")).toBe("She is happy, isn't she?");
  });

  it('deletes a word, keeping the end mark and the capital', () => {
    expect(applyFix('I am agree with you.', 1, '')).toBe('I agree with you.');
    expect(applyFix('The honesty is important.', 0, '')).toBe('Honesty is important.');
    expect(applyFix('We love the Shabbat.', 2, '') ).toBe('We love Shabbat.');
  });

  it('rejects an item whose correction does not give the corrected sentence', () => {
    const r = FixItem.safeParse({ ...base, sentence: 'Dan go home.', wrongIndex: 1, correction: 'went', distractors: ['goes', 'going'], corrected: 'Dan goes home.' });
    expect(r.success).toBe(false);
  });

  it('rejects a distractor equal to the correction', () => {
    const r = FixItem.safeParse({ ...base, sentence: 'Dan go home.', wrongIndex: 1, correction: 'goes', distractors: ['Goes', 'going'], corrected: 'Dan goes home.' });
    expect(r.success).toBe(false);
  });

  it('checks the tapped word and the chosen fix', () => {
    const item = FixItem.parse({ ...base, sentence: 'Dan go home.', wrongIndex: 1, correction: 'goes', distractors: ['going', 'gone'], corrected: 'Dan goes home.' });
    expect(checkFix(item, 0, null).correct).toBe(false);
    expect(checkFix(item, 1, 'going').correct).toBe(false);
    expect(checkFix(item, 1, 'Goes').correct).toBe(true);
  });
});

describe('story words', () => {
  it('splits a line into glossary keys', () => {
    expect(storyWords('"Thank you," Ari’s mom said. Didn\'t she?')).toEqual(['thank', 'you', "ari's", 'mom', 'said', "didn't", 'she']);
  });

  it('finds the base word of a possessive', () => {
    const story = { glossary: { ari: { lemma: 'Ari', he: 'ארי' } } };
    expect(glossFor(story, "ari's")?.lemma).toBe('Ari');
    expect(glossFor(story, 'moshe')).toBeUndefined();
  });
});
