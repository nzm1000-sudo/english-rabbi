import { Link, useNavigate } from 'react-router-dom';
import { useStudents } from '@/app/hooks';
import { Avatar } from '@/ui/Avatar';
import { ChevronIcon, PlusIcon } from '@/ui/icons';

/** Who is learning now? One tap per child. */
export function StudentPicker() {
  const students = useStudents();
  const nav = useNavigate();

  return (
    <main className="screen">
      <div className="stack" style={{ marginTop: 'var(--s-6)' }}>
        <h1 className="title">מי לומד עכשיו?</h1>
        <p className="subtitle">בחירת תלמיד כדי להמשיך מאיפה שעצרנו</p>
      </div>

      {students === undefined ? null : students.length === 0 ? (
        <div className="panel stack">
          <p>עוד אין תלמידים. אפשר להוסיף את הראשון.</p>
          <button className="btn btn-primary" onClick={() => nav('/new')}>
            הוספת תלמיד
          </button>
        </div>
      ) : (
        <nav className="list" aria-label="תלמידים">
          {students.map((s) => (
            <Link key={s.id} to={`/s/${s.id}`} className="list-item" style={{ color: 'inherit', textDecoration: 'none' }}>
              <Avatar name={s.name} hue={s.hue} />
              <span className="grow" style={{ fontSize: 'var(--t-lg)', fontWeight: 550 }}>
                {s.name}
              </span>
              <span className="chev">
                <ChevronIcon />
              </span>
            </Link>
          ))}
          <Link to="/new" className="list-item" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            <span className="avatar" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}>
              <PlusIcon />
            </span>
            <span className="grow">הוספת תלמיד</span>
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
