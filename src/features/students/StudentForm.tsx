import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServices } from '@/app/services';
import { useStudent } from '@/app/hooks';
import { TopBar } from '@/ui/TopBar';
import { ThemePicker } from '@/ui/ThemePicker';
import { Button } from '@/ui/Button';
import { ConfirmSheet } from '@/ui/Sheet';
import { Stack } from '@/ui/layout';
import { CheckIcon } from '@/ui/icons';
import { stageOf, type AgeStage } from '@/domain/student/student';
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
  const [age, setAge] = useState(student?.birthYear ? String(new Date().getFullYear() - student.birthYear) : '');
  const [stage, setStage] = useState<AgeStage | 'auto'>(student?.stage ?? 'auto');
  const [kidsLimit, setKidsLimit] = useState<number>(student?.kidsDailyLimit ?? 0);
  const ageNum = Number(age);
  const birthYear = age && ageNum >= 2 && ageNum < 120 ? new Date().getFullYear() - Math.round(ageNum) : undefined;
  const effective = stage === 'auto' ? stageOf({ ...(birthYear ? { birthYear } : {}) }) : stage;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (i: Interest) => setInterests((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateStudentName(name);
    if (err) return setError(err);
    setSaving(true);
    const preferences = { ...(student?.preferences ?? {}), accent, speechRate: rate, dailyGoalMinutes: goal };
    const extra = {
      ...(birthYear ? { birthYear } : {}),
      stage: stage === 'auto' ? undefined : stage,
      kidsDailyLimit: kidsLimit || undefined,
    };
    if (student) {
      await store.updateStudent(student.id, { name: name.trim(), goal: { ...student.goal, track }, interests, preferences, ...extra });
      nav(`/s/${student.id}`);
    } else {
      const s = await store.createStudent({ name, goal: { track }, interests, preferences, ...(birthYear ? { birthYear } : {}) });
      if (extra.stage || extra.kidsDailyLimit) await store.updateStudent(s.id, extra);
      nav(`/s/${s.id}`);
    }
  };

  const [confirmArchive, setConfirmArchive] = useState(false);
  const archive = async () => {
    if (!student) return;
    setConfirmArchive(false);
    await store.archiveStudent(student.id);
    nav('/');
  };

  return (
    <main className="screen">
      <TopBar back={student ? `/s/${student.id}` : '/'} title={student ? 'הגדרות' : 'תלמיד חדש'} />
      <form className="stack gap-5" onSubmit={submit} noValidate>
        <Group title="פרופיל">
          <div className="form-grid">
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
                aria-describedby={error ? 'name-err' : undefined}
              />
            </div>
            <div className="field">
              <label htmlFor="age">גיל</label>
              <input id="age" className="input" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="למשל 15" />
            </div>
          </div>
          {error && (
            <span className="small error-text" id="name-err">
              {error}
            </span>
          )}
        </Group>

        <Group title="איזו אפליקציה לראות" hint="אפשר לשנות בכל רגע.">
          <div className="radio-list" role="radiogroup" aria-label="שלב גיל">
            {STAGES.map((o) => (
              <button type="button" role="radio" key={o.id} aria-checked={stage === o.id} className="radio-row" onClick={() => setStage(o.id)}>
                <span className="radio-dot" aria-hidden="true" />
                <span className="grow stack gap-0">
                  <strong>{o.title}</strong>
                  <span className="small muted">{o.id === 'auto' ? `${o.desc} ${STAGE_NOW[effective]}` : o.desc}</span>
                </span>
              </button>
            ))}
          </div>
          {effective === 'little' && (
            <div className="field">
              <span className="label">זמן משחק ביום</span>
              <div className="segmented" role="group" aria-label="זמן משחק ביום">
                {[0, 10, 15, 20, 30].map((m) => (
                  <button type="button" key={m} aria-pressed={kidsLimit === m} onClick={() => setKidsLimit(m)}>
                    {m ? `${m} דק׳` : 'ללא'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Group>

        <Group title="לימוד">
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
            <span className="label">יעד יומי</span>
            <div className="segmented" role="group" aria-label="יעד יומי">
              {[5, 10, 15, 20].map((m) => (
                <button type="button" key={m} aria-pressed={goal === m} onClick={() => setGoal(m)}>
                  {m} דק׳
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label">תחומי עניין</span>
            <div className="chip-grid">
              {INTERESTS.map((i) => (
                <button type="button" key={i} className="chip" aria-pressed={interests.includes(i)} onClick={() => toggle(i)}>
                  {interests.includes(i) && <CheckIcon size={16} />}
                  {INTEREST_LABELS[i]}
                </button>
              ))}
            </div>
          </div>
        </Group>

        <Group title="קול">
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
            {accent === 'en-GB' && <span className="small muted">במבטא בריטי ההקראה היא בקול של המכשיר, פחות טבעי.</span>}
          </div>
          <div className="field">
            <span className="label">מהירות הקראה</span>
            <div className="segmented" role="group" aria-label="מהירות">
              <button type="button" aria-pressed={rate === 'slower'} onClick={() => setRate('slower')}>
                איטי מאוד
              </button>
              <button type="button" aria-pressed={rate === 'slow'} onClick={() => setRate('slow')}>
                איטי
              </button>
              <button type="button" aria-pressed={rate === 'normal'} onClick={() => setRate('normal')}>
                רגיל
              </button>
            </div>
          </div>
        </Group>

        <Group title="מראה" hint="חל על כל המכשיר.">
          <ThemePicker bare />
        </Group>

        <Stack gap={2}>
          <Button type="submit" variant="primary" size="lg" block loading={saving}>
            {student ? 'שמירה' : 'יצירה'}
          </Button>
          {student && (
            <Button variant="tertiary" size="lg" block className="danger-text" onClick={() => setConfirmArchive(true)}>
              הסתרת תלמיד
            </Button>
          )}
        </Stack>
      </form>
      {student && (
        <ConfirmSheet
          open={confirmArchive}
          title={`להסתיר את ${student.name}?`}
          body="ההיסטוריה נשמרת, ואפשר לשחזר בכל רגע ממצב הורה."
          confirmLabel="הסתרה"
          danger
          onConfirm={() => void archive()}
          onCancel={() => setConfirmArchive(false)}
        />
      )}
    </main>
  );
}

const STAGES: { id: AgeStage | 'auto'; title: string; desc: string }[] = [
  { id: 'auto', title: 'לפי הגיל', desc: 'בוחרים לבד לפי הגיל.' },
  { id: 'little', title: 'קטנים', desc: 'גילאי 3 עד 6. בלי קריאה: שומעים מילה ולוחצים על התמונה.' },
  { id: 'young', title: 'מתחילים לקרוא', desc: 'גילאי 6 עד 12. אותיות, צלילים, מילים קצרות וספרונים.' },
  { id: 'regular', title: 'רגילה', desc: 'האפליקציה המלאה: אוצר מילים, דקדוק, סיפורים ובגרות.' },
];
const STAGE_NOW: Record<AgeStage, string> = { little: 'עכשיו: קטנים.', young: 'עכשיו: מתחילים לקרוא.', regular: 'עכשיו: רגילה.' };

/** A titled card that groups related settings. */
function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="stack gap-2">
      <div className="section-intro">
        <h2 className="section-title">{title}</h2>
        {hint && <p className="small muted">{hint}</p>}
      </div>
      <div className="settings-card stack gap-4">{children}</div>
    </section>
  );
}
