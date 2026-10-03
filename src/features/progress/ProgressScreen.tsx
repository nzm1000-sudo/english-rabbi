import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useProfile, useStudent } from '@/app/hooks';
import { TopBar } from '@/ui/TopBar';
import { En } from '@/ui/En';
import { Art } from '@/ui/Art';
import { ButtonLink } from '@/ui/Button';
import { DomainIcon } from '@/ui/DomainIcon';
import { Grid, Stack } from '@/ui/layout';
import { RANKS, achievements, rankOf } from '@/domain/learning/progression';
import { useGameHistory } from '@/features/practice/useGameHistory';
import { domainNameHe, type LearnerProfile } from '@/domain/student/profile';
import { localDay } from '@/domain/learning/events';
import {
  BoltIcon,
  BookIcon,
  CalendarIcon,
  ExamIcon,
  FlagIcon,
  FlameIcon,
  LockIcon,
  MedalIcon,
  RepeatIcon,
  StackIcon,
  StarIcon,
  TargetIcon,
  TrophyIcon,
} from '@/ui/icons';

/** One drawing per achievement, so each one is a landmark. */
const ACH: Record<string, { icon: ReactNode; tone: string }> = {
  'first-steps': { icon: <FlagIcon />, tone: 'grammar' },
  'streak-7': { icon: <FlameIcon size={24} />, tone: 'reading' },
  'streak-30': { icon: <CalendarIcon />, tone: 'writing' },
  'words-50': { icon: <BookIcon />, tone: 'vocabulary' },
  'words-200': { icon: <StackIcon />, tone: 'listening' },
  'mastery-5': { icon: <TargetIcon />, tone: 'games' },
  repair: { icon: <RepeatIcon />, tone: 'grammar' },
  'quiz-perfect': { icon: <TrophyIcon />, tone: 'speaking' },
  'lightning-15': { icon: <BoltIcon />, tone: 'reading' },
  'exam-85': { icon: <ExamIcon />, tone: 'vocabulary' },
  'daily-7': { icon: <StarIcon size={24} />, tone: 'writing' },
  'answers-1000': { icon: <MedalIcon />, tone: 'listening' },
};

/** Learner-facing progress: rank, this week, level per skill, achievements. */
export function ProgressScreen() {
  const { sid } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const games = useGameHistory(student?.id);
  if (!student || !profile) return <main className="screen" />;
  const r = rankOf(profile);
  const ach = achievements(profile, games ?? []);
  const earned = ach.filter((a) => a.earned).length;
  const assessed = profile.domains.filter((d) => d.attempts > 0);
  const base = `/s/${student.id}`;

  return (
    <main className="screen">
      <TopBar back={base} title="ההתקדמות שלי" />

      <section className="rank-card">
        <span className="hero-glow" aria-hidden="true" />
        <div className="rank-top">
          <Stack gap={0} className="grow">
            <span className="hero-eyebrow">
              דרגה <span className="num">{r.current.level}</span> מתוך <span className="num">{RANKS.length}</span>
            </span>
            <h2 className="rank-name">{r.current.he}</h2>
            <En className="rank-en">{r.current.name}</En>
          </Stack>
          <Art name="progress" size={96} tone="hero" fallback={<TrophyIcon />} />
        </div>
        {r.next && (
          <Stack gap={2}>
            <div className="rank-bar" role="progressbar" aria-label="התקדמות לדרגה הבאה" aria-valuenow={Math.round(r.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${Math.max(3, Math.round(r.progress * 100))}%` }} />
            </div>
            <span className="rank-next">
              לדרגה הבאה, {r.next.he}: {r.missing.join(' · ')}
            </span>
          </Stack>
        )}
      </section>
      <p className="small muted txt-center rank-note">דרגה עולה רק כשיש גם נקודות, גם מילים שנזכרות לאורך זמן, וגם מיומנויות בשליטה.</p>

      <Grid cols={3} gap={2}>
        <Stat icon={<FlameIcon size={22} />} value={profile.activity.streakDays} label="ימים ברצף" />
        <Stat icon={<StarIcon size={22} />} value={profile.activity.xpTotal} label="נקודות" />
        <Stat icon={<CalendarIcon size={22} />} value={profile.activity.minutesLast7} label="דקות השבוע" />
      </Grid>

      <WeekStrip profile={profile} goal={student.preferences.dailyGoalMinutes} />

      <Stack as="section" gap={2}>
        <h2 className="section-title">הרמה שלי בכל תחום</h2>
        {assessed.length ? (
          <div className="list">
            {assessed.map((d) => (
              <div key={d.domain} className="list-item">
                <Art name={d.domain as never} size={40} tone={d.domain} fallback={<DomainIcon domain={d.domain} />} />
                <span className="grow t-strong">{domainNameHe(d.domain)}</span>
                <span className="level-chip" lang="en">
                  {d.level ?? '–'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel empty-state compact">
            <Art name="empty" size={88} tone="brand" fallback={<TargetIcon />} />
            <p className="t-strong">עוד אין מספיק תשובות כדי לדעת</p>
            <p className="small muted">אחרי כמה תרגולים תופיע כאן הרמה בכל תחום.</p>
            <ButtonLink to={`${base}/practice/${profile.calibrated ? 'lesson' : 'placement'}`} variant="primary">
              {profile.calibrated ? 'לשיעור של היום' : 'לאבחון הקצר'}
            </ButtonLink>
          </div>
        )}
      </Stack>

      <Stack as="section" gap={2}>
        <div className="spread items-baseline">
          <h2 className="section-title">הישגים</h2>
          <span className="small muted">
            <span className="num">{earned}</span> מתוך <span className="num">{ach.length}</span>
          </span>
        </div>
        <Grid cols={2} gap={3}>
          {ach.map((a) => {
            const look = ACH[a.id] ?? { icon: <MedalIcon />, tone: 'games' };
            return (
              <div key={a.id} className="ach" data-earned={a.earned}>
                <span className={`ach-badge${a.earned ? ` art art-orb orb-${look.tone}` : ''}`} aria-hidden="true">
                  {look.icon}
                  {!a.earned && (
                    <span className="ach-lock">
                      <LockIcon size={14} />
                    </span>
                  )}
                </span>
                <strong>{a.title}</strong>
                <span className="small muted">{a.description}</span>
                <span className="sr-only">{a.earned ? 'הושג' : 'עוד לא הושג'}</span>
              </div>
            );
          })}
        </Grid>
      </Stack>
    </main>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="stat">
      {icon}
      <b className="num">{value}</b>
      <span>{label}</span>
    </div>
  );
}

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

/** This week, one bar per day against the daily goal. */
function WeekStrip({ profile, goal }: { profile: LearnerProfile; goal: number }) {
  const today = localDay(Date.now());
  const any = profile.activity.week.some((d) => d.items > 0);
  return (
    <section className="panel stack gap-3" aria-label="השבוע">
      <div className="spread items-baseline">
        <h2 className="section-title">השבוע</h2>
        <span className="small muted">
          <span className="num">{profile.activity.activeDaysLast7}</span> מתוך <span className="num">7</span> ימים
        </span>
      </div>
      <div className="week">
        {profile.activity.week.map((d) => {
          const pct = Math.min(100, (d.minutes / goal) * 100);
          const letter = DAY_LETTERS[new Date(`${d.day}T12:00:00`).getDay()];
          return (
            <div className={`week-day${d.day === today ? ' today' : ''}`} key={d.day} title={`${d.minutes} דקות`}>
              <div className="week-bar" data-goal={pct >= 100}>
                <span style={{ height: `${d.items ? Math.max(12, pct) : 0}%` }} />
              </div>
              {letter}
            </div>
          );
        })}
      </div>
      {!any && <p className="small muted txt-center">עוד אין תרגול השבוע. כמה דקות היום פותחות את הרצף.</p>}
    </section>
  );
}
