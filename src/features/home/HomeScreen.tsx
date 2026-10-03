import { useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProfile, useStudent } from '@/app/hooks';
import { Avatar } from '@/ui/Avatar';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { Art } from '@/ui/Art';
import { Ring } from '@/ui/Ring';
import { Sheet } from '@/ui/Sheet';
import { DomainIcon } from '@/ui/DomainIcon';
import { ButtonLink } from '@/ui/Button';
import {
  BookIcon,
  FlameIcon,
  GearIcon,
  GridIcon,
  LessonIcon,
  RepeatIcon,
  StarIcon,
  TargetIcon,
  TrophyIcon,
  PlayIcon,
} from '@/ui/icons';
import type { DomainSummary } from '@/domain/student/profile';
import type { Domain } from '@/domain/skills/taxonomy';
import { rankOf } from '@/domain/learning/progression';
import { useGameHistory } from '@/features/practice/useGameHistory';
import { localDay } from '@/domain/learning/events';
import { levelCenter } from '@/domain/skills/cefr';
import { resume } from '@/app/resume';
import { stageOf } from '@/domain/student/student';
import { KidsHome } from '@/features/kids/KidsHome';
import { Row, Stack } from '@/ui/layout';
import type { ArtName } from '@/ui/art';
import { MORE_COUNT } from './moreModes';
import { RowLink } from '@/ui/RowLink';
import { heCount } from '@/domain/text/heCount';

const PRACTICE: { domain: Domain; title: string; en: string }[] = [
  { domain: 'vocabulary', title: 'אוצר מילים', en: 'Vocabulary' },
  { domain: 'grammar', title: 'דקדוק', en: 'Grammar' },
  { domain: 'reading', title: 'הבנת הנקרא', en: 'Reading' },
  { domain: 'listening', title: 'הבנת הנשמע', en: 'Listening' },
];

/**
 * Home, at most a screen and a half: the lesson of the day, what to pick up
 * today, four skills, and one door to everything else.
 */
export function HomeScreen() {
  const { sid } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const games = useGameHistory(student?.id);
  const [profileOpen, setProfileOpen] = useState(false);

  if (student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  if (student && stageOf(student) !== 'regular') return <KidsHome student={student} stage={stageOf(student) === 'little' ? 'little' : 'young'} />;
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
  const saved = resume.latestSession(student.id);
  const lessonTo = `${base}/practice/${p.calibrated ? 'lesson' : 'placement'}`;

  return (
    <main className="screen home">
      <header className="home-head">
        <button type="button" className="avatar-btn" onClick={() => setProfileOpen(true)} aria-label={`הפרופיל של ${student.name}`}>
          <Avatar name={student.name} hue={student.hue} size={48} />
        </button>
        <div className="grow home-greet">
          <span className="eyebrow">{greeting()}</span>
          <h1 className="home-name">{student.name}</h1>
        </div>
        <Link to={`${base}/progress`} className="stat-pill" aria-label={`${heCount(p.activity.streakDays, 'יום אחד', 'ימים')} ברצף, ${heCount(p.activity.xpTotal, 'נקודה אחת', 'נקודות')}`}>
          <span className="stat-pill-item">
            <FlameIcon size={18} />
            <b>{p.activity.streakDays}</b>
          </span>
          <span className="stat-pill-sep" aria-hidden="true" />
          <span className="stat-pill-item">
            <StarIcon size={18} />
            <b>{p.activity.xpTotal}</b>
          </span>
        </Link>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <span className="hero-glow" aria-hidden="true" />
        <div className="hero-top">
          <Stack gap={1} className="grow">
            <span className="hero-eyebrow">{p.calibrated ? 'השיעור של היום' : 'מתחילים כאן'}</span>
            <h2 className="hero-title" id="hero-title">
              {p.calibrated ? 'תרגול שנבנה בדיוק בשבילך' : 'בואו נכיר'}
            </h2>
            <p className="hero-sub">{p.calibrated ? 'כמה דקות של מילים, דקדוק והבנה, ברמה שלך.' : 'אבחון קצר, כ־5 דקות. מתחילים בינוני ומתאימים את הקושי.'}</p>
          </Stack>
          <Art name="hero-study" size={124} tone="hero" className="hero-art" fallback={<LessonIcon />} />
        </div>
        <div className="hero-goal">
          <Ring value={todayPct} size={44} stroke={5} className="ring-on-dark">
            <span className="num ring-pct" dir="ltr">
              {Math.round(todayPct * 100)}%
            </span>
          </Ring>
          <span className="grow">
            <b className="num">{p.activity.minutesToday}</b> מתוך <b className="num">{goal}</b> דקות היום
          </span>
        </div>
        <Link to={lessonTo} className="hero-cta">
          <PlayIcon size={18} />
          {p.calibrated ? 'להתחיל את השיעור' : 'להתחיל אבחון'}
        </Link>
      </section>

      {(saved || p.calibrated || p.words.due > 0 || focus || weak) && (
        <section className="stack gap-2" aria-label="היום">
          <h2 className="section-title">היום</h2>
          <div className="list">
            {saved && (
              <RowLink
                to={`${base}/practice/${saved.mode}${Object.keys(saved.params).length ? `?${new URLSearchParams(saved.params).toString()}` : ''}`}
                art="continue"
                tone="primary"
                icon={<RepeatIcon />}
                title="להמשיך מאיפה שעצרת"
                sub={`${saved.title} · ${saved.results.length} מתוך ${saved.total}`}
              />
            )}
            {p.calibrated &&
              (dailyDone ? (
                <div className="list-item" aria-label="האתגר היומי הושלם">
                  <Art name="target" size={44} tone="grammar" fallback={<TargetIcon />} />
                  <span className="grow stack gap-0">
                    <strong>האתגר היומי הושלם</strong>
                    <span className="small muted">מחר מחכה אתגר חדש</span>
                  </span>
                  <span className="badge badge-good">בוצע</span>
                </div>
              ) : (
                <RowLink to={`${base}/practice/daily`} art="target" tone="games" icon={<TargetIcon />} title="האתגר היומי" sub="6 שאלות, חידה אחת בפנים" />
              ))}
            {p.words.due > 0 && (
              <RowLink to={`${base}/practice/review`} art="words" tone="vocabulary" icon={<RepeatIcon />} title="חזרה על מילים" sub={p.words.due === 1 ? 'מילה אחת מחכה לחזרה היום' : `${p.words.due} מילים מחכות לחזרה היום`} />
            )}
            {focus ? (
              <RowLink to={`${base}/practice/mistakes`} art="streak" tone="speaking" icon={<RepeatIcon />} title="כדאי לחזק" subNode={<He className="small muted clamp-2">{focus.note.he}</He>} />
            ) : weak ? (
              <RowLink
                to={`${base}/practice/skill?skill=${encodeURIComponent(weak.skillId)}`}
                art="streak"
                tone="speaking"
                icon={<RepeatIcon />}
                title="כדאי לחזק"
                subNode={<He inline className="small muted">{weak.name.he}</He>}
              />
            ) : null}
          </div>
        </section>
      )}

      <section className="stack gap-2" aria-labelledby="skills-title">
        <h2 className="section-title" id="skills-title">
          תרגול לפי מיומנות
        </h2>
        <div className="grid-2 skill-grid">
          {PRACTICE.map((x) => (
            <SkillTile key={x.domain} to={`${base}/practice/${x.domain}`} d={p.domains.find((d) => d.domain === x.domain)!} title={x.title} en={x.en} />
          ))}
        </div>
      </section>

      <section className="stack gap-2" aria-labelledby="explore-title">
        <h2 className="section-title" id="explore-title">
          עוד בשבילך
        </h2>
        <div className="list">
          <RowLink to={`${base}/path`} art="path" tone="primary" icon={<TargetIcon />} title="המסלול שלי" sub={`${rank.current.he} · דרגה ${rank.current.level}${p.activity.frozenDays > 0 ? ' · מגן הרצף שמר על הרצף' : ''}`} />
          <RowLink to={`${base}/stories`} art="stories" tone="reading" icon={<BookIcon />} title="סיפורים" sub="סיפורים ושיחות על משפחת שפירו, בכל הרמות" />
          <RowLink to={`${base}/more`} art="games" tone="games" icon={<GridIcon />} title="עוד תרגולים" sub={`${MORE_COUNT} דרכים לתרגל: משחקים, מבחן, תרגום ועוד`} />
        </div>
      </section>

      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} label="פרופיל" title={student.name}>
        <Stack gap={3} align="center" className="txt-center">
          <Avatar name={student.name} hue={student.hue} size={80} />
          <span className="muted">
            {rank.current.he} · דרגה {rank.current.level}
          </span>
        </Stack>
        <div className="list">
          <RowLink to={`${base}/progress`} art="progress" tone="speaking" icon={<TrophyIcon />} title="ההתקדמות שלי" sub="דרגה, הישגים והשבוע שלי" />
          <RowLink to={`${base}/settings`} art="settings" tone="primary" icon={<GearIcon />} title="הגדרות" sub="מסלול, מבטא, מהירות ומראה" />
        </div>
        <ButtonLink to="/" size="lg" block>
          החלפת תלמיד
        </ButtonLink>
      </Sheet>
    </main>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
}

/** Tile progress = position from A1 toward the student's target level. */
function domainProgress(d: DomainSummary): number {
  if (!d.level) return 0;
  const from = levelCenter('A1') - 0.5;
  const to = levelCenter(d.target) + 0.5;
  return Math.max(0.04, Math.min(1, (d.theta - from) / (to - from)));
}

function SkillTile({ to, d, title, en }: { to: string; d: DomainSummary; title: string; en: string }) {
  const pct = Math.round(domainProgress(d) * 100);
  return (
    <Link to={to} className={`skill-tile g-${d.domain}`} style={{ '--pct': `${pct}%` } as CSSProperties}>
      <span className="skill-tile-sheen" aria-hidden="true" />
      <Row justify="between" align="start" className="skill-tile-top">
        <Art name={d.domain as ArtName} size={76} tone={`${d.domain} on-color`} fallback={<DomainIcon domain={d.domain} />} />
        {d.level ? (
          <span className="glass-chip" lang="en">
            {d.level}
          </span>
        ) : (
          <span className="glass-chip">חדש</span>
        )}
      </Row>
      <span className="skill-tile-text">
        <strong>{title}</strong>
        <En className="skill-tile-en">{en}</En>
      </span>
      <span className="skill-tile-bar" aria-hidden="true">
        <span />
      </span>
    </Link>
  );
}
