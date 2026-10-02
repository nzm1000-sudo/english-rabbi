import { Link } from 'react-router-dom';
import { useStudents } from '@/app/hooks';
import { Avatar } from '@/ui/Avatar';
import { PlusIcon } from '@/ui/icons';

/** Who is learning now? A symmetric grid of large cards. */
export function StudentPicker() {
  const students = useStudents();

  return (
    <main className="screen">
      <div className="stack" style={{ marginTop: 'var(--s-6)', textAlign: 'center', alignItems: 'center', gap: 'var(--s-2)' }}>
        <span className="rank-badge" aria-hidden="true" style={{ width: 64, height: 72, fontSize: 24 }} lang="en">
          En
        </span>
        <h1 className="title">מי לומד עכשיו?</h1>
        <p className="subtitle">כל אחד עם מסלול משלו</p>
      </div>

      {students === undefined ? null : (
        <nav className="student-grid" aria-label="תלמידים">
          {students.map((s) => (
            <Link key={s.id} to={`/s/${s.id}`} className="student-card">
              <Avatar name={s.name} hue={s.hue} size={72} />
              <strong>{s.name}</strong>
            </Link>
          ))}
          <Link to="/new" className="student-card add">
            <span className="avatar">
              <PlusIcon size={28} />
            </span>
            <strong>הוספה</strong>
          </Link>
        </nav>
      )}

      <div style={{ marginTop: 'auto', textAlign: 'center' }}>
        <Link to="/parent" className="btn btn-ghost btn-sm">
          מצב הורה
        </Link>
      </div>
    </main>
  );
}
