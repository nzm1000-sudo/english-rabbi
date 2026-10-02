import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServices } from '@/app/services';
import { useProfile, useStudent } from '@/app/hooks';
import { CloseIcon } from '@/ui/icons';
import { En } from '@/ui/En';
import type { Student } from '@/domain/student/student';
import type { SupportLanguage } from '@/domain/learning/languageSupport';
import { ExerciseView } from './ExerciseView';
import { isPracticeMode, MODES, type PracticeMode } from './modes';
import { useSession, type SessionResult } from './useSession';

export function PracticeScreen() {
  const { sid, mode } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const [round, setRound] = useState(0);
  if (!isPracticeMode(mode)) return <main className="screen empty">מצב תרגול לא מוכר</main>;
  if (student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  if (!student || !profile) return <main className="screen" />;
  // The support language is fixed for the whole session so it does not flip mid-way.
  return (
    <Session
      key={`${student.id}:${mode}:${round}`}
      student={student}
      mode={mode}
      support={profile.supportLanguage}
      onAgain={() => setRound((r) => r + 1)}
    />
  );
}

function Session({ student, mode, support, onAgain }: { student: Student; mode: PracticeMode; support: SupportLanguage; onAgain: () => void }) {
  const { content } = useServices();
  const nav = useNavigate();
  const [fixedSupport] = useState(support);
  const s = useSession(student, mode);
  const def = MODES[mode];
  const home = `/s/${student.id}`;
  const progress = Math.round(((s.status === 'done' ? s.total : Math.max(0, s.index - 1)) / s.total) * 100);

  return (
    <main className="screen" style={{ gap: 'var(--s-4)' }}>
      <header className="row">
        <button className="icon-btn" onClick={() => nav(home)} aria-label="יציאה מהתרגול">
          <CloseIcon />
        </button>
        <div className="grow progress" role="progressbar" aria-label={def.title} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="small muted" style={{ minWidth: 44, textAlign: 'center' }}>
          {def.english ? <En>{def.english}</En> : def.title}
        </span>
      </header>

      {s.status === 'loading' && <div className="center muted">טוען…</div>}

      {s.status === 'empty' && (
        <div className="center stack" style={{ textAlign: 'center' }}>
          <p>{mode === 'review' ? 'אין פריטים לחזרה כרגע. כל הכבוד.' : 'אין כרגע תרגילים חדשים כאן.'}</p>
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
          onDone={s.complete}
        />
      )}

      {s.status === 'done' && <Summary results={s.results} onHome={() => nav(home)} onAgain={onAgain} />}
    </main>
  );
}

function Summary({ results, onHome, onAgain }: { results: SessionResult[]; onHome: () => void; onAgain: () => void }) {
  const { content } = useServices();
  const clean = results.filter((r) => r.evidence.flags.includes('clean') || r.evidence.flags.includes('fast')).length;
  const helped = results.filter((r) => r.evidence.score > 0 && r.evidence.score < 1).length;
  const xp = results.reduce((s, r) => s + r.evidence.xp, 0);
  const counts = new Map<string, number>();
  for (const r of results) for (const m of r.misconceptions) counts.set(m, (counts.get(m) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const tip = top ? content.misconceptions.get(top[0]) : undefined;

  return (
    <section className="stack" style={{ gap: 'var(--s-5)', marginTop: 'var(--s-5)' }}>
      <h2 className="title">סיימנו סבב</h2>
      <div className="panel stack">
        <div className="spread">
          <span>נכון בניסיון הראשון</span>
          <strong>
            {clean} / {results.length}
          </strong>
        </div>
        {helped > 0 && (
          <div className="spread">
            <span>נכון בעזרת רמז</span>
            <strong>{helped}</strong>
          </div>
        )}
        <div className="spread">
          <span>נקודות</span>
          <strong>+{xp}</strong>
        </div>
      </div>
      {tip && (
        <div className="panel stack">
          <span className="section-label">נקודה אחת לזכור</span>
          <p>{tip.tip.he}</p>
        </div>
      )}
      <div className="stack">
        <button className="btn btn-primary btn-block" onClick={onAgain}>
          עוד סבב
        </button>
        <button className="btn btn-block" onClick={onHome}>
          חזרה למסך הבית
        </button>
      </div>
    </section>
  );
}
