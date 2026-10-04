import { pickNext, rankCandidates, type SelectionContext } from './selector';
import { newSkillState, type SkillState, type UnitMemory } from './projection';
import { recordMistake } from './memory';
import { newCard, reviewCard } from './srs';
import { choiceItem, typedItem } from './testUtils';

const DAY = 86_400_000;
const NOW = 100 * DAY;

function ctx(over: Partial<SelectionContext>): SelectionContext {
  return {
    now: NOW,
    mode: 'practice',
    items: [],
    skills: new Map(),
    units: new Map(),
    patterns: new Map(),
    interests: [],
    recent: [],
    ...over,
  };
}

function skill(id: string, mu: number, variance = 0.2, evidence = 10): SkillState {
  return { ...newSkillState(id, mu), variance, evidence, updatedAt: NOW };
}

function unit(u: string, dueOffsetDays: number): UnitMemory {
  let card = newCard(NOW - 30 * DAY);
  card = reviewCard(card, 'good', NOW - 30 * DAY);
  card = { ...card, due: NOW + dueOffsetDays * DAY, scheduled_days: 5 };
  return {
    unit: u, card, attempts: 2, successes: 2, firstSeenAt: 0, lastSeenAt: 0, lastScore: 1,
    contexts: [], wrongAnswers: {}, modes: {},
  };
}

describe('adaptive selector', () => {
  const easy = choiceItem({ id: 'easy', level: 'A1', difficulty: 0.2 });
  const right = choiceItem({ id: 'right', level: 'A2', difficulty: 0.5 });
  const hard = choiceItem({ id: 'hard', level: 'C1', difficulty: 0.8 });

  it('prefers items near the target success rate', () => {
    const skills = new Map([['grammar.quantifiers', skill('grammar.quantifiers', 0)]]);
    const ranked = rankCandidates(ctx({ items: [easy, right, hard], skills, targetSuccess: 0.75 }));
    expect(ranked[0]!.item.id).toBe('right');
    expect(ranked.at(-1)!.item.id).toBe('hard');
  });

  it('never repeats an item from this session', () => {
    const r = rankCandidates(ctx({ items: [easy, right], recent: ['right'] }));
    expect(r.map((c) => c.item.id)).toEqual(['easy']);
  });

  it('puts due reviews ahead of items that are not due', () => {
    const a = choiceItem({ id: 'a', unit: 'word:a' });
    const b = choiceItem({ id: 'b', unit: 'word:b' });
    const units = new Map([['word:a', unit('word:a', 20)], ['word:b', unit('word:b', -3)]]);
    const ranked = rankCandidates(ctx({ items: [a, b], units }));
    expect(ranked[0]!.item.id).toBe('b');
    expect(ranked[0]!.reasons.some((r) => r === 'due-review' || r === 'overdue')).toBe(true);
  });

  it('boosts items that target an active mistake pattern', () => {
    const plain = choiceItem({ id: 'plain', options: [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }] });
    const targeted = choiceItem({ id: 'targeted' });
    let p = recordMistake(undefined, 'quantifiers.much-many', { itemId: 'z', answer: 'b', at: NOW - 1000 });
    p = recordMistake(p, 'quantifiers.much-many', { itemId: 'z', answer: 'b', at: NOW - 500 });
    const ranked = rankCandidates(ctx({ items: [plain, targeted], patterns: new Map([[p.misconceptionId, p]]) }));
    expect(ranked[0]!.item.id).toBe('targeted');
    expect(ranked[0]!.reasons).toContain('repeated-mistake');
  });

  it('holds back skills whose prerequisite is clearly weak', () => {
    const pp = typedItem({ id: 'pp', skill: 'grammar.present-perfect', level: 'B1' });
    const ps = typedItem({ id: 'ps', skill: 'grammar.present-simple', level: 'B1' });
    const skills = new Map([
      ['grammar.past-simple', skill('grammar.past-simple', -3)],
      ['grammar', skill('grammar', 0)],
    ]);
    const ranked = rankCandidates(ctx({ items: [pp, ps], skills }));
    expect(ranked[0]!.item.id).toBe('ps');
    expect(ranked.find((c) => c.item.id === 'pp')!.reasons).toContain('prerequisite-gap');
  });

  it('placement mode targets uncertain skills at ~50% success', () => {
    const vocab = choiceItem({ id: 'v', skill: 'vocabulary.meaning', level: 'A2' });
    const gram = choiceItem({ id: 'g', skill: 'grammar.quantifiers', level: 'A2' });
    const skills = new Map([['grammar', skill('grammar', -1, 0.1)], ['grammar.quantifiers', skill('grammar.quantifiers', -1, 0.1)]]);
    const ranked = rankCandidates(ctx({ mode: 'placement', items: [vocab, gram], skills }));
    expect(ranked[0]!.item.id).toBe('v');
  });

  it('boosts items matching student interests', () => {
    const a = choiceItem({ id: 'a', unit: 'u:a' });
    const b = choiceItem({ id: 'b', unit: 'u:b', interests: ['music'] });
    expect(rankCandidates(ctx({ items: [a, b], interests: ['music'] }))[0]!.item.id).toBe('b');
  });

  it('prefers producing an answer over recognising it at the same difficulty', () => {
    const skills = new Map([['grammar.quantifiers', skill('grammar.quantifiers', 0)]]);
    const pick = choiceItem({ id: 'pick', unit: 'u:pick', difficulty: 0.5 });
    const write = typedItem({ id: 'write', unit: 'u:write', skill: 'grammar.quantifiers', difficulty: 0.5 });
    expect(rankCandidates(ctx({ items: [pick, write], skills }))[0]!.item.id).toBe('write');
  });

  it('lowers an often repeated item only while its skill still has unseen ones', () => {
    const old = choiceItem({ id: 'old', unit: 'u:old' });
    const fresh = choiceItem({ id: 'fresh', unit: 'u:fresh' });
    const worn = unit('u:old', -1);
    const units = new Map([['u:old', { ...worn, card: { ...worn.card, reps: 6 } }]]);
    const alone = rankCandidates(ctx({ items: [old], units }))[0]!.score;
    const withNew = rankCandidates(ctx({ items: [old, fresh], units })).find((c) => c.item.id === 'old')!.score;
    expect(withNew).toBeLessThan(alone);
  });

  it('skips items without auto-scoring and returns null when nothing is left', () => {
    expect(pickNext(ctx({ items: [] }))).toBeNull();
  });
});
