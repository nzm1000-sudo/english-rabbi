import { confidence } from '../learning/ability';
import { thetaToLevel, levelCenter, type CefrLevel } from '../skills/cefr';
import { DOMAINS, getSkill, type Domain } from '../skills/taxonomy';
import { trackTarget } from '../curriculum/israel';
import { masteryProbability, masteryStatus, parentLabel, trend, type MasteryStatus, type ParentLabel, type Trend } from '../learning/mastery';
import { decayedScore, isActive } from '../learning/memory';
import { isDue, retrievability } from '../learning/srs';
import { supportLanguage, type SupportLanguage } from '../learning/languageSupport';
import type { DailyStat } from '../learning/projection';
import type { LearnerStateView } from './types';
import type { Bilingual } from '../content/schema';
import type { Student } from './student';

/**
 * LearnerProfile: everything the app knows about one student, assembled from
 * the stored state. Pure and cheap to compute. Shared by the home screen, the
 * parent dashboard and (later) the AI tutor context.
 */
export interface DomainSummary {
  domain: Domain;
  level: CefrLevel | null;
  theta: number;
  confidence: number;
  status: MasteryStatus;
  label: ParentLabel;
  trend: Trend;
  attempts: number;
  target: CefrLevel;
}

export interface SkillSummary {
  skillId: string;
  name: Bilingual;
  level: CefrLevel;
  mastery: number;
  confidence: number;
  status: MasteryStatus;
  attempts: number;
}

export interface MemoryNote {
  misconceptionId: string;
  note: Bilingual;
  tip: Bilingual;
  count: number;
  lastSeenAt: number;
  strength: number;
}

export interface Activity {
  streakDays: number;
  activeDaysLast7: number;
  activeDaysLast30: number;
  minutesToday: number;
  minutesLast7: number;
  minutesTotal: number;
  itemsTotal: number;
  xpTotal: number;
  lastActiveDay: string | null;
  /** Last 7 days, oldest first. */
  week: { day: string; minutes: number; items: number }[];
}

export interface LearnerProfile {
  student: Student;
  domains: DomainSummary[];
  weakSkills: SkillSummary[];
  strongSkills: SkillSummary[];
  /** Sub-skills at "mastered". */
  masteredCount: number;
  /** Mistake patterns that repeated and were then repaired. */
  repairedPatterns: number;
  words: { learned: string[]; struggling: string[]; due: number; recognizedNotProduced: string[] };
  memory: MemoryNote[];
  activity: Activity;
  overallTheta: number;
  supportLanguage: SupportLanguage;
  /** True once vocabulary and grammar each have a few answers. */
  calibrated: boolean;
  recommendations: string[];
}

export function buildLearnerProfile(
  student: Student,
  state: LearnerStateView,
  daily: DailyStat[],
  misconceptionInfo: (id: string) => { note: Bilingual; tip: Bilingual } | undefined,
  now: number,
  today: string,
): LearnerProfile {
  const domains = DOMAINS.map((d) => summarizeDomain(d, student, state));

  const skillSummaries: SkillSummary[] = [];
  for (const s of state.skills.values()) {
    const node = getSkill(s.skillId);
    if (!node || !s.skillId.includes('.') || s.evidence < 1) continue;
    skillSummaries.push({
      skillId: s.skillId,
      name: node.name,
      level: node.level,
      mastery: masteryProbability(s, s.skillId),
      confidence: confidence(s),
      status: masteryStatus(s, s.skillId),
      attempts: s.attempts,
    });
  }
  const weakSkills = skillSummaries.filter((s) => s.attempts >= 2 && s.mastery < 0.6).sort((a, b) => a.mastery - b.mastery).slice(0, 4);
  const mastered = skillSummaries.filter((s) => s.status === 'mastered');
  const strongSkills = [...mastered].sort((a, b) => b.mastery - a.mastery).slice(0, 4);
  const repairedPatterns = [...state.patterns.values()].filter((p) => p.count >= 2 && p.repairStreak >= 3).length;

  const learned: string[] = [];
  const struggling: string[] = [];
  const recognizedNotProduced: string[] = [];
  let due = 0;
  for (const u of state.units.values()) {
    if (isDue(u.card, now)) due++;
    if (!u.word) continue;
    const rate = u.attempts ? u.successes / u.attempts : 0;
    if (u.card.lapses >= 2 || (u.attempts >= 2 && rate < 0.5)) struggling.push(u.word);
    else if (u.successes >= 2 && retrievability(u.card, now) >= 0.7) learned.push(u.word);
    const rec = u.modes['vocabulary.meaning'];
    const prod = u.modes['vocabulary.recall'];
    if (rec && prod && rec.successes / rec.attempts >= 0.8 && prod.attempts >= 1 && prod.successes / prod.attempts < 0.5) {
      recognizedNotProduced.push(u.word);
    }
  }

  const memory: MemoryNote[] = [];
  for (const p of state.patterns.values()) {
    if (!isActive(p, now)) continue;
    const info = misconceptionInfo(p.misconceptionId);
    if (!info) continue;
    memory.push({ misconceptionId: p.misconceptionId, ...info, count: p.count, lastSeenAt: p.lastSeenAt, strength: decayedScore(p, now) });
  }
  memory.sort((a, b) => b.strength - a.strength);

  const activity = summarizeActivity(daily, today);
  const assessed = domains.filter((d) => d.attempts > 0);
  const overallTheta = assessed.length ? assessed.reduce((s, d) => s + d.theta, 0) / assessed.length : -0.5;
  // Enough evidence for a first picture: a finished placement (~14 answers
  // spread over all domains) or steady practice in the two core domains.
  const totalAttempts = domains.reduce((s, d) => s + d.attempts, 0);
  const calibrated = totalAttempts >= 10 || ['vocabulary', 'grammar'].every((d) => (state.skills.get(d)?.attempts ?? 0) >= 4);

  const profile: LearnerProfile = {
    student,
    domains,
    weakSkills,
    strongSkills,
    masteredCount: mastered.length,
    repairedPatterns,
    words: { learned, struggling, due, recognizedNotProduced },
    memory,
    activity,
    overallTheta,
    // No evidence yet: start in Hebrew. English grows with measured ability.
    supportLanguage: assessed.length ? supportLanguage(overallTheta) : 'he',
    calibrated,
    recommendations: [],
  };
  profile.recommendations = recommend(profile);
  return profile;
}

const DOMAIN_HE: Record<Domain, string> = {
  vocabulary: 'אוצר מילים',
  grammar: 'דקדוק',
  reading: 'הבנת הנקרא',
  writing: 'כתיבה',
  listening: 'הבנת הנשמע',
  speaking: 'דיבור',
};

function summarizeDomain(domain: Domain, student: Student, state: LearnerStateView): DomainSummary {
  const s = state.skills.get(domain);
  const target: CefrLevel =
    student.goal.targetLevel ?? (student.goal.track !== 'general' ? trackTarget(student.goal.track, domain) : undefined) ?? 'B1';
  const levelB = levelCenter(target);
  if (!s || s.evidence <= 0) {
    return { domain, level: null, theta: -0.5, confidence: 0, status: 'unseen', label: 'not-assessed', trend: 'unknown', attempts: 0, target };
  }
  return {
    domain,
    level: thetaToLevel(s.mu),
    theta: s.mu,
    confidence: confidence(s),
    status: masteryStatus(s, domain, levelB),
    label: parentLabel(s, domain, s.history, levelB),
    trend: trend(s.history),
    attempts: s.attempts,
    target,
  };
}

function summarizeActivity(daily: DailyStat[], today: string): Activity {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const days = (n: number) => Array.from({ length: n }, (_, i) => shiftDay(today, -i));
  const active = (d: string) => (byDay.get(d)?.itemsCompleted ?? 0) > 0;

  let streak = 0;
  // A streak survives until the end of today even if today has no practice yet.
  let cursor = active(today) ? today : shiftDay(today, -1);
  while (active(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  const minutes = (d: string) => Math.round((byDay.get(d)?.activeMs ?? 0) / 60_000);
  const last = [...daily].reverse().find((d) => d.itemsCompleted > 0);
  return {
    streakDays: streak,
    activeDaysLast7: days(7).filter(active).length,
    activeDaysLast30: days(30).filter(active).length,
    minutesToday: minutes(today),
    minutesLast7: days(7).reduce((s, d) => s + minutes(d), 0),
    minutesTotal: Math.round(daily.reduce((s, d) => s + d.activeMs, 0) / 60_000),
    itemsTotal: daily.reduce((s, d) => s + d.itemsCompleted, 0),
    xpTotal: daily.reduce((s, d) => s + d.xp, 0),
    lastActiveDay: last?.day ?? null,
    week: days(7)
      .reverse()
      .map((d) => ({ day: d, minutes: minutes(d), items: byDay.get(d)?.itemsCompleted ?? 0 })),
  };
}

function recommend(p: LearnerProfile): string[] {
  const out: string[] = [];
  if (!p.calibrated) out.push('להשלים אבחון קצר (כ־5 דקות) כדי שהמערכת תכיר את הרמה.');
  for (const m of p.memory.slice(0, 2)) out.push(`לחזק: ${m.note.he}.`);
  const weakest = p.domains
    .filter((d) => d.label === 'needs-work')
    .sort((a, b) => a.theta - b.theta)[0];
  if (weakest) out.push(`להקדיש השבוע יותר זמן ל${DOMAIN_HE[weakest.domain]}.`);
  if (p.words.struggling.length >= 3) out.push(`לחזור על מילים קשות: ${p.words.struggling.slice(0, 5).join(', ')}.`);
  if (p.words.recognizedNotProduced.length) {
    out.push(`מילים שמזהים בקריאה אבל עוד לא כותבים: ${p.words.recognizedNotProduced.slice(0, 4).join(', ')}.`);
  }
  if (p.activity.activeDaysLast7 < 4) out.push('לתרגל לפחות 4 ימים בשבוע, 10 דקות ביום. רצף קצר עדיף על שיעור ארוך אחד.');
  return out.slice(0, 5);
}

export function domainNameHe(d: Domain): string {
  return DOMAIN_HE[d];
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}
