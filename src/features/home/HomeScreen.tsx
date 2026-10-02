import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProfile, useStudent } from '@/app/hooks';
import { Avatar } from '@/ui/Avatar';
import { En } from '@/ui/En';
import { ChevronIcon, GearIcon } from '@/ui/icons';
import type { LearnerProfile } from '@/domain/student/profile';
import { rankOf } from '@/domain/learning/progression';
import { useGameHistory } from '@/features/practice/useGameHistory';
import { localDay } from '@/domain/learning/events';

/** Home: one main action, today's progress, a short list of practice options. */
export function HomeScreen() {
  const { sid } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const games = useGameHistory(student?.id);
  const nav = useNavigate();

  if (student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  if (!student || !profile) return <main className="screen" />;

  const p = profile;
  const goal = student.preferences.dailyGoalMinutes;
  const todayPct = Math.min(100, Math.round((p.activity.minutesToday / goal) * 100));
  const focus = p.memory[0];
  const weak = p.weakSkills[0];
  const rank = rankOf(p);
  const today = localDay(Date.now());
  const dailyDone = !!games?.some((g) => g.game === 'daily' && g.day === today);
  const base = `/s/${student.id}`;

  return (
    <main className="screen">
      <header className="spread">
        <Link to="/" className="row" style={{ color: 'inherit', textDecoration: 'none' }} aria-label="החלפת תלמיד">
          <Avatar name={student.name} hue={student.hue} />
          <div>
            <div style={{ fontSize: 'var(--t-xl)', fontWeight: 650 }}>שלום, {student.name}</div>
            {p.activity.streakDays > 0 && <div className="small muted">{p.activity.streakDays} ימים ברצף</div>}
          </div>
        </Link>
        <div className="row" style={{ gap: 4 }}>
          <Link to={`${base}/progress`} className="rank-badge" aria-label={`דרגה ${rank.current.level}: ${rank.current.he}`} style={{ textDecoration: 'none' }}>
            {rank.current.level}
          </Link>
          <Link to={`${base}/settings`} className="icon-btn" aria-label="הגדרות">
            <GearIcon />
          </Link>
        </div>
      </header>

      {p.calibrated ? (
        <button className="hero" onClick={() => nav(`/s/${student.id}/practice/lesson`)}>
          <div className="grow stack" style={{ gap: 4 }}>
            <span className="title">השיעור של היום</span>
            <span style={{ opacity: 0.85 }}>תרגול מותאם אישית, כ־{goal} דקות</span>
          </div>
          <ChevronIcon size={24} />
        </button>
      ) : (
        <button className="hero" onClick={() => nav(`/s/${student.id}/practice/placement`)}>
          <div className="grow stack" style={{ gap: 4 }}>
            <span className="title">בואו נכיר</span>
            <span style={{ opacity: 0.85 }}>אבחון קצר, כ־5 דקות. מתחילים בינוני ומתאימים את הקושי.</span>
          </div>
          <ChevronIcon size={24} />
        </button>
      )}

      <section className="stack" aria-label="היום">
        <div className="spread small">
          <span className="section-label">היום</span>
          <span className="muted">
            {p.activity.minutesToday} מתוך {goal} דקות
          </span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={todayPct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${todayPct}%` }} />
        </div>
      </section>

      {p.calibrated &&
        (dailyDone ? (
          <div className="list list-item">
            <span className="grow">
              <strong>האתגר היומי</strong>
              <span className="small muted" style={{ display: 'block' }}>הושלם היום. מחר יש אתגר חדש.</span>
            </span>
            <span className="badge badge-good">בוצע</span>
          </div>
        ) : (
          <Link to={`${base}/practice/daily`} className="list list-item" style={{ color: 'inherit', textDecoration: 'none' }}>
            <span className="grow">
              <strong>האתגר היומי</strong>
              <span className="small muted" style={{ display: 'block' }}>6 שאלות מגוונות, חידה אחת בפנים</span>
            </span>
            <ChevronIcon />
          </Link>
        ))}

      <section className="stack">
        <span className="section-label">תרגול קצר</span>
        <nav className="list">
          <PracticeLink to={`/s/${student.id}/practice/vocabulary`} title="אוצר מילים" en="Vocabulary" meta="5 דק׳" />
          <PracticeLink to={`/s/${student.id}/practice/grammar`} title="דקדוק" en="Grammar" meta="5 דק׳" />
          <PracticeLink to={`/s/${student.id}/practice/reading`} title="הבנת הנקרא" en="Reading" />
          <PracticeLink to={`/s/${student.id}/practice/listening`} title="הבנת הנשמע" en="Listening" />
          <PracticeLink title="שיחה" en="Conversation" meta="בקרוב" disabled />
        </nav>
      </section>

      <section className="stack">
        <span className="section-label">משחקים ואתגרים</span>
        <div className="grid-2">
          <Tile to={`${base}/practice/quiz`} title="חידון" sub="10 שאלות, בלי רמזים" />
          <Tile to={`${base}/practice/lightning`} title="סבב בזק" sub="60 שניות, כמה שיותר" />
          <Tile to={`${base}/practice/exam`} title="מבחן" sub="בסגנון בגרות" />
          <Tile to={`${base}/practice/riddles`} title="חידות" sub="באנגלית" />
          <Tile to={`${base}/practice/mistakes`} title="חדר כושר לטעויות" sub="מה שעוד לא יושב" />
          <Tile to={`${base}/learn`} title="שיעורים" sub="הסברים ודוגמאות" />
        </div>
      </section>

      {(p.words.due > 0 || focus || weak) && (
        <section className="stack">
          <span className="section-label">כדאי לחזק</span>
          <div className="list">
            {p.words.due > 0 && (
              <PracticeLink to={`/s/${student.id}/practice/review`} title={`${p.words.due} פריטים לחזרה היום`} meta="חזרה" />
            )}
            {focus ? (
              <Link to={`${base}/practice/mistakes`} className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4, color: 'inherit', textDecoration: 'none' }}>
                <span style={{ fontWeight: 550 }}>{focus.note.he}</span>
                <span className="small muted">{focus.tip.he}</span>
              </Link>
            ) : weak ? (
              <PracticeLink to={`${base}/practice/skill?skill=${encodeURIComponent(weak.skillId)}`} title={weak.name.he} meta="תרגול ממוקד" />
            ) : null}
          </div>
        </section>
      )}

      <WeekStrip profile={p} goal={goal} />
    </main>
  );
}

function Tile({ to, title, sub }: { to: string; title: string; sub: string }) {
  return (
    <Link to={to} className="tile">
      <strong>{title}</strong>
      <span className="xs muted">{sub}</span>
    </Link>
  );
}

function PracticeLink({ to, title, en, meta, disabled }: { to?: string; title: string; en?: string; meta?: string; disabled?: boolean }) {
  const body = (
    <>
      <span className="grow">
        {title}
        {en && (
          <>
            {' '}
            <En className="muted small">{en}</En>
          </>
        )}
      </span>
      {meta && <span className="small muted">{meta}</span>}
      {!disabled && (
        <span className="chev">
          <ChevronIcon />
        </span>
      )}
    </>
  );
  if (disabled || !to) {
    return (
      <div className="list-item" aria-disabled="true">
        {body}
      </div>
    );
  }
  return (
    <Link to={to} className="list-item" style={{ color: 'inherit', textDecoration: 'none' }}>
      {body}
    </Link>
  );
}

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

function WeekStrip({ profile, goal }: { profile: LearnerProfile; goal: number }) {
  return (
    <section className="stack" aria-label="השבוע">
      <span className="section-label">השבוע</span>
      <div className="week">
        {profile.activity.week.map((d) => {
          const pct = Math.min(100, (d.minutes / goal) * 100);
          const letter = DAY_LETTERS[new Date(`${d.day}T12:00:00`).getDay()];
          return (
            <div className="week-day" key={d.day} title={`${d.minutes} דקות`}>
              <div className="week-bar">
                <span style={{ height: `${d.items ? Math.max(8, pct) : 0}%` }} />
              </div>
              {letter}
            </div>
          );
        })}
      </div>
    </section>
  );
}
