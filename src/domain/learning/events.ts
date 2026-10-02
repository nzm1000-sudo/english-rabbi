/**
 * Raw learning events. Append-only. Never edited or deleted.
 *
 * Derived state (skill states, unit memories, mistake patterns, daily stats)
 * is a projection of these events and can be rebuilt from them at any time,
 * for example after improving the scoring model.
 *
 * `item.completed` is the only event the projection reads. It carries a
 * snapshot of the item parameters at answer time, so replay does not depend
 * on the content pack still containing the item in the same form.
 */

export type InteractionKind = 'choice' | 'typed' | 'open-writing';

export interface AttemptRecord {
  /** Option id for choice items, typed text for typed items. */
  answer: string;
  correct: boolean;
  /** Misconception detected by this wrong answer, if any. */
  misconception?: string;
  /** True if the typed answer was a near miss (spelling). */
  nearMiss?: boolean;
  atMs: number;
}

export interface ItemOutcome {
  finalCorrect: boolean;
  attempts: AttemptRecord[];
  hintsUsed: number;
  explanationShown: boolean;
  revealed: boolean;
  skipped: boolean;
  /** Time from presentation to the final answer. */
  responseMs: number;
  /** Times the learner changed the selected option before submitting. */
  answerChanges: number;
  /** "Listen again" presses. Never counted against the learner. */
  replays: number;
}

export interface ItemSnapshot {
  itemId: string;
  itemVersion: number;
  unit: string;
  /** Skills with evidence weights. The primary skill has weight 1. */
  skills: { id: string; weight: number }[];
  /** Difficulty on the logit scale. */
  b: number;
  /** Guess probability. */
  c: number;
  interaction: InteractionKind;
  modality: 'read' | 'listen';
  estimatedMs: number;
  /** Misconceptions this item can repair when answered correctly. */
  targetsMisconceptions: string[];
  word?: string;
}

export interface ItemCompletedPayload {
  item: ItemSnapshot;
  outcome: ItemOutcome;
  /** Local calendar day "YYYY-MM-DD" at completion. */
  day: string;
  /** Ability prediction before answering, kept for analytics. */
  predicted?: number;
}

export interface EventMap {
  'student.created': { name: string };
  'student.updated': { fields: string[] };
  'student.archived': Record<string, never>;
  'session.started': { mode: string; domain?: string };
  'session.ended': { completed: number; durationMs: number; reason: 'finished' | 'left' };
  'item.presented': { itemId: string; reasons?: string[] };
  'item.attempted': { itemId: string; attempt: AttemptRecord };
  'item.hint': { itemId: string; level: number };
  'item.explanation': { itemId: string };
  'item.revealed': { itemId: string };
  'item.skipped': { itemId: string };
  'item.completed': ItemCompletedPayload;
  'audio.played': { text: string; replay: boolean; provider: string };
}

export type EventType = keyof EventMap;

export interface LearningEvent<T extends EventType = EventType> {
  /** Time-sortable unique id. */
  id: string;
  studentId: string;
  at: number;
  type: T;
  sessionId?: string;
  payload: EventMap[T];
}

let lastMs = 0;
let counter = 0;

/**
 * Monotonic, lexicographically sortable id: 9 base-36 chars of time,
 * 4 of a per-ms counter, 6 random. Safe for future merge/sync across devices.
 */
export function newEventId(now = Date.now()): string {
  if (now <= lastMs) {
    now = lastMs;
    counter++;
  } else {
    lastMs = now;
    counter = 0;
  }
  const t = now.toString(36).padStart(9, '0');
  const c = counter.toString(36).padStart(4, '0');
  const r = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  return `${t}${c}${r}`;
}

export function localDay(at: number): string {
  const d = new Date(at);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
