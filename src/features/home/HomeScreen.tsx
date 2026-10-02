import { Link, useParams } from 'react-router-dom';
import { useProfile, useStudent } from '@/app/hooks';
import { Avatar } from '@/ui/Avatar';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { Ring } from '@/ui/Ring';
import { DomainIcon } from '@/ui/DomainIcon';
import {
  BoltIcon,
  ChatIcon,
  ChevronIcon,
  ExamIcon,
  FlameIcon,
  GearIcon,
  GymIcon,
  LessonIcon,
  RepeatIcon,
  RiddleIcon,
  StarIcon,
  TargetIcon,
  TrophyIcon,
  GrammarIcon,
  VocabIcon,
} from '@/ui/icons';
import type { DomainSummary, LearnerProfile } from '@/domain/student/profile';
import type { Domain } from '@/domain/skills/taxonomy';
import { rankOf } from '@/domain/learning/progression';
import { useGameHistory } from '@/features/practice/useGameHistory';
import { localDay } from '@/domain/learning/events';
import { levelCenter } from '@/domain/skills/cefr';
import type { ReactNode } from 'react';

const PRACTICE: { domain: Domain; title: string; en: string }[] = [
  { domain: 'vocabulary', title: 'אוצר מילים', en: 'Vocabulary' },
  { domain: 'grammar', title: 'דקדוק', en: 'Grammar' },
  { domain: 'reading', title: 'הבנת הנקרא', en: 'Reading' },
  { domain: 'listening', title: 'הבנת הנשמע', en: 'Listening' },
];

/** Home: one main action, today's goal, skill tiles, games. Symmetric 2-column grids. */
export function HomeScreen() {
  const { sid } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const games = useGameHistory(student?.id);

  if (student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  if (!student || !profile) return <main className="screen" />;

  const p = profile;
  const goal = student.preferences.dailyGoalMinutes;
  const todayPct = Math.min(1, p.activity.minutesToday / goal);
  const focus = p.memory[0];
  const weak = p.weakSkills[0];
  const rank = rankOf(p);
  const today = localDay(Date.now());
  const dailyDone = !!games?.some((g) => g.game === 'daily' && g.day === today);
  const base = `/s/${student.id}`;

  return (
    <main className="screen">
      <header className="spread">
        <Link to="/" className="row" style={{ color: 'inherit', textDecoration: 'none', gap: 10 }} aria-label="החלפת תלמיד">
          <Avatar name={student.name} hue={student.hue} />
          <div style={{ fontSize: 'var(--t-lg)', fontWeight: 700 }}>שלום, {student.name}</div>
        </Link>
        <div className="row" style={{ gap: 6 }}>
          <span className="chip-stat" aria-label={`${p.activity.streakDays} ימים ברצף`}>
            <FlameIcon size={18} />
            {p.activity.streakDays}
          </span>
          <Link to={`${base}/progress`} className="chip-stat" aria-label={`${p.activity.xpTotal} נקודות, דרגה ${rank.current.level}`}>
            <StarIcon size={18} />
            {p.activity.xpTotal}
          </Link>
          <Link to={`${base}/settings`} className="icon-btn" aria-label="הגדרות" style={{ width: 38, height: 38 }}>
            <GearIcon size={20} />
          </Link>
        </div>
      </header>

      <Link to={`${base}/practice/${p.calibrated ? 'lesson' : 'placement'}`} className="hero">
        <div className="grow stack" style={{ gap: 4, position: 'relative' }}>
          <span className="title">{p.calibrated ? 'השיעור של היום' : 'בואו נכיר'}</span>
          <span className="hero-sub">
            {p.calibrated ? 'תרגול שנבנה בדיוק בשבילך' : 'אבחון קצר, כ־5 דקות. מתחילים בינוני ומתאימים את הקושי.'}
          </span>
          <span className="hero-cta">
            {p.calibrated ? 'להתחיל' : 'להתחיל אבחון'}
            <ChevronIcon size={16} />
          </span>
        </div>
        <Ring value={todayPct} size={84} stroke={8}>
          <span>
            {p.activity.minutesToday}
            <small>מתוך {goal} דק׳</small>
          </span>
        </Ring>
      </Link>

      <Link to={`${base}/path`} className="row-card">
        <span className="tile-icon" style={{ background: 'var(--primary-weak)', color: 'var(--primary-fg)' }}>
          <TargetIcon />
        </span>
        <span className="grow">
          <strong>המסלול שלי</strong>
          <span className="xs muted" style={{ display: 'block' }}>
            {rank.current.he} · דרגה {rank.current.level}
            {p.activity.frozenDays > 0 ? ' · מגן הרצף שמר על הרצף' : ''}
          </span>
        </span>
        <ChevronIcon />
      </Link>

      {p.calibrated &&
        (dailyDone ? (
          <div className="row-card tone-games" aria-label="האתגר היומי הושלם">
            <span className="tile-icon" style={{ background: 'var(--good-weak)', color: 'var(--good-ink)' }}>
              <TargetIcon />
            </span>
            <span className="grow">
              <strong>האתגר היומי הושלם</strong>
              <span className="xs muted" style={{ display: 'block' }}>
                מחר מחכה אתגר חדש
              </span>
            </span>
            <span className="badge badge-good">בוצע</span>
          </div>
        ) : (
          <Link to={`${base}/practice/daily`} className="row-card tone-games">
            <span className="tile-icon" style={{ background: 'var(--t-games-weak)', color: 'var(--t-games-fg)' }}>
              <TargetIcon />
            </span>
            <span className="grow">
              <strong>האתגר היומי</strong>
              <span className="xs muted" style={{ display: 'block' }}>
                6 שאלות, חידה אחת בפנים
              </span>
            </span>
            <ChevronIcon />
          </Link>
        ))}

      <section className="stack">
        <div className="section-head">
          <h2>תרגול</h2>
          {p.words.due > 0 && (
            <Link to={`${base}/practice/review`} className="badge badge-accent" style={{ textDecoration: 'none' }}>
              {p.words.due} לחזרה היום
            </Link>
          )}
        </div>
        <div className="grid-2">
          {PRACTICE.map((x) => (
            <SkillTile key={x.domain} to={`${base}/practice/${x.domain}`} d={p.domains.find((d) => d.domain === x.domain)!} title={x.title} en={x.en} />
          ))}
        </div>
      </section>

      <section className="stack">
        <div className="section-head">
          <h2>משחקים ואתגרים</h2>
        </div>
        <div className="grid-2">
          <GameTile to={`${base}/practice/quiz`} tone="games" icon={<TrophyIcon />} title="חידון" sub="10 שאלות, בלי רמזים" />
          <GameTile to={`${base}/practice/lightning`} tone="reading" icon={<BoltIcon />} title="סבב בזק" sub="60 שניות, כמה שיותר" />
          <GameTile to={`${base}/practice/exam`} tone="vocabulary" icon={<ExamIcon />} title="מבחן" sub="בסגנון בגרות" />
          <GameTile to={`${base}/practice/riddles`} tone="listening" icon={<RiddleIcon />} title="חידות" sub="חשיבה באנגלית" />
          <GameTile to={`${base}/practice/mistakes`} tone="writing" icon={<GymIcon />} title="חדר כושר" sub="לטעויות שחוזרות" />
          <GameTile to={`${base}/learn`} tone="grammar" icon={<LessonIcon />} title="שיעורים" sub="הסברים ודוגמאות" />
          <GameTile to={`${base}/practice/sentences`} tone="speaking" icon={<GrammarIcon />} title="בונים משפטים" sub="לסדר מילים למשפט" />
          <GameTile to={`${base}/match`} tone="primary" icon={<VocabIcon />} title="התאמת זוגות" sub="מילים ופירושים" />
        </div>
      </section>

      {(focus || weak) && (
        <section className="stack">
          <div className="section-head">
            <h2>כדאי לחזק</h2>
          </div>
          {focus ? (
            <Link to={`${base}/practice/mistakes`} className="row-card" style={{ alignItems: 'flex-start' }}>
              <span className="tile-icon" style={{ background: 'var(--warn-weak)', color: 'var(--warn-ink)' }}>
                <RepeatIcon />
              </span>
              <span className="grow stack" style={{ gap: 2 }}>
                <He className="">{focus.note.he}</He>
                <He className="small muted">{focus.tip.he}</He>
              </span>
            </Link>
          ) : weak ? (
            <Link to={`${base}/practice/skill?skill=${encodeURIComponent(weak.skillId)}`} className="row-card">
              <span className="tile-icon" style={{ background: 'var(--warn-weak)', color: 'var(--warn-ink)' }}>
                <RepeatIcon />
              </span>
              <He className="grow">{weak.name.he}</He>
              <ChevronIcon />
            </Link>
          ) : null}
        </section>
      )}

      <div className="row-card" aria-disabled="true" style={{ opacity: 0.6 }}>
        <span className="tile-icon tone-speaking" style={{ background: 'var(--t-speaking-weak)', color: 'var(--t-speaking-fg)' }}>
          <ChatIcon />
        </span>
        <span className="grow">
          <strong>שיחה עם המורה</strong> <En className="xs muted">Conversation</En>
          <span className="xs muted" style={{ display: 'block' }}>
            בקרוב
          </span>
        </span>
      </div>

      <WeekStrip profile={p} goal={goal} today={today} />
    </main>
  );
}

/** Tile progress = position from A1 toward the student's target level. */
function domainProgress(d: DomainSummary): number {
  if (!d.level) return 0;
  const from = levelCenter('A1') - 0.5;
  const to = levelCenter(d.target) + 0.5;
  return Math.max(0.04, Math.min(1, (d.theta - from) / (to - from)));
}

function SkillTile({ to, d, title, en }: { to: string; d: DomainSummary; title: string; en: string }) {
  return (
    <Link to={to} className={`tile tone-${d.domain}`}>
      <span className="tile-icon">
        <DomainIcon domain={d.domain} />
      </span>
      {d.level && (
        <span className="tile-level" lang="en">
          {d.level}
        </span>
      )}
      <span>
        <strong style={{ display: 'block' }}>{title}</strong>
        <En className="tile-sub">{en}</En>
      </span>
      <span className="tile-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(domainProgress(d) * 100)}%` }} />
      </span>
    </Link>
  );
}

function GameTile({ to, tone, icon, title, sub }: { to: string; tone: string; icon: ReactNode; title: string; sub: string }) {
  return (
    <Link to={to} className={`tile tile-solid tone-${tone}`}>
      <span className="tile-icon">{icon}</span>
      <span style={{ position: 'relative' }}>
        <strong style={{ display: 'block' }}>{title}</strong>
        <span className="tile-sub">{sub}</span>
      </span>
    </Link>
  );
}

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

function WeekStrip({ profile, goal, today }: { profile: LearnerProfile; goal: number; today: string }) {
  return (
    <section className="panel stack" aria-label="השבוע">
      <div className="spread">
        <strong>השבוע</strong>
        <span className="small muted">{profile.activity.minutesLast7} דקות</span>
      </div>
      <div className="week">
        {profile.activity.week.map((d) => {
          const pct = Math.min(100, (d.minutes / goal) * 100);
          const letter = DAY_LETTERS[new Date(`${d.day}T12:00:00`).getDay()];
          return (
            <div className={`week-day${d.day === today ? ' today' : ''}`} key={d.day} title={`${d.minutes} דקות`}>
              <div className="week-bar">
                <span style={{ height: `${d.items ? Math.max(10, pct) : 0}%` }} />
              </div>
              {letter}
            </div>
          );
        })}
      </div>
    </section>
  );
}
