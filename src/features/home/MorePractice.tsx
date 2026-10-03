import { useParams } from 'react-router-dom';
import { useProfile, useStudent } from '@/app/hooks';
import { TopBar } from '@/ui/TopBar';
import { Stack } from '@/ui/layout';
import { RowLink } from '@/ui/RowLink';
import { GROUPS } from './moreModes';
import { heCount } from '@/domain/text/heCount';

/** "עוד תרגולים": the full catalog, grouped, one list per group. */
export function MorePractice() {
  const { sid } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  if (student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  if (!student) return <main className="screen" />;
  const base = `/s/${student.id}`;
  const due = profile?.words.due ?? 0;
  return (
    <main className="screen">
      <TopBar back={base} title="עוד תרגולים" />
      {GROUPS.map((g) => (
        <Stack as="section" gap={2} key={g.title} aria-label={g.title}>
          <div className="section-intro">
            <h2 className="section-title">{g.title}</h2>
            <p className="small muted">{g.lead}</p>
          </div>
          <div className="list">
            {g.items.map((it) => (
              <RowLink
                key={it.path}
                to={`${base}/${it.path}`}
                art={it.art}
                tone={it.tone}
                icon={it.icon}
                title={it.title}
                sub={it.path === 'practice/review' && due > 0 ? `${heCount(due, 'מילה אחת', 'מילים')} לחזרה היום` : it.sub}
              />
            ))}
          </div>
        </Stack>
      ))}
    </main>
  );
}
