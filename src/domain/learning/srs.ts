import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';

/**
 * Spaced repetition, based on FSRS (ts-fsrs, MIT license).
 * Wrapped so the rest of the app never imports ts-fsrs directly and cards are
 * stored as plain JSON (numbers instead of Date objects).
 */
export interface StoredCard {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: number;
}

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

const GRADE: Record<ReviewGrade, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

// Fuzz off: scheduling must be deterministic so event replay gives identical state.
const scheduler = fsrs({ request_retention: 0.9, maximum_interval: 365, enable_fuzz: false });

export function newCard(now: number): StoredCard {
  return toStored(createEmptyCard(new Date(now)));
}

/** A card still in learning that is answered Hard again after this long has learned enough to graduate. */
const GRADUATE_AFTER_MS = 12 * 60 * 60 * 1000;

export function reviewCard(card: StoredCard, grade: ReviewGrade, now: number): StoredCard {
  // FSRS keeps a learning card on the same short step for every Hard, so a
  // unit that is always "hard but solved" would be due in every session.
  // After a night's gap, a Hard on a learning card counts as Good.
  const learning = card.state === State.Learning || card.state === State.Relearning;
  const gapped = card.last_review !== undefined && now - card.last_review >= GRADUATE_AFTER_MS;
  const g = grade === 'hard' && learning && gapped ? 'good' : grade;
  const next = scheduler.next(toCard(card), new Date(now), GRADE[g]);
  return toStored(next.card);
}

export function isDue(card: StoredCard, now: number): boolean {
  return card.due <= now;
}

export function isNew(card: StoredCard): boolean {
  return card.state === State.New;
}

/** Estimated probability the learner still remembers the unit now. */
export function retrievability(card: StoredCard, now: number): number {
  if (card.state === State.New) return 0;
  return scheduler.get_retrievability(toCard(card), new Date(now), false);
}

function toCard(c: StoredCard): Card {
  return {
    ...c,
    due: new Date(c.due),
    state: c.state as State,
    ...(c.last_review !== undefined ? { last_review: new Date(c.last_review) } : {}),
  } as Card;
}

function toStored(c: Card): StoredCard {
  const out: StoredCard = {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
  };
  if (c.last_review) out.last_review = c.last_review.getTime();
  return out;
}
