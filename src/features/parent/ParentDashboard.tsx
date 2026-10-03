import { useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { useServices } from '@/app/services';
import { useProfile, useStudents } from '@/app/hooks';
import { domainNameHe, type DomainSummary, type LearnerProfile } from '@/domain/student/profile';
import type { Student } from '@/domain/student/student';
import { Avatar } from '@/ui/Avatar';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { DomainIcon } from '@/ui/DomainIcon';
import { TopBar } from '@/ui/TopBar';
import { Stack } from '@/ui/layout';
import { ChevronIcon, ShieldIcon } from '@/ui/icons';
import { Art } from '@/ui/Art';
import { Button } from '@/ui/Button';
import type { ParentLabel } from '@/domain/learning/mastery';
import { localDay } from '@/domain/learning/events';
import { ThemePicker } from '@/ui/ThemePicker';
import { normalizeServerUrl } from './serverUrl';
import type { PrerenderedProvider } from '@/services/speech/tts/prerenderedProvider';

const LABEL: Record<ParentLabel, { he: string; cls: string }> = {
  strong: { he: 'חזק', cls: 'badge-good' },
  improving: { he: 'משתפר', cls: 'badge-accent' },
  medium: { he: 'בינוני', cls: 'badge-neutral' },
  'needs-work': { he: 'דורש חיזוק', cls: 'badge-warn' },
  'not-assessed': { he: 'עוד לא נבדק', cls: 'badge-neutral' },
};

/** A real picture of each child's abilities. No single overall score. */
export function ParentDashboard() {
  const students = useStudents(true);
  const [selected, setSelected] = useState<string | null>(null);
  // With every student hidden, still show the first one (it has the "restore" button).
  const active = students?.find((s) => s.id === selected) ?? students?.find((s) => !s.archived) ?? students?.[0] ?? null;

  return (
    <main className="screen">
      <TopBar back="/" title="מצב הורה" />
      {students && students.length > 0 && (
        <div className="kid-tabs" role="tablist" aria-label="תלמידים">
          {students.map((s) => (
            <button key={s.id} role="tab" className="kid-tab" aria-selected={active?.id === s.id} onClick={() => setSelected(s.id)}>
              <Avatar name={s.name} hue={s.hue} size={28} />
              <span>
                <bdi>{s.name}</bdi>
                {s.archived ? ' (מוסתר)' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
      {active ? (
        <StudentReport key={active.id} student={active} />
      ) : (
        <div className="panel empty-state">
          <Art name="parent" size={96} tone="writing" fallback={<ShieldIcon />} />
          <p className="t-h3">עוד אין תלמידים</p>
          <p className="small muted">מוסיפים תלמיד במסך הפתיחה, וכאן יופיע הדוח שלו.</p>
        </div>
      )}
      <DeviceSection />
    </main>
  );
}

function StudentReport({ student }: { student: Student }) {
  const profile = useProfile(student);
  const { store } = useServices();
  if (!profile) return null;
  const p = profile;
  const a = p.activity;

  return (
    <Stack gap={5}>
      <div className="report-head">
        <Avatar name={student.name} hue={student.hue} size={56} />
        <div className="grow">
          <div className="t-h2">
            <bdi>{student.name}</bdi>
          </div>
          <div className="small muted">
            {a.lastActiveDay ? `פעילות אחרונה: ${formatDay(a.lastActiveDay)}` : 'עדיין אין תרגול'}
          </div>
        </div>
        {student.archived && (
          <Button size="sm" onClick={() => store.updateStudent(student.id, { archived: false })}>
            שחזור
          </Button>
        )}
      </div>

      {a.itemsTotal === 0 ? (
        <div className="panel empty-state compact">
          <Art name="parent" size={88} tone="writing" fallback={<ShieldIcon />} />
          <p className="t-strong">עוד אין פעילות להציג</p>
          <p className="small muted">אחרי האבחון הקצר יופיעו כאן הרמה בכל תחום, הטעויות שחוזרות והמלצה לשבוע.</p>
        </div>
      ) : (
        <section className="stack gap-2">
          <h2 className="section-title">פעילות</h2>
          <div className="grid-3 gap-2">
            <Stat value={a.minutesLast7} label="דקות השבוע" />
            <Stat value={`${a.activeDaysLast7}/7`} label="ימים השבוע" />
            <Stat value={a.streakDays} label="ימים ברצף" />
            <Stat value={a.activeDaysLast30} label="ימים ב־30 יום" />
            <Stat value={a.itemsTotal} label="תרגילים" />
            <Stat value={a.minutesTotal} label="דקות בסך הכל" />
          </div>
        </section>
      )}

      <section className="stack gap-2">
        <h2 className="section-title">מפת מיומנויות</h2>
        <div className="list">
          {p.domains.map((d) => (
            <DomainRow key={d.domain} d={d} />
          ))}
        </div>
        <p className="small muted">הרמה משוערת לפי סולם CEFR. מד הביטחון מראה כמה המערכת בטוחה בהערכה.</p>
      </section>

      {(p.weakSkills.length > 0 || p.strongSkills.length > 0) && (
        <section className="stack gap-2">
          <h2 className="section-title">פירוט</h2>
          <div className="panel stack">
            {p.weakSkills.length > 0 && (
              <div>
                <div className="small muted">מתקשה ב</div>
                <He>{p.weakSkills.map((s) => s.name.he).join(' · ')}</He>
              </div>
            )}
            {p.strongSkills.length > 0 && (
              <div>
                <div className="small muted">שולט/ת ב</div>
                <He>{p.strongSkills.map((s) => s.name.he).join(' · ')}</He>
              </div>
            )}
          </div>
        </section>
      )}

      {p.memory.length > 0 && (
        <section className="stack gap-2">
          <h2 className="section-title">טעויות חוזרות</h2>
          <div className="list">
            {p.memory.map((m) => (
              <Stack key={m.misconceptionId} gap={1} align="start" className="list-item">
                <He>{m.note.he}</He>
                <span className="xs muted">{m.count} פעמים · לאחרונה {formatDay(localDay(m.lastSeenAt))}</span>
              </Stack>
            ))}
          </div>
        </section>
      )}

      <Words p={p} />

      {p.recommendations.length > 0 && (
        <section className="stack gap-2">
          <h2 className="section-title">המלצה לשבוע הקרוב</h2>
          <ul className="panel stack plain-list">
            {p.recommendations.map((r) => (
              <li key={r}><He>{r}</He></li>
            ))}
          </ul>
        </section>
      )}
    </Stack>
  );
}

function DomainRow({ d }: { d: DomainSummary }) {
  // A few answers give a level, but not yet a judgement.
  const label = d.label === 'not-assessed' && d.attempts > 0 ? { he: 'הערכה ראשונית', cls: 'badge-neutral' } : LABEL[d.label];
  const dots = Math.round(d.confidence * 5);
  return (
    <div className={`skill-row tone-${d.domain}`}>
      <Art name={d.domain as never} size={44} tone={d.domain} fallback={<DomainIcon domain={d.domain} />} />
      <span className="skill-row-title">
        <strong>{domainNameHe(d.domain)}</strong>
        <En className="small muted">{d.domain[0]!.toUpperCase() + d.domain.slice(1)}</En>
      </span>
      <span className={`badge ${label.cls}`}>{label.he}</span>
      <div className="skill-facts">
        <span className="fact">
          <span className="fact-k">רמה</span>
          <span className="fact-v num" lang="en">{d.level ?? '–'}</span>
        </span>
        <span className="fact">
          <span className="fact-k">יעד</span>
          <span className="fact-v num" lang="en">{d.target}</span>
        </span>
        <span className="fact">
          <span className="fact-k">תשובות</span>
          <span className="fact-v num">{d.attempts}</span>
        </span>
        <span className="fact fact-wide">
          <span className="fact-k">ביטחון</span>
          <span className="conf" role="meter" aria-valuemin={0} aria-valuemax={5} aria-valuenow={dots} aria-label={`ביטחון ${dots} מתוך 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} className={i < dots ? 'on' : ''} />
            ))}
          </span>
        </span>
      </div>
      {d.trend === 'improving' && <span className="trend trend-up">מגמת שיפור</span>}
      {d.trend === 'declining' && <span className="trend trend-down">ירידה</span>}
    </div>
  );
}

function Words({ p }: { p: LearnerProfile }) {
  const { learned, struggling, recognizedNotProduced, due } = p.words;
  if (!learned.length && !struggling.length && !due) return null;
  return (
    <section className="stack gap-2">
      <h2 className="section-title">אוצר מילים</h2>
      <div className="panel stack">
        <div className="spread small">
          <span className="muted">נלמדו</span>
          <span>{learned.length}</span>
        </div>
        {learned.length > 0 && <En className="small">{learned.join(', ')}</En>}
        {struggling.length > 0 && (
          <>
            <div className="small muted">מילים קשות</div>
            <En className="small">{struggling.join(', ')}</En>
          </>
        )}
        {recognizedNotProduced.length > 0 && (
          <>
            <div className="small muted">מזהה אבל עוד לא כותב/ת</div>
            <En className="small">{recognizedNotProduced.join(', ')}</En>
          </>
        )}
        <div className="spread small">
          <span className="muted">לחזרה היום</span>
          <span>{due}</span>
        </div>
      </div>
    </section>
  );
}

function DeviceSection() {
  const { store, settings, speech } = useServices();
  useSyncExternalStore(settings.subscribe, settings.snapshot);
  const [dl, setDl] = useState<{ done: number; total: number } | null>(null);

  const downloadAudio = async () => {
    const p = speech.getProviders().find((x) => x.id === 'prerendered') as PrerenderedProvider | undefined;
    if (!p) return;
    if (!navigator.onLine) return setMsg('ההורדה לא הצליחה. צריך חיבור לאינטרנט.');
    setDl({ done: 0, total: 1 });
    const r = await p.downloadAll((done, total) => setDl({ done, total }));
    setDl(null);
    setMsg(
      r.done === 0 || r.done === r.failed
        ? 'ההורדה לא הצליחה. צריך חיבור לאינטרנט.'
        : r.failed
          ? `הורדו ${r.done - r.failed} קבצים. ${r.failed} נכשלו, כדאי לנסות שוב.`
          : `כל ${r.done} קובצי ההקראה זמינים עכשיו גם בלי אינטרנט.`,
    );
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [url, setUrl] = useState(settings.get('homeServerUrl') ?? '');

  const exportBackup = async () => {
    const data = await store.exportBackup();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `english-tutor-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg('קובץ הגיבוי נשמר.');
  };

  const importBackup = async (f: File) => {
    try {
      const r = await store.importBackup(JSON.parse(await f.text()));
      setMsg(`שוחזרו ${r.students} תלמידים ו־${r.events} אירועים.`);
    } catch (e) {
      const newer = (e as Error).message.includes('newer');
      setMsg(newer ? 'השחזור נכשל: הגיבוי נוצר בגרסה חדשה יותר של האפליקציה. כדאי לעדכן ולנסות שוב.' : 'השחזור נכשל: זה לא קובץ גיבוי של האפליקציה.');
    }
  };

  return (
    <section className="stack gap-4 device-section" aria-labelledby="device-title">
      <div className="section-intro">
        <h2 className="section-title" id="device-title">
          מכשיר ונתונים
        </h2>
        <p className="small muted">כל הנתונים נשמרים במכשיר בלבד. מומלץ לגבות פעם בשבוע.</p>
      </div>
      <div className="settings-card">
        <ThemePicker />
      </div>
      <div className="list">
        <Link to="/parent/voices" className="list-item">
          <span className="grow stack gap-0">
            <strong>מעבדת קולות</strong>
            <span className="small muted">להשוות קולות ולבחור את הטבעי ביותר</span>
          </span>
          <span className="chev">
            <ChevronIcon />
          </span>
        </Link>
        <button className="list-item" onClick={() => settings.set({ soundOff: !settings.get('soundOff') })} aria-pressed={!settings.get('soundOff')}>
          <span className="grow stack gap-0">
            <strong>צלילי משוב</strong>
            <span className="small muted">צליל קצר לתשובה נכונה ולא נכונה</span>
          </span>
          <span className="switch" data-on={!settings.get('soundOff')} aria-hidden="true">
            <span />
          </span>
          <span className="sr-only">{settings.get('soundOff') ? 'כבוי' : 'פעיל'}</span>
        </button>
        <button className="list-item" onClick={downloadAudio} disabled={!!dl}>
          <span className="grow stack gap-0">
            <strong>{dl ? 'מוריד הקראות…' : 'הקראות בלי אינטרנט'}</strong>
            <span className="small muted">{dl ? `${dl.done} מתוך ${dl.total}` : 'להוריד את כל ההקראות למכשיר'}</span>
          </span>
        </button>
        <button className="list-item" onClick={exportBackup}>
          <span className="grow stack gap-0">
            <strong>גיבוי לקובץ</strong>
            <span className="small muted">קובץ אחד עם כל התלמידים וההיסטוריה</span>
          </span>
        </button>
        <button className="list-item" onClick={() => fileRef.current?.click()}>
          <span className="grow stack gap-0">
            <strong>שחזור מגיבוי</strong>
            <span className="small muted">לבחור קובץ גיבוי מהמכשיר</span>
          </span>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Cleared so choosing the same file again fires a new change.
          e.target.value = '';
          if (f) void importBackup(f);
        }}
      />
      <div className="settings-card field">
        <label htmlFor="srv">כתובת שרת ביתי להקראה (לא חובה)</label>
        <div className="input-row">
          <input id="srv" className="input" dir="ltr" placeholder="http://192.168.1.20:8880" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoCapitalize="off" autoCorrect="off" />
          <Button
            size="lg"
            onClick={async () => {
              const clean = normalizeServerUrl(url);
              setUrl(clean);
              await settings.set({ homeServerUrl: clean });
              setMsg('נשמר.');
            }}
          >
            שמירה
          </Button>
        </div>
      </div>
      {msg && (
        <p className="small" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="stat">
      <b className="num">{value}</b>
      <span>{label}</span>
    </div>
  );
}

function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y?.slice(2)}`;
}
