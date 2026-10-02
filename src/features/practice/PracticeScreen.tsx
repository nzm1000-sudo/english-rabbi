import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useServices } from '@/app/services';
import { useProfile, useStudent } from '@/app/hooks';
import { CloseIcon } from '@/ui/icons';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import type { Student } from '@/domain/student/student';
import type { SupportLanguage } from '@/domain/learning/languageSupport';
import { domainNameHe } from '@/domain/student/profile';
import { domainOf } from '@/domain/skills/taxonomy';
import { ExerciseView } from './ExerciseView';
import { isPracticeMode, MODES, type PracticeMode } from './modes';
import { lightningScore, useSession, type SessionResult } from './useSession';
import { useGameHistory } from './useGameHistory';
import { Confetti } from '@/ui/Confetti';
import { sounds } from '@/services/sound';
import { StarIcon, TrophyIcon } from '@/ui/icons';

export function PracticeScreen() {
  const { sid, mode } = useParams();
  const [search] = useSearchParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const [round, setRound] = useState(0);
  const params = useMemo(() => Object.fromEntries(search.entries()), [search]);
  if (!isPracticeMode(mode)) return <main className="screen empty">מצב תרגול לא מוכר</main>;
  if (student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  if (!student || !profile) return <main className="screen" />;
  return (
    <Session
      key={`${student.id}:${mode}:${search.toString()}:${round}`}
      student={student}
      mode={mode}
      params={params}
      support={profile.supportLanguage}
      onAgain={() => setRound((r) => r + 1)}
    />
  );
}

function Session({
  student,
  mode,
  params,
  support,
  onAgain,
}: {
  student: Student;
  mode: PracticeMode;
  params: Record<string, string>;
  support: SupportLanguage;
  onAgain: () => void;
}) {
  const { content } = useServices();
  const nav = useNavigate();
  // Fixed for the whole session so the language does not flip mid-way.
  const [fixedSupport] = useState(support);
  const s = useSession(student, mode, params);
  const def = MODES[mode];
  const home = `/s/${student.id}`;
  const done = s.status === 'done';
  const progress = s.deadline ? null : Math.round(((done ? s.total : Math.max(0, s.index - 1)) / s.total) * 100);
  const combo = useCombo(s.results.map((r) => r.correct));
  const title = mode === 'skill' && params.skill ? (content.lessonsForSkill(params.skill)[0]?.title.he ?? def.title) : def.title;

  return (
    <main className="screen" style={{ gap: 'var(--s-4)' }}>
      <header className="row">
        <button className="icon-btn" onClick={() => nav(home)} aria-label="יציאה">
          <CloseIcon />
        </button>
        {progress !== null ? (
          <div className="grow progress" role="progressbar" aria-label={title} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress}%` }} />
          </div>
        ) : (
          <span className="grow" style={{ fontWeight: 600 }}>
            <He>{`${title} · ${s.results.filter((r) => r.correct).length} נכונות`}</He>
          </span>
        )}
        {s.deadline && !done ? (
          <Timer deadline={s.deadline} onEnd={s.timeUp} />
        ) : (
          <span className="small muted" style={{ minWidth: 44, textAlign: 'center' }}>
            {def.english ? <En>{def.english}</En> : title}
          </span>
        )}
      </header>

      {s.status === 'loading' && <div className="center muted">טוען…</div>}

      {s.status === 'empty' && (
        <div className="center stack" style={{ textAlign: 'center' }}>
          <p>{emptyText(mode)}</p>
          <button className="btn btn-primary" onClick={() => nav(home)}>
            חזרה למסך הבית
          </button>
        </div>
      )}

      {s.status === 'active' && s.current && s.current.item.type !== 'open-writing' && (
        <ExerciseView
          key={s.current.item.id}
          item={s.current.item}
          passage={s.current.item.passageId ? content.passages.get(s.current.item.passageId) : undefined}
          support={fixedSupport}
          seed={s.sessionId}
          policy={def.policy}
          feedback={def.feedback}
          onDone={s.complete}
        />
      )}

      {combo && (
        <div className="combo-toast" role="status" key={combo}>
          {combo} ברצף!
        </div>
      )}

      {done && <Summary mode={mode} params={params} student={student} results={s.results} onHome={() => nav(home)} onAgain={onAgain} />}
    </main>
  );
}

function emptyText(mode: PracticeMode): string {
  if (mode === 'review') return 'אין פריטים לחזרה כרגע. כל הכבוד.';
  if (mode === 'mistakes') return 'אין כרגע טעויות חוזרות לתרגל. מצוין.';
  return 'אין כרגע תרגילים חדשים כאן.';
}

/** Shows a short "N in a row" toast at 3, 5 and 10 correct answers. Rewards accuracy, not speed. */
function useCombo(correct: boolean[]): number | null {
  const [shown, setShown] = useState<number | null>(null);
  const last = useRef(0);
  useEffect(() => {
    if (correct.length === last.current) return;
    last.current = correct.length;
    let run = 0;
    for (let i = correct.length - 1; i >= 0 && correct[i]; i--) run++;
    if (run === 3 || run === 5 || run === 10) {
      setShown(run);
      sounds.combo();
      const t = setTimeout(() => setShown(null), 1600);
      return () => clearTimeout(t);
    }
  }, [correct]);
  return shown;
}

function Timer({ deadline, onEnd }: { deadline: number; onEnd: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    if (left === 0) onEnd();
  }, [left, onEnd]);
  return (
    <span className="timer" data-low={left <= 10} aria-live="off" aria-label={`נותרו ${left} שניות`}>
      {left}
    </span>
  );
}

function Summary({
  mode,
  params,
  student,
  results,
  onHome,
  onAgain,
}: {
  mode: PracticeMode;
  params: Record<string, string>;
  student: Student;
  results: SessionResult[];
  onHome: () => void;
  onAgain: () => void;
}) {
  const { content } = useServices();
  const nav = useNavigate();
  const history = useGameHistory(student.id);
  useEffect(() => {
    sounds.finish();
  }, []);
  const correct = results.filter((r) => r.correct).length;
  const clean = results.filter((r) => r.evidence.flags.includes('clean') || r.evidence.flags.includes('fast')).length;
  const xp = results.reduce((s, r) => s + r.evidence.xp, 0);
  const pct = results.length ? Math.round((correct / results.length) * 100) : 0;
  const counts = new Map<string, number>();
  for (const r of results) for (const m of r.misconceptions) counts.set(m, (counts.get(m) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const tip = top ? content.misconceptions.get(top[0]) : undefined;
  const wrong = results.filter((r) => !r.correct).map((r) => content.getItem(r.itemId)).filter((i) => !!i);

  let headline = 'סיימנו סבב';
  let big: string | null = null;
  let sub: string | null = null;
  if (mode === 'lightning') {
    const score = lightningScore(results);
    const all = (history ?? []).filter((g) => g.game === 'lightning');
    // The current round may or may not be saved yet.
    const prior = all.length && all[all.length - 1]!.score === score && all[all.length - 1]!.correct === correct ? all.slice(0, -1) : all;
    const prevBest = Math.max(0, ...prior.map((g) => g.score));
    headline = 'הזמן נגמר';
    big = `${score}`;
    sub = score > prevBest && prevBest > 0 ? 'שיא אישי חדש' : prevBest ? `השיא שלך: ${prevBest}` : `${correct} תשובות נכונות`;
  } else if (mode === 'quiz' || mode === 'exam' || mode === 'daily' || mode === 'riddles') {
    headline = mode === 'exam' ? 'תוצאת המבחן' : mode === 'daily' ? 'האתגר היומי הושלם' : 'סיום';
    big = `${pct}`;
    sub = `${correct} מתוך ${results.length} נכונות`;
  }

  // Exam: score per domain, a real picture instead of one number.
  const byDomain = new Map<string, { c: number; t: number }>();
  if (mode === 'exam') {
    for (const r of results) {
      const it = content.getItem(r.itemId);
      if (!it) continue;
      const d = domainOf(it.skill);
      const cur = byDomain.get(d) ?? { c: 0, t: 0 };
      byDomain.set(d, { c: cur.c + (r.correct ? 1 : 0), t: cur.t + 1 });
    }
  }

  const celebrate = mode === 'lightning' ? correct >= 5 : pct >= 60;
  const subtitle = sub ?? (pct >= 80 ? 'עבודה מצוינת' : pct >= 50 ? 'התקדמות יפה' : 'כל טעות היא שיעור. נחזור לזה.');

  return (
    <section className="stack" style={{ gap: 'var(--s-4)', marginTop: 'var(--s-2)' }}>
      {celebrate && <Confetti />}
      <div className="result-hero">
        <span className="tile-icon" style={{ background: 'rgb(255 255 255 / 0.2)', color: '#fff', width: 56, height: 56, borderRadius: 18 }}>
          <TrophyIcon size={30} />
        </span>
        <h2 className="title" style={{ color: '#fff' }}>{headline}</h2>
        {big ? <span className="big">{big}{mode === 'lightning' ? '' : '%'}</span> : <span className="big">{pct}%</span>}
        <span style={{ opacity: 0.92 }}>{subtitle}</span>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <b>{correct}/{results.length}</b>
          <span>נכונות</span>
        </div>
        <div className="stat">
          <b className="row" style={{ gap: 4 }}>
            <StarIcon size={18} />+{xp}
          </b>
          <span>נקודות</span>
        </div>
        <div className="stat">
          <b>{clean}</b>
          <span>בניסיון ראשון</span>
        </div>
      </div>
      {mode === 'exam' && byDomain.size > 0 && (
        <div className="list">
          {[...byDomain.entries()].map(([d, v]) => (
            <div key={d} className="list-item">
              <span className="grow">{domainNameHe(d as never)}</span>
              <span style={{ fontWeight: 700 }}>
                {v.c}/{v.t}
              </span>
            </div>
          ))}
        </div>
      )}
      {tip && (
        <div className="panel stack">
          <strong>נקודה אחת לזכור</strong>
          <p><He>{tip.tip.he}</He></p>
        </div>
      )}
      {wrong.length > 0 && (
        <div className="stack">
          <span className="section-label">כדאי לעבור שוב</span>
          <div className="list">
            {wrong.slice(0, 8).map((i) => (
              <div key={i.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                {i.type === 'order' ? (
                  <En className="small">{i.answer}</En>
                ) : 'promptLanguage' in i && i.promptLanguage === 'he' ? (
                  <He className="small">{i.prompt}</He>
                ) : (
                  <En className="small">{'prompt' in i ? i.prompt : ''}</En>
                )}
                <He className="small muted">{i.explanation.he}</He>
                {content.lessonsForSkill(i.skill)[0] && (
                  <Link className="xs" to={`/s/${student.id}/learn/${content.lessonsForSkill(i.skill)[0]!.id}`}>
                    לשיעור
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="stack">
        {mode === 'pretest' && params.lesson && (
          <button className="btn btn-primary btn-block" onClick={() => nav(`/s/${student.id}/learn/${params.lesson}`, { replace: true })}>
            עכשיו לשיעור
          </button>
        )}
        {wrong.length > 0 && mode !== 'pretest' && mode !== 'retry' && (
          <button
            className="btn btn-primary btn-block"
            onClick={() => nav(`/s/${student.id}/practice/retry?ids=${wrong.map((i) => i.id).join(',')}`)}
          >
            לתרגל שוב את הטעויות ({wrong.length})
          </button>
        )}
        {mode !== 'daily' && mode !== 'pretest' && (
          <button className={`btn btn-block ${wrong.length ? '' : 'btn-primary'}`} onClick={onAgain}>
            {mode === 'lightning' ? 'עוד סבב' : mode === 'exam' ? 'מבחן נוסף' : 'עוד סבב'}
          </button>
        )}
        <button className={`btn btn-block ${mode === 'daily' ? 'btn-primary' : ''}`} onClick={onHome}>
          חזרה למסך הבית
        </button>
      </div>
    </section>
  );
}
