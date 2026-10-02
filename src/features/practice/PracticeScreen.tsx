import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useServices } from '@/app/services';
import { useProfile, useStudent } from '@/app/hooks';
import { CloseIcon } from '@/ui/icons';
import { En } from '@/ui/En';
import type { Student } from '@/domain/student/student';
import type { SupportLanguage } from '@/domain/learning/languageSupport';
import { domainNameHe } from '@/domain/student/profile';
import { domainOf } from '@/domain/skills/taxonomy';
import { ExerciseView } from './ExerciseView';
import { isPracticeMode, MODES, type PracticeMode } from './modes';
import { lightningScore, useSession, type SessionResult } from './useSession';
import { useGameHistory } from './useGameHistory';

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
            {title} · {s.results.filter((r) => r.correct).length} נכונות
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

      {done && <Summary mode={mode} student={student} results={s.results} onHome={() => nav(home)} onAgain={onAgain} />}
    </main>
  );
}

function emptyText(mode: PracticeMode): string {
  if (mode === 'review') return 'אין פריטים לחזרה כרגע. כל הכבוד.';
  if (mode === 'mistakes') return 'אין כרגע טעויות חוזרות לתרגל. מצוין.';
  return 'אין כרגע תרגילים חדשים כאן.';
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
  student,
  results,
  onHome,
  onAgain,
}: {
  mode: PracticeMode;
  student: Student;
  results: SessionResult[];
  onHome: () => void;
  onAgain: () => void;
}) {
  const { content } = useServices();
  const history = useGameHistory(student.id);
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

  return (
    <section className="stack" style={{ gap: 'var(--s-5)', marginTop: 'var(--s-4)' }}>
      <h2 className="title">{headline}</h2>
      {big && (
        <div className="panel stack" style={{ alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.1 }}>{big}</span>
          {sub && <span className="muted">{sub}</span>}
        </div>
      )}
      {mode === 'exam' && byDomain.size > 0 && (
        <div className="list">
          {[...byDomain.entries()].map(([d, v]) => (
            <div key={d} className="list-item">
              <span className="grow">{domainNameHe(d as never)}</span>
              <span>
                {v.c}/{v.t}
              </span>
            </div>
          ))}
        </div>
      )}
      {!big && (
        <div className="panel stack">
          <div className="spread">
            <span>נכון בניסיון הראשון</span>
            <strong>
              {clean} / {results.length}
            </strong>
          </div>
          <div className="spread">
            <span>נקודות</span>
            <strong>+{xp}</strong>
          </div>
        </div>
      )}
      {tip && (
        <div className="panel stack">
          <span className="section-label">נקודה אחת לזכור</span>
          <p>{tip.tip.he}</p>
        </div>
      )}
      {(mode === 'exam' || mode === 'quiz') && wrong.length > 0 && (
        <div className="stack">
          <span className="section-label">כדאי לעבור שוב</span>
          <div className="list">
            {wrong.slice(0, 8).map((i) => (
              <div key={i.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                {'promptLanguage' in i && i.promptLanguage === 'he' ? (
                  <span className="small">{i.prompt}</span>
                ) : (
                  <En className="small">{'prompt' in i ? i.prompt : ''}</En>
                )}
                <span className="small muted">{i.explanation.he}</span>
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
        {mode !== 'daily' && (
          <button className="btn btn-primary btn-block" onClick={onAgain}>
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
