import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useServices } from '@/app/services';
import { useStudents } from '@/app/hooks';
import { birthYearFromAge, decodeFamily } from './familySetup';

/** Creates the family's profiles from a setup link, skipping names that already exist. */
export function FamilySetup() {
  const [search] = useSearchParams();
  const members = decodeFamily(search.get('d'));
  const students = useStudents(true);
  const { store } = useServices();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const existing = new Set(students?.map((s) => s.name) ?? []);
  const toCreate = members.filter((m) => !existing.has(m.name));

  const create = async () => {
    setBusy(true);
    for (const m of toCreate) {
      await store.createStudent({ name: m.name, ...(m.age ? { birthYear: birthYearFromAge(m.age) } : {}) });
    }
    nav('/', { replace: true });
  };

  return (
    <main className="screen">
      <div className="stack" style={{ marginTop: 'var(--s-6)' }}>
        <h1 className="title">הגדרת המשפחה</h1>
        <p className="subtitle">הפרופילים נשמרים רק במכשיר הזה.</p>
      </div>
      {members.length === 0 ? (
        <p className="muted">הקישור לא תקין.</p>
      ) : (
        <>
          <div className="list">
            {members.map((m) => (
              <div key={m.name} className="list-item">
                <span className="grow">{m.name}</span>
                {m.age && <span className="small muted">בן/בת {m.age}</span>}
                {existing.has(m.name) && <span className="badge badge-neutral">קיים</span>}
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-block" disabled={busy || toCreate.length === 0 || !students} onClick={create}>
            {toCreate.length ? `יצירת ${toCreate.length} פרופילים` : 'כל הפרופילים כבר קיימים'}
          </button>
          <p className="xs muted">אחרי היצירה כל אחד עושה אבחון קצר. מסלול 3, 4 או 5 יחידות נבחר בהגדרות של כל תלמיד.</p>
        </>
      )}
    </main>
  );
}
