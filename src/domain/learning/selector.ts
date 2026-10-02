import { itemTheta } from '../skills/cefr';
import { domainOf, getSkill, lineage } from '../skills/taxonomy';
import { unitOf, type ContentItem } from '../content/schema';
import type { Interest } from '../student/student';
import { applyDrift, expectedSuccess, priorAbility, type AbilityState } from './ability';
import { masteryProbability } from './mastery';
import { isActive, type MistakePattern } from './memory';
import type { SkillState, UnitMemory } from './projection';
import { isDue, retrievability } from './srs';
import type { ItemSnapshot } from './events';

/**
 * Adaptive item selection.
 *
 * Picks the exercise with the highest learning value for this student right
 * now. Every candidate gets a score built from explicit factors, and the
 * factors are returned as reasons so the choice can be explained and tested.
 *
 * Practice mode aims at ~75% predicted success ("desirable difficulty"),
 * prefers due reviews, weak skills and active mistake patterns.
 * Placement mode aims at ~50% success on the least-known skills, which is
 * where one answer tells us the most.
 */
export type SelectionMode = 'practice' | 'placement';

export type Reason =
  | 'due-review'
  | 'overdue'
  | 'new-material'
  | 'weak-skill'
  | 'repeated-mistake'
  | 'interest'
  | 'good-difficulty'
  | 'uncertain-skill'
  | 'prerequisite-gap'
  | 'recently-seen';

export interface SelectionContext {
  now: number;
  mode: SelectionMode;
  items: readonly ContentItem[];
  skills: ReadonlyMap<string, SkillState>;
  units: ReadonlyMap<string, UnitMemory>;
  patterns: ReadonlyMap<string, MistakePattern>;
  interests: readonly Interest[];
  /** Item ids presented in this session, oldest first. */
  recent: readonly string[];
  targetSuccess?: number;
}

export interface Candidate {
  item: ContentItem;
  score: number;
  predicted: number;
  reasons: Reason[];
}

const RECENT_UNIT_WINDOW = 3;

export function guessChance(item: ContentItem): number {
  return item.type === 'choice' ? 1 / item.options.length : 0;
}

export function difficultyOf(item: ContentItem): number {
  return itemTheta(item.level, item.difficulty);
}

/** Best current belief for a skill: its own state, else the nearest known ancestor, else the prior. */
export function abilityFor(skillId: string, skills: ReadonlyMap<string, SkillState>, now: number): AbilityState {
  for (const id of lineage(skillId)) {
    const s = skills.get(id);
    if (s && s.evidence > 0) {
      const drifted = applyDrift(s, now);
      // Borrowed estimates are less certain than direct ones.
      return id === skillId ? drifted : { ...drifted, variance: Math.min(2.25, drifted.variance + 0.5) };
    }
  }
  return priorAbility();
}

export function predictSuccess(item: ContentItem, skills: ReadonlyMap<string, SkillState>, now: number): number {
  return expectedSuccess(abilityFor(item.skill, skills, now), difficultyOf(item), guessChance(item));
}

export function rankCandidates(ctx: SelectionContext): Candidate[] {
  const recentSet = new Set(ctx.recent);
  const recentUnits = new Set(
    ctx.recent.slice(-RECENT_UNIT_WINDOW).flatMap((id) => {
      const it = ctx.items.find((i) => i.id === id);
      return it ? [unitOf(it)] : [];
    }),
  );
  const activeMisconceptions = new Set(
    [...ctx.patterns.values()].filter((p) => isActive(p, ctx.now)).map((p) => p.misconceptionId),
  );
  const recentDomains = ctx.recent.slice(-2).map((id) => {
    const it = ctx.items.find((i) => i.id === id);
    return it ? domainOf(it.skill) : '';
  });

  const out: Candidate[] = [];
  for (const item of ctx.items) {
    if (item.type === 'open-writing') continue; // needs an evaluator; not auto-selected yet
    if (recentSet.has(item.id)) continue;
    const unit = unitOf(item);
    if (recentUnits.has(unit)) continue;

    const reasons: Reason[] = [];
    const ability = abilityFor(item.skill, ctx.skills, ctx.now);
    const predicted = expectedSuccess(ability, difficultyOf(item), guessChance(item));
    const target = ctx.targetSuccess ?? (ctx.mode === 'placement' ? 0.5 : 0.75);
    const fit = Math.exp(-((predicted - target) ** 2) / (2 * 0.15 ** 2));
    if (fit > 0.8) reasons.push('good-difficulty');

    let score: number;
    if (ctx.mode === 'placement') {
      // Information value: uncertain skills first, spread across domains.
      const info = ability.variance;
      score = info * fit;
      if (info > 1.5) reasons.push('uncertain-skill');
      if (recentDomains.includes(domainOf(item.skill))) score *= 0.5;
    } else {
      const mem = ctx.units.get(unit);
      let value: number;
      if (!mem) {
        value = 0.6;
        reasons.push('new-material');
      } else if (isDue(mem.card, ctx.now)) {
        const overdueDays = (ctx.now - mem.card.due) / 86_400_000;
        const ratio = overdueDays / Math.max(1, mem.card.scheduled_days);
        value = 1 + Math.min(0.5, ratio);
        reasons.push(ratio > 0.5 ? 'overdue' : 'due-review');
      } else {
        value = 0.1 + 0.2 * (1 - retrievability(mem.card, ctx.now));
      }

      const mastery = masteryProbability(ability, item.skill);
      const weakness = 1 + 0.6 * (1 - mastery);
      if (mastery < 0.5 && (ctx.skills.get(item.skill)?.evidence ?? 0) >= 1) reasons.push('weak-skill');

      score = value * fit * weakness;
    }

    const misconceptions = itemMisconceptions(item);
    if (misconceptions.some((m) => activeMisconceptions.has(m))) {
      score *= 1.6;
      reasons.push('repeated-mistake');
    }

    if (item.interests.some((i) => ctx.interests.includes(i))) {
      score *= 1.15;
      reasons.push('interest');
    }

    const gap = prerequisiteGap(item.skill, ctx.skills, ctx.now);
    if (gap > 0) {
      score *= 1 - 0.7 * gap;
      reasons.push('prerequisite-gap');
    }

    out.push({ item, score, predicted, reasons });
  }

  return out.sort((a, b) => b.score - a.score || (a.item.id < b.item.id ? -1 : 1));
}

/**
 * Picks the next item. With an rng, picks randomly among near-best candidates
 * (within 10% of the top score) so sessions do not feel scripted.
 */
export function pickNext(ctx: SelectionContext, rng?: () => number): Candidate | null {
  const ranked = rankCandidates(ctx);
  if (!ranked.length) return null;
  if (!rng) return ranked[0]!;
  const top = ranked[0]!.score;
  const near = ranked.filter((c) => c.score >= top * 0.9).slice(0, 4);
  return near[Math.floor(rng() * near.length)] ?? ranked[0]!;
}

export function itemMisconceptions(item: ContentItem): string[] {
  const ids = [...item.targetsMisconceptions];
  if (item.type === 'choice') for (const o of item.options) if (o.misconception) ids.push(o.misconception);
  if (item.type === 'typed') for (const e of item.knownErrors) if (e.misconception) ids.push(e.misconception);
  if (item.type === 'order') for (const d of item.distractors) if (d.misconception) ids.push(d.misconception);
  return [...new Set(ids)];
}

/**
 * 0 = prerequisites are fine or unknown, 1 = a prerequisite is clearly weak.
 * Unknown prerequisites give a small gap so basics are preferred early on.
 */
function prerequisiteGap(skillId: string, skills: ReadonlyMap<string, SkillState>, now: number): number {
  const pre = getSkill(skillId)?.prerequisites ?? [];
  let gap = 0;
  for (const p of pre) {
    const s = skills.get(p);
    if (!s || s.evidence < 1) {
      gap = Math.max(gap, 0.2);
      continue;
    }
    const m = masteryProbability(applyDrift(s, now), p);
    if (m < 0.5) gap = Math.max(gap, (0.5 - m) * 2);
  }
  return Math.min(1, gap);
}

export function snapshotItem(item: ContentItem): ItemSnapshot {
  const skills = [{ id: item.skill, weight: 1 }, ...item.alsoSkills.filter((s) => s.id !== item.skill)];
  return {
    itemId: item.id,
    itemVersion: item.version,
    unit: unitOf(item),
    skills,
    b: difficultyOf(item),
    c: guessChance(item),
    interaction: item.type,
    modality: item.modality,
    estimatedMs: item.estimatedTimeSec * 1000,
    targetsMisconceptions: itemMisconceptions(item),
    ...(item.word ? { word: item.word.lemma } : {}),
  };
}
