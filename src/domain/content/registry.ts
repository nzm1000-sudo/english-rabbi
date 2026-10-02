import { domainOf, isKnownSkill, lineage, type Domain, type SkillId } from '../skills/taxonomy';
import {
  ContentItem,
  ContentPack,
  Lesson,
  Misconception,
  Passage,
  Source,
  unitOf,
  type ContentItem as Item,
  type Lesson as LessonT,
  type Misconception as MisconceptionT,
  type Passage as PassageT,
  type Source as SourceT,
} from './schema';

export interface LoadIssue {
  packId: string;
  id: string;
  severity: 'error' | 'quarantined';
  reason: string;
}

export interface ContentRegistry {
  items: readonly Item[];
  passages: ReadonlyMap<string, PassageT>;
  sources: ReadonlyMap<string, SourceT>;
  misconceptions: ReadonlyMap<string, MisconceptionT>;
  lessons: ReadonlyMap<string, LessonT>;
  /** Lessons for a skill, or for its nearest ancestor that has one. */
  lessonsForSkill(skill: SkillId): LessonT[];
  /** Items that are valid but blocked from students (licensing). */
  quarantined: readonly Item[];
  issues: readonly LoadIssue[];
  getItem(id: string): Item | undefined;
  byDomain(domain: Domain): Item[];
  bySkill(skill: SkillId): Item[];
  itemsForUnit(unit: string): Item[];
}

export interface RawContent {
  packs: unknown[];
  sources: unknown[];
  misconceptions: unknown[];
}

/**
 * Builds the registry from raw JSON. Validation is per item: one broken item
 * is reported and skipped, the rest of the pack still loads.
 */
export function buildRegistry(raw: RawContent): ContentRegistry {
  const issues: LoadIssue[] = [];

  const sources = new Map<string, SourceT>();
  for (const s of raw.sources) {
    const r = Source.safeParse(s);
    if (r.success) sources.set(r.data.id, r.data);
    else issues.push({ packId: 'sources', id: idOf(s), severity: 'error', reason: r.error.message });
  }

  const misconceptions = new Map<string, MisconceptionT>();
  for (const m of raw.misconceptions) {
    const r = Misconception.safeParse(m);
    if (r.success && misconceptions.has(r.data.id)) {
      issues.push({ packId: 'misconceptions', id: r.data.id, severity: 'error', reason: 'duplicate misconception id' });
    } else if (r.success) misconceptions.set(r.data.id, r.data);
    else issues.push({ packId: 'misconceptions', id: idOf(m), severity: 'error', reason: r.error.message });
  }

  const passages = new Map<string, PassageT>();
  const lessons = new Map<string, LessonT>();
  const items: Item[] = [];
  const quarantined: Item[] = [];
  const seen = new Set<string>();

  for (const rawPack of raw.packs) {
    const packRes = ContentPack.safeParse(rawPack);
    if (!packRes.success) {
      issues.push({ packId: idOf(rawPack, 'packId'), id: '*', severity: 'error', reason: packRes.error.message });
      continue;
    }
    const pack = packRes.data;

    for (const p of pack.passages) {
      const r = Passage.safeParse(p);
      if (!r.success) {
        issues.push({ packId: pack.packId, id: idOf(p), severity: 'error', reason: r.error.message });
        continue;
      }
      const src = sources.get(r.data.source);
      if (!src || src.status !== 'approved') {
        issues.push({ packId: pack.packId, id: r.data.id, severity: 'quarantined', reason: `source "${r.data.source}" not approved` });
        continue;
      }
      passages.set(r.data.id, r.data);
    }

    for (const l of pack.lessons) {
      const r = Lesson.safeParse(l);
      if (!r.success) {
        issues.push({ packId: pack.packId, id: idOf(l), severity: 'error', reason: r.error.message });
        continue;
      }
      if (!isKnownSkill(r.data.skill)) {
        issues.push({ packId: pack.packId, id: r.data.id, severity: 'error', reason: `unknown skill "${r.data.skill}"` });
        continue;
      }
      if (lessons.has(r.data.id)) {
        issues.push({ packId: pack.packId, id: r.data.id, severity: 'error', reason: 'duplicate lesson id' });
        continue;
      }
      const src = sources.get(r.data.source);
      if (!src || src.status !== 'approved') {
        issues.push({ packId: pack.packId, id: r.data.id, severity: 'quarantined', reason: `source "${r.data.source}" not approved` });
        continue;
      }
      lessons.set(r.data.id, r.data);
    }

    for (const it of pack.items) {
      const r = ContentItem.safeParse(it);
      if (!r.success) {
        issues.push({ packId: pack.packId, id: idOf(it), severity: 'error', reason: r.error.message });
        continue;
      }
      const item = r.data;
      const problem = checkReferences(item, { sources, misconceptions, passages, seen });
      if (problem) {
        issues.push({ packId: pack.packId, id: item.id, severity: problem.severity, reason: problem.reason });
        if (problem.severity === 'quarantined') quarantined.push(item);
        continue;
      }
      seen.add(item.id);
      items.push(item);
    }
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  const bySkillIdx = groupBy(items, (i) => i.skill);
  const byDomainIdx = groupBy(items, (i) => domainOf(i.skill));
  const byUnitIdx = groupBy(items, (i) => unitOf(i));

  const lessonsBySkill = groupBy([...lessons.values()], (l) => l.skill);
  return {
    items,
    passages,
    lessons,
    lessonsForSkill: (skill) => {
      for (const id of lineage(skill)) {
        const ls = lessonsBySkill.get(id);
        if (ls?.length) return ls;
      }
      return [];
    },
    sources,
    misconceptions,
    quarantined,
    issues,
    getItem: (id) => byId.get(id),
    byDomain: (d) => byDomainIdx.get(d) ?? [],
    bySkill: (s) => bySkillIdx.get(s) ?? [],
    itemsForUnit: (u) => byUnitIdx.get(u) ?? [],
  };
}

function checkReferences(
  item: Item,
  ctx: {
    sources: Map<string, SourceT>;
    misconceptions: Map<string, MisconceptionT>;
    passages: Map<string, PassageT>;
    seen: Set<string>;
  },
): { severity: LoadIssue['severity']; reason: string } | null {
  if (ctx.seen.has(item.id)) return { severity: 'error', reason: 'duplicate id' };
  if (!isKnownSkill(item.skill)) return { severity: 'error', reason: `unknown skill "${item.skill}"` };
  for (const s of item.alsoSkills) {
    if (!isKnownSkill(s.id)) return { severity: 'error', reason: `unknown skill "${s.id}"` };
  }
  const mids = [
    ...item.targetsMisconceptions,
    ...(item.type === 'choice' ? item.options.flatMap((o) => (o.misconception ? [o.misconception] : [])) : []),
    ...(item.type === 'typed' ? item.knownErrors.flatMap((e) => (e.misconception ? [e.misconception] : [])) : []),
  ];
  for (const m of mids) {
    if (!ctx.misconceptions.has(m)) return { severity: 'error', reason: `unknown misconception "${m}"` };
  }
  if (item.passageId && !ctx.passages.has(item.passageId)) {
    return { severity: 'error', reason: `unknown or blocked passage "${item.passageId}"` };
  }
  const src = ctx.sources.get(item.source);
  if (!src) return { severity: 'quarantined', reason: `unknown source "${item.source}"` };
  if (src.status !== 'approved') return { severity: 'quarantined', reason: `source "${src.id}" is ${src.status}` };
  return null;
}

function idOf(x: unknown, key = 'id'): string {
  if (x && typeof x === 'object' && key in x) return String((x as Record<string, unknown>)[key]);
  return '?';
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}
