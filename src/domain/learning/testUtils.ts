import { ContentItem, type ContentItem as Item } from '../content/schema';
import type { ItemCompletedPayload, ItemOutcome, LearningEvent } from './events';
import { localDay, newEventId } from './events';
import { snapshotItem } from './selector';

const bi = (s: string) => ({ he: s, en: s });

export function choiceItem(over: Record<string, unknown> = {}): Item {
  return ContentItem.parse({
    id: 'test.choice',
    type: 'choice',
    skill: 'grammar.quantifiers',
    level: 'A2',
    instruction: bi('Choose'),
    explanation: bi('Because'),
    hints: [bi('h1'), bi('h2')],
    prompt: 'How ___ water?',
    options: [
      { id: 'a', text: 'much' },
      { id: 'b', text: 'many', misconception: 'quantifiers.much-many' },
    ],
    correctOptionId: 'a',
    source: 'original',
    ...over,
  });
}

export function typedItem(over: Record<string, unknown> = {}): Item {
  return ContentItem.parse({
    id: 'test.typed',
    type: 'typed',
    skill: 'grammar.past-simple.irregular',
    level: 'A2',
    instruction: bi('Write'),
    explanation: bi('Because'),
    prompt: 'Yesterday I ___ to school. (go)',
    answers: ['went'],
    knownErrors: [{ answer: 'goed', misconception: 'past-simple.overregularization', feedback: bi('irregular') }],
    source: 'original',
    ...over,
  });
}

export function outcome(over: Partial<ItemOutcome> = {}): ItemOutcome {
  return {
    finalCorrect: true,
    attempts: [{ answer: 'a', correct: true, atMs: 5000 }],
    hintsUsed: 0,
    explanationShown: false,
    revealed: false,
    skipped: false,
    responseMs: 8000,
    answerChanges: 0,
    replays: 0,
    ...over,
  };
}

export function completedEvent(
  studentId: string,
  item: Item,
  o: ItemOutcome,
  at: number,
  extra: Partial<ItemCompletedPayload> = {},
): LearningEvent<'item.completed'> {
  return {
    id: newEventId(at),
    studentId,
    at,
    type: 'item.completed',
    payload: { item: snapshotItem(item), outcome: o, day: localDay(at), ...extra },
  };
}
