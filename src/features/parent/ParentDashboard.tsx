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
import { ChevronIcon } from '@/ui/icons';
import type { ParentLabel } from '@/domain/learning/mastery';
import { localDay } from '@/domain/learning/events';
import { ThemePicker } from '@/ui/ThemePicker';
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
  const active = students?.find((s) => s.id === selected) ?? students?.find((s) => !s.archived) ?? null;

  return (
    <main className="screen">
      <TopBar back="/" title="מצב הורה" />
      {students && students.length > 0 && (
        <div className="chips" role="tablist" aria-label="תלמידים">
          {students.map((s) => (
            <button key={s.id} role="tab" className="chip" aria-pressed={active?.id === s.id} aria-selected={active?.id === s.id} onClick={() => setSelected(s.id)}>
              {s.name}
              {s.archived ? ' (מוסתר)' : ''}
            </button>
          ))}
        </div>
      )}
      {active ? <StudentReport key={active.id} student={active} /> : <p className="muted">עוד אין תלמידים.</p>}
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
    <div className="stack" style={{ gap: 'var(--s-5)' }}>
      <div className="row">
        <Avatar name={student.name} hue={student.hue} />
        <div className="grow">
          <div style={{ fontWeight: 650, fontSize: 'var(--t-lg)' }}>{student.name}</div>
          <div className="small muted">
            {a.lastActiveDay ? `פעילות אחרונה: ${formatDay(a.lastActiveDay)}` : 'עוד לא התחיל/ה לתרגל'}
          </div>
        </div>
        {student.archived && (
          <button className="btn btn-sm" onClick={() => store.updateStudent(student.id, { archived: false })}>
            שחזור
          </button>
        )}
      </div>

      <section className="stack">
        <span className="section-label">פעילות</span>
        <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s-3)', textAlign: 'center' }}>
          <Stat value={a.minutesLast7} label="דקות השבוע" />
          <Stat value={`${a.activeDaysLast7}/7`} label="ימים השבוע" />
          <Stat value={a.activeDaysLast30} label="ימים ב־30 יום" />
          <Stat value={a.streakDays} label="ימים ברצף" />
          <Stat value={a.itemsTotal} label="תרגילים" />
          <Stat value={a.minutesTotal} label="דקות בסך הכל" />
        </div>
      </section>

      <section className="stack">
        <span className="section-label">מפת מיומנויות</span>
        <div className="list">
          {p.domains.map((d) => (
            <DomainRow key={d.domain} d={d} />
          ))}
        </div>
        <p className="xs muted">הרמה משוערת לפי סולם CEFR. ריבועי הביטחון מראים כמה המערכת בטוחה בהערכה.</p>
      </section>

      {(p.weakSkills.length > 0 || p.strongSkills.length > 0) && (
        <section className="stack">
          <span className="section-label">פירוט</span>
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
        <section className="stack">
          <span className="section-label">טעויות חוזרות</span>
          <div className="list">
            {p.memory.map((m) => (
              <div key={m.misconceptionId} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <He>{m.note.he}</He>
                <span className="xs muted">{m.count} פעמים · לאחרונה {formatDay(localDay(m.lastSeenAt))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Words p={p} />

      {p.recommendations.length > 0 && (
        <section className="stack">
          <span className="section-label">המלצה לשבוע הקרוב</span>
          <ul className="panel stack" style={{ margin: 0, paddingInlineStart: 'var(--s-6)' }}>
            {p.recommendations.map((r) => (
              <li key={r}><He>{r}</He></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DomainRow({ d }: { d: DomainSummary }) {
  // A few answers give a level, but not yet a judgement.
  const label = d.label === 'not-assessed' && d.attempts > 0 ? { he: 'הערכה ראשונית', cls: 'badge-neutral' } : LABEL[d.label];
  const dots = Math.round(d.confidence * 5);
  return (
    <div className={`skill-row tone-${d.domain}`}>
      <span className="tile-icon">
        <DomainIcon domain={d.domain} size={20} />
      </span>
      <span>
        {domainNameHe(d.domain)} <En className="xs muted">{d.domain[0]!.toUpperCase() + d.domain.slice(1)}</En>
      </span>
      <span className={`badge ${label.cls}`}>{label.he}</span>
      <div className="meta">
        <span>רמה: {d.level ? <En>{d.level}</En> : '—'}</span>
        <span>
          יעד: <En>{d.target}</En>
        </span>
        <span className="conf" aria-label={`ביטחון ${dots} מתוך 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} className={i < dots ? 'on' : ''} />
          ))}
        </span>
        <span>{d.attempts} תשובות</span>
        {d.trend === 'improving' && <span style={{ color: 'var(--good)' }}>מגמת שיפור</span>}
        {d.trend === 'declining' && <span style={{ color: 'var(--warn)' }}>ירידה</span>}
      </div>
    </div>
  );
}

function Words({ p }: { p: LearnerProfile }) {
  const { learned, struggling, recognizedNotProduced, due } = p.words;
  if (!learned.length && !struggling.length && !due) return null;
  return (
    <section className="stack">
      <span className="section-label">אוצר מילים</span>
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
    setDl({ done: 0, total: 1 });
    const r = await p.downloadAll((done, total) => setDl({ done, total }));
    setDl(null);
    setMsg(r.failed ? `הורדו ${r.done - r.failed} קבצים. ${r.failed} נכשלו, כדאי לנסות שוב.` : `כל ${r.done} קובצי ההקראה זמינים עכשיו גם בלי אינטרנט.`);
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
      setMsg(`השחזור נכשל: ${(e as Error).message}`);
    }
  };

  return (
    <section className="stack" style={{ marginTop: 'var(--s-5)' }}>
      <span className="section-label">מכשיר ונתונים</span>
      <ThemePicker />
      <div className="list">
        <Link to="/parent/voices" className="list-item" style={{ color: 'inherit', textDecoration: 'none' }}>
          <span className="grow">מעבדת קולות</span>
          <ChevronIcon />
        </Link>
        <button className="list-item" onClick={() => settings.set({ soundOff: !settings.get('soundOff') })}>
          <span className="grow">צלילי משוב</span>
          <span className={`badge ${settings.get('soundOff') ? 'badge-neutral' : 'badge-good'}`}>{settings.get('soundOff') ? 'כבוי' : 'פעיל'}</span>
        </button>
        <button className="list-item" onClick={downloadAudio} disabled={!!dl}>
          <span className="grow">{dl ? `מוריד הקראות… ${dl.done}/${dl.total}` : 'הורדת כל ההקראות לשימוש בלי אינטרנט'}</span>
        </button>
        <button className="list-item" onClick={exportBackup}>
          <span className="grow">גיבוי לקובץ</span>
        </button>
        <button className="list-item" onClick={() => fileRef.current?.click()}>
          <span className="grow">שחזור מגיבוי</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
      <div className="field">
        <label htmlFor="srv">כתובת שרת ביתי להקראה (לא חובה)</label>
        <div className="row">
          <input id="srv" className="input grow" dir="ltr" placeholder="http://192.168.1.20:8880" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoCapitalize="off" autoCorrect="off" />
          <button className="btn" onClick={async () => { await settings.set({ homeServerUrl: url.trim() }); setMsg('נשמר.'); }}>
            שמירה
          </button>
        </div>
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
      <p className="xs muted">כל הנתונים נשמרים במכשיר בלבד. מומלץ לגבות פעם בשבוע.</p>
    </section>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--t-xl)', fontWeight: 650 }}>{value}</div>
      <div className="xs muted">{label}</div>
    </div>
  );
}

function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y?.slice(2)}`;
}
