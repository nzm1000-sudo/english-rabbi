import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServices } from '@/app/services';
import { useStudent } from '@/app/hooks';
import { TopBar } from '@/ui/TopBar';
import {
  INTERESTS,
  INTEREST_LABELS,
  validateStudentName,
  type Accent,
  type Interest,
  type LearningGoal,
  type SpeechRate,
  type Student,
} from '@/domain/student/student';

const TRACKS: { id: LearningGoal['track']; label: string }[] = [
  { id: 'general', label: 'כללי' },
  { id: 'units-3', label: '3 יח״ל' },
  { id: 'units-4', label: '4 יח״ל' },
  { id: 'units-5', label: '5 יח״ל' },
];

/** Create a student (/new) or edit settings (/s/:sid/settings). */
export function StudentForm() {
  const { sid } = useParams();
  const student = useStudent(sid);
  if (sid && student === undefined) return null;
  if (sid && student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  return <StudentFormInner key={student?.id ?? 'new'} student={student ?? null} />;
}

function StudentFormInner({ student }: { student: Student | null }) {
  const { store } = useServices();
  const nav = useNavigate();
  const [name, setName] = useState(student?.name ?? '');
  const [track, setTrack] = useState<LearningGoal['track']>(student?.goal.track ?? 'general');
  const [interests, setInterests] = useState<Interest[]>(student?.interests ?? []);
  const [accent, setAccent] = useState<Accent>(student?.preferences.accent ?? 'en-US');
  const [rate, setRate] = useState<SpeechRate>(student?.preferences.speechRate ?? 'normal');
  const [goal, setGoal] = useState(student?.preferences.dailyGoalMinutes ?? 10);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (i: Interest) => setInterests((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateStudentName(name);
    if (err) return setError(err);
    setSaving(true);
    const preferences = { ...(student?.preferences ?? {}), accent, speechRate: rate, dailyGoalMinutes: goal };
    if (student) {
      await store.updateStudent(student.id, { name: name.trim(), goal: { ...student.goal, track }, interests, preferences });
      nav(`/s/${student.id}`);
    } else {
      const s = await store.createStudent({ name, goal: { track }, interests, preferences });
      nav(`/s/${s.id}`);
    }
  };

  const archive = async () => {
    if (!student) return;
    if (!confirm(`להסתיר את ${student.name}? ההיסטוריה נשמרת ואפשר לשחזר ממצב הורה.`)) return;
    await store.archiveStudent(student.id);
    nav('/');
  };

  return (
    <main className="screen">
      <TopBar back={student ? `/s/${student.id}` : '/'} title={student ? 'הגדרות' : 'תלמיד חדש'} />
      <form className="stack" style={{ gap: 'var(--s-5)' }} onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="name">שם</label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            autoComplete="off"
            enterKeyHint="next"
            aria-invalid={!!error}
          />
          {error && <span className="small" style={{ color: 'var(--bad)' }}>{error}</span>}
        </div>

        <div className="field">
          <span className="label">מסלול</span>
          <div className="segmented" role="group" aria-label="מסלול">
            {TRACKS.map((t) => (
              <button type="button" key={t.id} aria-pressed={track === t.id} onClick={() => setTrack(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">תחומי עניין</span>
          <div className="chips">
            {INTERESTS.map((i) => (
              <button type="button" key={i} className="chip" aria-pressed={interests.includes(i)} onClick={() => toggle(i)}>
                {INTEREST_LABELS[i]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">מבטא</span>
          <div className="segmented" role="group" aria-label="מבטא">
            <button type="button" aria-pressed={accent === 'en-US'} onClick={() => setAccent('en-US')}>
              אמריקאי
            </button>
            <button type="button" aria-pressed={accent === 'en-GB'} onClick={() => setAccent('en-GB')}>
              בריטי
            </button>
          </div>
        </div>

        <div className="field">
          <span className="label">מהירות הקראה</span>
          <div className="segmented" role="group" aria-label="מהירות">
            <button type="button" aria-pressed={rate === 'slow'} onClick={() => setRate('slow')}>
              איטי
            </button>
            <button type="button" aria-pressed={rate === 'normal'} onClick={() => setRate('normal')}>
              רגיל
            </button>
          </div>
        </div>

        <div className="field">
          <span className="label">יעד יומי</span>
          <div className="segmented" role="group" aria-label="יעד יומי">
            {[5, 10, 15, 20].map((m) => (
              <button type="button" key={m} aria-pressed={goal === m} onClick={() => setGoal(m)}>
                {m} דק׳
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-block" disabled={saving}>
          {student ? 'שמירה' : 'יצירה'}
        </button>
        {student && (
          <button type="button" className="btn btn-ghost btn-block" onClick={archive}>
            הסתרת תלמיד
          </button>
        )}
      </form>
    </main>
  );
}
