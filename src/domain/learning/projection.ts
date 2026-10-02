import { lineage } from '../skills/taxonomy';
import { priorAbility, updateAbility, type AbilityState } from './ability';
import { toEvidence, type Evidence } from './evidence';
import type { ItemCompletedPayload, LearningEvent } from './events';
import type { HistoryPoint } from './mastery';
import { recordMistake, recordRepair, type MistakePattern } from './memory';
import { newCard, reviewCard, type StoredCard } from './srs';

/**
 * Projection: folds an `item.completed` event into derived learner state.
 *
 * Pure. The database layer reads the affected records, calls
 * `projectCompletion`, and writes the result in one transaction. `replay`
 * runs the same function over a full event log in memory. Tests assert both
 * paths give identical state.
 */

export interface SkillState extends AbilityState {
  skillId: string;
  attempts: number;
  successes: number;
  history: HistoryPoint[];
}

export interface UnitMemory {
  unit: string;
  card: StoredCard;
  word?: string;
  attempts: number;
  successes: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastScore: number;
  /** Item ids this unit was practiced through (latest last). */
  contexts: string[];
  /** Wrong answers and how often they were given. */
  wrongAnswers: Record<string, number>;
  /** Per-skill counts, e.g. recognition vs recall of the same word. */
  modes: Record<string, { attempts: number; successes: number }>;
}

export interface DailyStat {
  day: string;
  activeMs: number;
  itemsCompleted: number;
  cleanFirstTry: number;
  xp: number;
}

export interface CompletionInput {
  event: LearningEvent<'item.completed'>;
  skills: Record<string, SkillState | undefined>;
  unit: UnitMemory | undefined;
  patterns: Record<string, MistakePattern | undefined>;
  daily: DailyStat | undefined;
}

export interface CompletionResult {
  evidence: Evidence;
  skills: SkillState[];
  unit: UnitMemory;
  patterns: MistakePattern[];
  daily: DailyStat;
}

/** Root prior when nothing is known: between A2 and B1. */
export const ROOT_PRIOR_MU = -0.5;
const ANCESTOR_DECAY = 0.6;
const HISTORY_MAX = 120;
const MAX_CONTEXTS = 10;
const MAX_WRONG_KEYS = 12;
const MAX_ACTIVE_MS_PER_ITEM = 120_000;

/** Skill ids touched by an item, with the evidence weight for each. */
export function affectedSkills(p: ItemCompletedPayload): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of p.item.skills) {
    lineage(s.id).forEach((id, depth) => {
      const w = s.weight * Math.pow(ANCESTOR_DECAY, depth);
      out.set(id, Math.max(out.get(id) ?? 0, w));
    });
  }
  return out;
}

/** Misconceptions affected: [mistakes made, misconceptions repaired]. */
export function affectedMisconceptions(p: ItemCompletedPayload): { mistakes: string[]; repaired: string[] } {
  const mistakes = unique(p.outcome.attempts.flatMap((a) => (a.misconception && !a.correct ? [a.misconception] : [])));
  const cleanSuccess = p.outcome.finalCorrect && !p.outcome.revealed && p.outcome.attempts.length === 1 && p.outcome.hintsUsed === 0;
  const repaired = cleanSuccess ? p.item.targetsMisconceptions.filter((m) => !mistakes.includes(m)) : [];
  return { mistakes, repaired };
}

export function projectCompletion(input: CompletionInput): CompletionResult {
  const { event } = input;
  const p = event.payload;
  const at = event.at;
  const evidence = toEvidence(p.item, p.outcome, p.predicted);

  // Skills. A sub-skill seen for the first time starts from its nearest
  // ancestor's estimate as it was before this answer (no double counting).
  const weights = affectedSkills(p);
  const updated = new Map<string, SkillState>();
  for (const id of weights.keys()) {
    const prev = input.skills[id] ?? newSkillState(id, parentEstimate(id, input.skills));
    const w = (weights.get(id) ?? 0) * evidence.weight;
    const ability = updateAbility(prev, { b: p.item.b, c: p.item.c, score: evidence.score, weight: w, at });
    const success = evidence.score >= 0.5 ? 1 : 0;
    updated.set(id, {
      ...prev,
      ...ability,
      attempts: prev.attempts + (p.outcome.skipped ? 0 : 1),
      successes: prev.successes + (p.outcome.skipped ? 0 : success),
      history: pushHistory(prev.history, p.day, ability.mu),
    });
  }

  // Unit memory and spaced repetition.
  const unitPrev = input.unit ?? newUnit(p, at);
  const card = evidence.grade ? reviewCard(unitPrev.card, evidence.grade, at) : unitPrev.card;
  const wrong = { ...unitPrev.wrongAnswers };
  for (const a of p.outcome.attempts) {
    if (!a.correct) wrong[a.answer] = (wrong[a.answer] ?? 0) + 1;
  }
  const mode = unitPrev.modes[p.item.skills[0]?.id ?? 'unknown'] ?? { attempts: 0, successes: 0 };
  const succeeded = !p.outcome.skipped && evidence.score >= 0.5;
  const unit: UnitMemory = {
    ...unitPrev,
    card,
    attempts: unitPrev.attempts + (p.outcome.skipped ? 0 : 1),
    successes: unitPrev.successes + (succeeded ? 1 : 0),
    lastSeenAt: at,
    lastScore: evidence.score,
    contexts: [...unitPrev.contexts.filter((c) => c !== p.item.itemId), p.item.itemId].slice(-MAX_CONTEXTS),
    wrongAnswers: trimCounts(wrong, MAX_WRONG_KEYS),
    modes: {
      ...unitPrev.modes,
      [p.item.skills[0]?.id ?? 'unknown']: {
        attempts: mode.attempts + (p.outcome.skipped ? 0 : 1),
        successes: mode.successes + (succeeded ? 1 : 0),
      },
    },
  };

  // Mistake patterns.
  const { mistakes, repaired } = affectedMisconceptions(p);
  const patterns: MistakePattern[] = [];
  for (const m of mistakes) {
    const attempt = p.outcome.attempts.find((a) => a.misconception === m);
    patterns.push(recordMistake(input.patterns[m], m, { itemId: p.item.itemId, answer: attempt?.answer ?? '', at }));
  }
  for (const m of repaired) {
    const prev = input.patterns[m];
    if (prev) patterns.push(recordRepair(prev, at));
  }

  // Daily stats.
  const d = input.daily ?? { day: p.day, activeMs: 0, itemsCompleted: 0, cleanFirstTry: 0, xp: 0 };
  const daily: DailyStat = {
    day: p.day,
    activeMs: d.activeMs + Math.min(p.outcome.responseMs, MAX_ACTIVE_MS_PER_ITEM),
    itemsCompleted: d.itemsCompleted + (p.outcome.skipped ? 0 : 1),
    cleanFirstTry: d.cleanFirstTry + (evidence.flags.includes('clean') || evidence.flags.includes('fast') ? 1 : 0),
    xp: d.xp + evidence.xp,
  };

  return { evidence, skills: [...updated.values()], unit, patterns, daily };
}

export interface ReplayState {
  skills: Map<string, SkillState>;
  units: Map<string, UnitMemory>;
  patterns: Map<string, MistakePattern>;
  daily: Map<string, DailyStat>;
}

export function emptyReplayState(): ReplayState {
  return { skills: new Map(), units: new Map(), patterns: new Map(), daily: new Map() };
}

/** Rebuilds derived state from events, in id order. */
export function replay(events: LearningEvent[], state = emptyReplayState()): ReplayState {
  const sorted = [...events].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const e of sorted) {
    if (e.type !== 'item.completed') continue;
    const ev = e as LearningEvent<'item.completed'>;
    const p = ev.payload;
    const skillIds = [...affectedSkills(p).keys()];
    const { mistakes, repaired } = affectedMisconceptions(p);
    const r = projectCompletion({
      event: ev,
      skills: Object.fromEntries(skillIds.map((id) => [id, state.skills.get(id)])),
      unit: state.units.get(p.item.unit),
      patterns: Object.fromEntries([...mistakes, ...repaired].map((m) => [m, state.patterns.get(m)])),
      daily: state.daily.get(p.day),
    });
    for (const s of r.skills) state.skills.set(s.skillId, s);
    state.units.set(r.unit.unit, r.unit);
    for (const pt of r.patterns) state.patterns.set(pt.misconceptionId, pt);
    state.daily.set(r.daily.day, r.daily);
  }
  return state;
}

export function newSkillState(skillId: string, mu = ROOT_PRIOR_MU): SkillState {
  return { ...priorAbility(mu), skillId, attempts: 0, successes: 0, history: [] };
}

function parentEstimate(id: string, existing: Record<string, SkillState | undefined>): number {
  for (const anc of lineage(id).slice(1)) {
    const s = existing[anc];
    if (s && s.evidence > 0) return s.mu;
  }
  return ROOT_PRIOR_MU;
}

function newUnit(p: ItemCompletedPayload, at: number): UnitMemory {
  return {
    unit: p.item.unit,
    card: newCard(at),
    ...(p.item.word ? { word: p.item.word } : {}),
    attempts: 0,
    successes: 0,
    firstSeenAt: at,
    lastSeenAt: at,
    lastScore: 0,
    contexts: [],
    wrongAnswers: {},
    modes: {},
  };
}

function pushHistory(h: HistoryPoint[], day: string, mu: number): HistoryPoint[] {
  const last = h[h.length - 1];
  const next = last && last.day === day ? [...h.slice(0, -1), { day, mu }] : [...h, { day, mu }];
  return next.slice(-HISTORY_MAX);
}

function trimCounts(m: Record<string, number>, max: number): Record<string, number> {
  const entries = Object.entries(m);
  if (entries.length <= max) return m;
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, max));
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
