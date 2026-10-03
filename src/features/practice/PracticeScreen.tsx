import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useServices } from '@/app/services';
import { useProfile, useStudent } from '@/app/hooks';
import { CloseIcon } from '@/ui/icons';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import type { Student } from '@/domain/student/student';
import type { ContentItem } from '@/domain/content/schema';
import type { SupportLanguage } from '@/domain/learning/languageSupport';
import { domainNameHe } from '@/domain/student/profile';
import { domainOf } from '@/domain/skills/taxonomy';
import { ExerciseView } from './ExerciseView';
import { isPracticeMode, MODES, type PracticeMode } from './modes';
import { lightningScore, useSession, type SessionResult } from './useSession';
import { useGameHistory } from './useGameHistory';
import { Confetti } from '@/ui/Confetti';
import { sounds } from '@/services/sound';
import { BoltIcon, CheckIcon, RepeatIcon, StarIcon, TrophyIcon } from '@/ui/icons';
import { Art } from '@/ui/Art';
import { Button } from '@/ui/Button';
import { TopBar } from '@/ui/TopBar';
import { Stack } from '@/ui/layout';

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
  const [resumeHidden, setResumeHidden] = useState(false);
  const def = MODES[mode];
  const home = `/s/${student.id}`;
  const done = s.status === 'done';
  const empty = s.status === 'empty';
  const progress = s.deadline || empty ? null : Math.round(((done ? s.total : Math.max(0, s.index - 1)) / s.total) * 100);
  const combo = useCombo(s.results.map((r) => r.correct));
  const title = mode === 'skill' && params.skill ? (content.lessonsForSkill(params.skill)[0]?.title.he ?? def.title) : def.title;
  const counter = s.status === 'loading' || empty ? '' : `${done ? s.total : Math.min(s.index, s.total)}/${s.total}`;

  return (
    <main className="screen tight">
      <TopBar
        wide={!!s.deadline}
        start={
          <button className="icon-btn" onClick={() => nav(home)} aria-label="יציאה">
            <CloseIcon />
          </button>
        }
        center={
          progress !== null ? (
            <Stack gap={1} className="grow session-head">
              <He inline className="session-title">{title}</He>
              <div className="progress" role="progressbar" aria-label={title} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${progress}%` }} />
              </div>
            </Stack>
          ) : empty ? (
            <He className="t-strong txt-center">{title}</He>
          ) : (
            <He className="t-strong txt-center">{`${title} · ${s.results.filter((r) => r.correct).length} נכונות`}</He>
          )
        }
        end={
          s.deadline && !done ? (
            <Timer deadline={s.deadline} onEnd={s.timeUp} />
          ) : (
            <span className="session-count" dir="ltr">
              {counter}
            </span>
          )
        }
      />

      {s.status === 'loading' && <div className="center muted">טוען…</div>}

      {s.resumed && s.status === 'active' && !resumeHidden && (
        <div className="resume-note" role="status">
          <span className="resume-icon" aria-hidden="true">
            <RepeatIcon size={18} />
          </span>
          <span className="grow stack gap-0">
            <strong>ממשיכים מאיפה שעצרת</strong>
            <span className="small muted">
              שאלה {s.index} מתוך {s.total}
            </span>
          </span>
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => {
              s.discardSaved();
              onAgain();
            }}
          >
            מההתחלה
          </Button>
          <button className="icon-btn" aria-label="סגירה" onClick={() => setResumeHidden(true)}>
            <CloseIcon size={18} />
          </button>
        </div>
      )}

      {s.status === 'empty' && (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <CheckIcon size={28} />
          </span>
          <p className="t-h3">{emptyText(mode)}</p>
          {mode === 'pretest' && params.lesson ? (
            // Nothing to guess for this topic: the lesson itself is the way on.
            <Button variant="primary" size="lg" onClick={() => nav(`/s/${student.id}/learn/${params.lesson}`, { replace: true })}>
              לשיעור
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={() => nav(home)}>
              חזרה למסך הבית
            </Button>
          )}
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
          onAnswer={s.record}
          onDone={s.complete}
        />
      )}

      {combo && (
        <div className="combo-toast" role="status" key={combo}>
          {combo} ברצף!
        </div>
      )}

      {done && (
        <Summary
          mode={mode}
          params={params}
          student={student}
          results={s.results}
          total={s.total}
          itemFor={s.itemFor}
          onHome={() => nav(home)}
          onAgain={onAgain}
        />
      )}
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
  total,
  itemFor,
  onHome,
  onAgain,
}: {
  mode: PracticeMode;
  params: Record<string, string>;
  student: Student;
  results: SessionResult[];
  total: number;
  itemFor: (id: string) => ContentItem | undefined;
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
  // itemFor also finds items made for this session (my words), which are not in the registry.
  const wrong = results.filter((r) => !r.correct).map((r) => itemFor(r.itemId)).filter((i) => !!i);
  // Retry looks items up in the registry, so only those can be practiced again.
  const retryIds = wrong.filter((i) => content.getItem(i.id)).map((i) => i.id);

  let headline = 'סיימנו סבב';
  let big: string | null = null;
  let sub: string | null = null;
  if (mode === 'lightning') {
    const score = lightningScore(results);
    const all = (history ?? []).filter((g) => g.game === 'lightning');
    // The current round may or may not be saved yet.
    const prior = all.length && all[all.length - 1]!.score === score && all[all.length - 1]!.correct === correct ? all.slice(0, -1) : all;
    const prevBest = Math.max(0, ...prior.map((g) => g.score));
    // All questions answered before the clock ran out.
    headline = results.length >= total ? 'כל השאלות נענו' : 'הזמן נגמר';
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
      const it = itemFor(r.itemId);
      if (!it) continue;
      const d = domainOf(it.skill);
      const cur = byDomain.get(d) ?? { c: 0, t: 0 };
      byDomain.set(d, { c: cur.c + (r.correct ? 1 : 0), t: cur.t + 1 });
    }
  }

  const celebrate = mode === 'lightning' ? correct >= 5 : pct >= 60;
  const subtitle = sub ?? (pct >= 80 ? 'עבודה מצוינת' : pct >= 50 ? 'התקדמות יפה' : 'כל טעות היא שיעור. נחזור לזה.');

  return (
    <Stack as="section" gap={4}>
      {celebrate && <Confetti />}
      <div className="result-hero">
        <span className="hero-glow" aria-hidden="true" />
        <Art name="progress" size={88} tone="hero" fallback={<TrophyIcon />} />
        <h2 className="result-title">{headline}</h2>
        <span className="big num" dir="ltr">
          {big ?? pct}
          {mode === 'lightning' ? '' : <small>%</small>}
        </span>
        <span className="result-sub">{subtitle}</span>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <CheckIcon size={22} />
          <b className="num" dir="ltr">
            {correct}/{results.length}
          </b>
          <span>נכונות</span>
        </div>
        <div className="stat">
          <StarIcon size={22} />
          <b className="num" dir="ltr">+{xp}</b>
          <span>נקודות</span>
        </div>
        <div className="stat">
          <BoltIcon size={22} />
          <b className="num">{clean}</b>
          <span>בניסיון ראשון</span>
        </div>
      </div>
      {mode === 'exam' && byDomain.size > 0 && (
        <div className="list">
          {[...byDomain.entries()].map(([d, v]) => (
            <div key={d} className="list-item">
              <span className="grow">{domainNameHe(d as never)}</span>
              <span className="t-strong">
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
              <Stack key={i.id} gap={1} align="start" className="list-item">
                {i.type === 'order' ? (
                  <En as="div" className="wrong-en">{i.answer}</En>
                ) : i.type === 'fix' ? (
                  <En as="div" className="wrong-en">{i.corrected}</En>
                ) : 'promptLanguage' in i && i.promptLanguage === 'he' ? (
                  <He className="t-strong">{i.prompt}</He>
                ) : (
                  <En as="div" className="wrong-en">{'prompt' in i ? i.prompt : ''}</En>
                )}
                <He className="small muted wrong-why">{i.explanation.he}</He>
                {content.lessonsForSkill(i.skill)[0] && (
                  <Link className="text-link" to={`/s/${student.id}/learn/${content.lessonsForSkill(i.skill)[0]!.id}`}>
                    לשיעור
                  </Link>
                )}
              </Stack>
            ))}
          </div>
        </div>
      )}
      <Stack gap={2}>
        {mode === 'pretest' && params.lesson && (
          <Button variant="primary" size="lg" block onClick={() => nav(`/s/${student.id}/learn/${params.lesson}`, { replace: true })}>
            עכשיו לשיעור
          </Button>
        )}
        {retryIds.length > 0 && mode !== 'pretest' && mode !== 'retry' && (
          <Button variant="primary" size="lg" block onClick={() => nav(`/s/${student.id}/practice/retry?ids=${retryIds.join(',')}`)}>
            לתרגל שוב את הטעויות ({retryIds.length})
          </Button>
        )}
        {mode !== 'daily' && mode !== 'pretest' && (
          <Button variant={retryIds.length ? 'secondary' : 'primary'} size="lg" block onClick={onAgain}>
            {mode === 'exam' ? 'מבחן נוסף' : 'עוד סבב'}
          </Button>
        )}
        <Button variant={mode === 'daily' ? 'primary' : 'tertiary'} size="lg" block onClick={onHome}>
          חזרה למסך הבית
        </Button>
      </Stack>
    </Stack>
  );
}
