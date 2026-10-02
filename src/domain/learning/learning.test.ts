import { checkChoice, checkTyped, normalizeAnswer } from './answerCheck';
import { toEvidence } from './evidence';
import { flowReducer, initialFlow, toOutcome } from './exerciseFlow';
import { decayedScore, isActive, recordMistake, recordRepair } from './memory';
import { newCard, reviewCard, isDue } from './srs';
import { supportLanguage } from './languageSupport';
import { snapshotItem } from './selector';
import { choiceItem, outcome, typedItem } from './testUtils';
import type { TypedItem } from '../content/schema';

const DAY = 86_400_000;

describe('answer checking', () => {
  const item = typedItem({ answers: ["don't know", 'went'] }) as TypedItem;

  it('normalizes case, spaces, quotes and final punctuation', () => {
    expect(normalizeAnswer('  Went. ')).toBe('went');
    expect(normalizeAnswer('I don’t know')).toBe('i do not know');
  });

  it('accepts contractions and their full forms', () => {
    expect(checkTyped(item, 'do not know').correct).toBe(true);
    expect(checkTyped(item, "Don't know!").correct).toBe(true);
  });

  it('rejects uncontracted question tags but accepts the contracted form', () => {
    const tag = typedItem({ answers: ["can't he"] }) as TypedItem;
    expect(checkTyped(tag, "can't he").correct).toBe(true);
    expect(checkTyped(tag, 'cannot he').correct).toBe(false);
    expect(checkTyped(typedItem({ answers: ["don't you"] }) as TypedItem, 'do not you').correct).toBe(false);
    // Ordinary negatives still normalize both ways.
    expect(checkTyped(typedItem({ answers: ["doesn't"] }) as TypedItem, 'does not').correct).toBe(true);
  });

  it('accepts "to" before verbs and articles before nouns in word recall', () => {
    const verb = typedItem({ answers: ['assume'], word: { lemma: 'assume', pos: 'verb', he: 'להניח' } }) as TypedItem;
    expect(checkTyped(verb, 'to assume').correct).toBe(true);
    const noun = typedItem({ answers: ['kitchen'], word: { lemma: 'kitchen', pos: 'noun', he: 'מטבח' } }) as TypedItem;
    expect(checkTyped(noun, 'a kitchen').correct).toBe(true);
    expect(checkTyped(noun, 'the kitchen').correct).toBe(true);
    const adverb = typedItem({ answers: ['already'], word: { lemma: 'already', pos: 'adverb', he: 'כבר' } }) as TypedItem;
    expect(checkTyped(adverb, 'to already').correct).toBe(false);
  });

  it('maps a known wrong answer to a misconception', () => {
    const r = checkTyped(typedItem() as TypedItem, 'goed');
    expect(r.correct).toBe(false);
    expect(r.misconception).toBe('past-simple.overregularization');
  });

  it('detects spelling near misses without accepting them', () => {
    const r = checkTyped(typedItem({ answers: ['beautiful'] }) as TypedItem, 'beutiful');
    expect(r.correct).toBe(false);
    expect(r.nearMiss).toBe(true);
  });

  it('does not treat very short wrong words as near misses', () => {
    expect(checkTyped(typedItem({ answers: ['in'] }) as TypedItem, 'on').nearMiss).toBe(false);
  });

  it('checks choice items and returns option misconceptions', () => {
    const it = choiceItem();
    if (it.type !== 'choice') throw new Error();
    expect(checkChoice(it, 'a').correct).toBe(true);
    expect(checkChoice(it, 'b').misconception).toBe('quantifiers.much-many');
  });
});

describe('exercise flow (hint ladder)', () => {
  const wrong = (at: number) => ({ type: 'submit' as const, attempt: { answer: 'x', correct: false, atMs: at } });

  it('goes hint -> hint -> explanation -> reveal, never revealing early', () => {
    let s = initialFlow(0);
    s = flowReducer(s, wrong(1), 2);
    expect([s.phase, s.hintsShown]).toEqual(['retry', 1]);
    s = flowReducer(s, wrong(2), 2);
    expect([s.phase, s.hintsShown]).toEqual(['retry', 2]);
    s = flowReducer(s, wrong(3), 2);
    expect([s.phase, s.explanationShown]).toEqual(['retry', true]);
    s = flowReducer(s, wrong(4), 2);
    expect(s.phase).toBe('revealed');
    expect(toOutcome(s)).toMatchObject({ revealed: true, finalCorrect: false, hintsUsed: 2, responseMs: 4 });
  });

  it('gives one free retry for a spelling near miss', () => {
    let s = initialFlow(0);
    s = flowReducer(s, { type: 'submit', attempt: { answer: 'beutiful', correct: false, nearMiss: true, atMs: 1 } }, 2);
    expect([s.phase, s.hintsShown, s.lastHelp]).toEqual(['retry', 0, 'spelling']);
    s = flowReducer(s, { type: 'submit', attempt: { answer: 'beutifull', correct: false, nearMiss: true, atMs: 2 } }, 2);
    expect(s.hintsShown).toBe(1);
  });

  it('asking for help when none is left does not reveal the answer', () => {
    let s = initialFlow(0);
    s = flowReducer(s, { type: 'hint' }, 0);
    expect(s.explanationShown).toBe(true);
    s = flowReducer(s, { type: 'hint' }, 0);
    expect(s.phase).toBe('retry');
  });

  it('test policy: one attempt, no hints, wrong reveals the answer', () => {
    let s = initialFlow(0);
    s = flowReducer(s, { type: 'hint' }, 2, 'test');
    expect(s.hintsShown).toBe(0);
    s = flowReducer(s, wrong(3), 2, 'test');
    expect(s.phase).toBe('revealed');
    expect(toOutcome(s)).toMatchObject({ revealed: true, hintsUsed: 0 });
    const ok = flowReducer(initialFlow(0), { type: 'submit', attempt: { answer: 'a', correct: true, atMs: 2 } }, 2, 'test');
    expect(ok.phase).toBe('solved');
  });

  it('replays are counted but ignored after the item ends', () => {
    let s = initialFlow(0);
    s = flowReducer(s, { type: 'replay' }, 2);
    s = flowReducer(s, { type: 'submit', attempt: { answer: 'a', correct: true, atMs: 5 } }, 2);
    s = flowReducer(s, { type: 'submit', attempt: { answer: 'b', correct: false, atMs: 6 } }, 2);
    expect(s.phase).toBe('solved');
    expect(toOutcome(s).replays).toBe(1);
  });
});

describe('evidence', () => {
  const snap = snapshotItem(typedItem());

  it('clean success is full evidence and a Good review', () => {
    const e = toEvidence(snap, outcome({ responseMs: 15000 }));
    expect(e).toMatchObject({ score: 1, weight: 1, grade: 'good' });
  });

  it('success after hints is partial credit and a Hard review', () => {
    const e = toEvidence(snap, outcome({ hintsUsed: 1 }));
    expect(e.score).toBeCloseTo(0.75);
    expect(e.grade).toBe('hard');
  });

  it('success after the explanation is graded Again', () => {
    expect(toEvidence(snap, outcome({ hintsUsed: 2, explanationShown: true })).grade).toBe('again');
  });

  it('revealed answer is a failure', () => {
    expect(toEvidence(snap, outcome({ revealed: true, finalCorrect: false }))).toMatchObject({ score: 0, grade: 'again' });
  });

  it('skip is weak evidence and does not touch the review schedule', () => {
    expect(toEvidence(snap, outcome({ skipped: true, finalCorrect: false }))).toMatchObject({ grade: null, weight: 0.25 });
  });

  it('slow correct answer is graded Hard', () => {
    const e = toEvidence(snap, outcome({ responseMs: 200_000 }));
    expect(e.flags).toContain('slow');
    expect(e.grade).toBe('hard');
  });

  it('fast correct pick on a hard choice item is a suspected guess', () => {
    const e = toEvidence(snapshotItem(choiceItem()), outcome({ responseMs: 700 }), 0.3);
    expect(e.flags).toContain('possible-guess');
    expect(e.weight).toBeLessThan(0.5);
  });

  it('fast correct pick is not a guess when success was expected', () => {
    const e = toEvidence(snapshotItem(choiceItem()), outcome({ responseMs: 700 }), 0.9);
    expect(e.flags).not.toContain('possible-guess');
  });
});

describe('spaced repetition', () => {
  it('successful reviews push the next review further out', () => {
    let card = newCard(0);
    let t = 0;
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      card = reviewCard(card, 'good', t);
      intervals.push(card.due - t);
      t = card.due;
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]!).toBeGreaterThanOrEqual(intervals[i - 1]!);
    expect(intervals[intervals.length - 1]!).toBeGreaterThan(5 * DAY);
  });

  it('a lapse brings the card back soon', () => {
    let card = newCard(0);
    let t = 0;
    for (let i = 0; i < 4; i++) {
      card = reviewCard(card, 'good', t);
      t = card.due;
    }
    const lapsed = reviewCard(card, 'again', t);
    expect(lapsed.due - t).toBeLessThan(DAY);
    expect(lapsed.lapses).toBe(1);
  });

  it('is deterministic (needed for event replay)', () => {
    const a = reviewCard(reviewCard(newCard(0), 'good', 0), 'hard', 3 * DAY);
    const b = reviewCard(reviewCard(newCard(0), 'good', 0), 'hard', 3 * DAY);
    expect(a).toEqual(b);
  });

  it('new cards are due immediately', () => {
    expect(isDue(newCard(100), 100)).toBe(true);
  });
});

describe('learner memory', () => {
  it('a pattern becomes active after repeated mistakes', () => {
    let p = recordMistake(undefined, 'm', { itemId: 'i', answer: 'x', at: 0 });
    expect(isActive(p, 0)).toBe(false);
    p = recordMistake(p, 'm', { itemId: 'i', answer: 'x', at: 1000 });
    expect(isActive(p, 1000)).toBe(true);
  });

  it('repairs and time make it inactive', () => {
    let p = recordMistake(undefined, 'm', { itemId: 'i', answer: 'x', at: 0 });
    p = recordMistake(p, 'm', { itemId: 'i', answer: 'x', at: 0 });
    for (let i = 0; i < 3; i++) p = recordRepair(p, 1000 + i);
    expect(isActive(p, 2000)).toBe(false);

    let q = recordMistake(undefined, 'm', { itemId: 'i', answer: 'x', at: 0 });
    q = recordMistake(q, 'm', { itemId: 'i', answer: 'x', at: 0 });
    expect(decayedScore(q, 60 * DAY)).toBeLessThan(1);
  });

  it('keeps only the latest examples', () => {
    let p = recordMistake(undefined, 'm', { itemId: 'i0', answer: 'x', at: 0 });
    for (let i = 1; i < 10; i++) p = recordMistake(p, 'm', { itemId: `i${i}`, answer: 'x', at: i });
    expect(p.examples).toHaveLength(5);
    expect(p.examples.at(-1)?.itemId).toBe('i9');
  });
});

describe('language support', () => {
  it('shifts from Hebrew to English as the level rises', () => {
    expect(supportLanguage(-2)).toBe('he');
    expect(supportLanguage(0)).toBe('mixed');
    expect(supportLanguage(1.2)).toBe('en');
  });
});

describe('build the sentence', () => {
  it('accepts the right order, flags traps and wrong order', async () => {
    const { checkOrder } = await import('./answerCheck');
    const { ContentItem } = await import('../content/schema');
    const item = ContentItem.parse({
      id: 'o', type: 'order', skill: 'grammar.word-order', level: 'A2', prompt: 'Build the sentence',
      answer: 'Where did she go?', distractors: [{ text: 'went', misconception: 'past-simple.did-plus-past' }],
      instruction: { he: 'א', en: 'a' }, explanation: { he: 'א', en: 'a' }, source: 'original',
    });
    if (item.type !== 'order') throw new Error();
    expect(checkOrder(item, ['Where', 'did', 'she', 'go']).correct).toBe(true);
    expect(checkOrder(item, ['Where', 'did', 'she', 'went']).misconception).toBe('past-simple.did-plus-past');
    expect(checkOrder(item, ['Where', 'she', 'did', 'go']).misconception).toBe('word-order.sentence');
  });

  it('accepts every listed correct order', async () => {
    const { checkOrder, orderTokens } = await import('./answerCheck');
    const { ContentItem } = await import('../content/schema');
    const item = ContentItem.parse({
      id: 'o2', type: 'order', skill: 'grammar.word-order', level: 'A2', prompt: 'p',
      answer: 'Yesterday I went to the park.', alternatives: ['I went to the park yesterday.'],
      instruction: { he: 'א', en: 'a' }, explanation: { he: 'א', en: 'a' }, source: 'original',
    });
    if (item.type !== 'order') throw new Error();
    expect(orderTokens(item)).toEqual(['Yesterday', 'I', 'went', 'to', 'the', 'park']);
    const { bareToken } = await import('./answerCheck');
    expect(bareToken('café,')).toBe('café');
    expect(bareToken('"Hello')).toBe('Hello');
    expect(checkOrder(item, ['I', 'went', 'to', 'the', 'park', 'yesterday']).correct).toBe(true);
    expect(checkOrder(item, ['Yesterday', 'I', 'went', 'to', 'the', 'park']).correct).toBe(true);
    expect(checkOrder(item, ['I', 'went', 'yesterday', 'to', 'the', 'park']).correct).toBe(false);
  });
});
