import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { parentGate } from '@/app/parentGate';
import { useStudents } from '@/app/hooks';
import { Avatar } from '@/ui/Avatar';
import { LockIcon, PlusIcon } from '@/ui/icons';
import { HoldButton } from '@/features/kids/ParentGate';

/** Who is learning now? A symmetric grid of large cards; the parent area needs a long press. */
export function StudentPicker() {
  const students = useStudents();
  const nav = useNavigate();
  // Back on the picker: the parent area needs the long press again.
  useEffect(() => parentGate.lock(), []);

  return (
    <main className="screen picker">
      <div className="picker-intro">
        <span className="brand-mark" aria-hidden="true" lang="en">
          En
        </span>
        <h1 className="page-title">למי התור ללמוד?</h1>
        <p className="subtitle">לכל תלמיד מסלול משלו</p>
      </div>

      {students === undefined ? null : (
        <nav className="student-grid" aria-label="תלמידים">
          {students.map((s) => (
            <Link key={s.id} to={`/s/${s.id}`} className="student-card">
              <Avatar name={s.name} hue={s.hue} size={72} />
              <strong>
                <bdi>{s.name}</bdi>
              </strong>
            </Link>
          ))}
        </nav>
      )}
      <Link to="/new" className="add-row">
        <span className="add-icon" aria-hidden="true">
          <PlusIcon size={20} />
        </span>
        הוספת תלמיד
      </Link>

      <div className="mt-auto parent-gate">
        <HoldButton wide label="מצב הורה: להחזיק לחוץ כדי להיכנס" onDone={() => {
            parentGate.unlock();
            nav('/parent');
          }}>
          <span className="gate-inner">
            <LockIcon size={18} />
            מצב הורה
          </span>
        </HoldButton>
        <span className="small muted">להחזיק לחוץ כדי להיכנס</span>
      </div>
    </main>
  );
}
