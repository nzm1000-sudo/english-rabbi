import { buildLearnerProfile } from './profile';
import { createStudent } from './student';
import { replay } from '../learning/projection';
import { choiceItem, completedEvent, outcome, typedItem } from '../learning/testUtils';
import { localDay } from '../learning/events';

const DAY = 86_400_000;
const T0 = new Date('2026-09-01T10:00:00').getTime();
const info = () => ({ note: { he: 'מתבלבל/ת בין much ל־many', en: 'n' }, tip: { he: 't', en: 't' } });

describe('learner profile', () => {
  const student = createStudent({ name: 'נועה', goal: { track: 'units-4' } }, 's1', T0);

  it('an untouched student is not assessed and gets a placement recommendation', () => {
    const p = buildLearnerProfile(student, { skills: new Map(), units: new Map(), patterns: new Map() }, [], info, T0, localDay(T0));
    expect(p.calibrated).toBe(false);
    expect(p.domains.every((d) => d.label === 'not-assessed')).toBe(true);
    expect(p.recommendations[0]).toContain('אבחון');
    expect(p.activity.streakDays).toBe(0);
    expect(p.supportLanguage).toBe('he');
  });

  it('reports a separate level per domain, not one global score', () => {
    const events = [];
    let t = T0;
    for (let i = 0; i < 12; i++) {
      t += 60_000;
      events.push(completedEvent('s1', typedItem({ id: `g${i}`, level: 'B2' }), outcome({ responseMs: 9000 }), t));
      t += 60_000;
      events.push(completedEvent('s1', choiceItem({ id: `v${i}`, skill: 'vocabulary.meaning', level: 'A1' }), outcome({ revealed: true, finalCorrect: false }), t));
    }
    const st = replay(events);
    const p = buildLearnerProfile(student, st, [...st.daily.values()], info, t, localDay(t));
    const grammar = p.domains.find((d) => d.domain === 'grammar')!;
    const vocab = p.domains.find((d) => d.domain === 'vocabulary')!;
    expect(grammar.theta).toBeGreaterThan(vocab.theta + 1);
    expect(vocab.label).toBe('needs-work');
    expect(grammar.target).toBe('B1');
  });

  it('turns repeated mistakes into memory notes', () => {
    const wrong = outcome({ attempts: [{ answer: 'b', correct: false, misconception: 'quantifiers.much-many', atMs: 1 }, { answer: 'a', correct: true, atMs: 2 }], hintsUsed: 1 });
    const st = replay([completedEvent('s1', choiceItem(), wrong, T0), completedEvent('s1', choiceItem(), wrong, T0 + 1000)]);
    const p = buildLearnerProfile(student, st, [], info, T0 + 2000, localDay(T0));
    expect(p.memory.map((m) => m.misconceptionId)).toEqual(['quantifiers.much-many']);
    expect(p.recommendations.join(' ')).toContain('much');
  });

  it('counts the learning streak in days', () => {
    const daily = [0, 1, 2, 4].map((ago) => ({ day: localDay(T0 - ago * DAY), activeMs: 300_000, itemsCompleted: 5, cleanFirstTry: 3, xp: 40 }));
    const p = buildLearnerProfile(student, { skills: new Map(), units: new Map(), patterns: new Map() }, daily, info, T0, localDay(T0));
    expect(p.activity.streakDays).toBe(3);
    expect(p.activity.activeDaysLast7).toBe(4);
    expect(p.activity.minutesLast7).toBe(20);
    expect(p.activity.week).toHaveLength(7);
  });

  it('keeps a streak alive during the current day before practice', () => {
    const daily = [1, 2].map((ago) => ({ day: localDay(T0 - ago * DAY), activeMs: 60_000, itemsCompleted: 1, cleanFirstTry: 1, xp: 10 }));
    const p = buildLearnerProfile(student, { skills: new Map(), units: new Map(), patterns: new Map() }, daily, info, T0, localDay(T0));
    expect(p.activity.streakDays).toBe(2);
  });
});
