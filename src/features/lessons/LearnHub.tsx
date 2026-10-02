import { Link, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useServices } from '@/app/services';
import { useProfile, useStudent } from '@/app/hooks';
import { TopBar } from '@/ui/TopBar';
import { ChevronIcon } from '@/ui/icons';
import { DOMAINS, domainOf } from '@/domain/skills/taxonomy';
import { domainNameHe } from '@/domain/student/profile';
import { compareLevels } from '@/domain/skills/cefr';
import { LessonView } from './LessonView';

/** Library of lessons, grouped by domain, easiest first. */
export function LearnHub() {
  const { sid } = useParams();
  const { content } = useServices();
  const student = useStudent(sid);
  const profile = useProfile(student);
  if (!student) return <main className="screen" />;
  const weak = new Set(profile?.weakSkills.map((s) => s.skillId) ?? []);
  const lessons = [...content.lessons.values()].sort((a, b) => compareLevels(a.level, b.level));

  return (
    <main className="screen">
      <TopBar back={`/s/${student.id}`} title="שיעורים" />
      <p className="small muted">הסבר קצר, דוגמאות עם הקראה, טעויות נפוצות, ואז תרגול על הנושא.</p>
      {DOMAINS.map((d) => {
        const ls = lessons.filter((l) => domainOf(l.skill) === d);
        if (!ls.length) return null;
        return (
          <section key={d} className="stack">
            <span className="section-label">{domainNameHe(d)}</span>
            <nav className="list">
              {ls.map((l) => (
                <Link key={l.id} to={`/s/${student.id}/learn/${l.id}`} className="list-item" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className="grow">
                    {l.title.he}
                    {[...weak].some((w) => w.startsWith(l.skill)) && <span className="badge badge-warn" style={{ marginInlineStart: 8 }}>כדאי לחזק</span>}
                  </span>
                  <span className="xs muted" dir="ltr">{l.level}</span>
                  <ChevronIcon />
                </Link>
              ))}
            </nav>
          </section>
        );
      })}
    </main>
  );
}

export function LessonScreen() {
  const { sid, lessonId } = useParams();
  const { content, store } = useServices();
  const student = useStudent(sid);
  const lesson = lessonId ? content.lessons.get(lessonId) : undefined;
  useEffect(() => {
    if (student && lesson) void store.log(student.id, 'lesson.viewed', { lessonId: lesson.id, skill: lesson.skill });
  }, [student, lesson, store]);
  if (!student) return <main className="screen" />;
  if (!lesson) return <main className="screen empty">השיעור לא נמצא</main>;
  const practiceCount = content.items.filter((i) => i.skill === lesson.skill || i.skill.startsWith(`${lesson.skill}.`)).length;
  return (
    <main className="screen">
      <TopBar back={`/s/${student.id}/learn`} />
      <LessonView lesson={lesson} />
      {practiceCount > 0 && (
        <div className="actions">
          <Link to={`/s/${student.id}/practice/skill?skill=${encodeURIComponent(lesson.skill)}`} className="btn btn-primary">
            תרגול על הנושא
          </Link>
        </div>
      )}
    </main>
  );
}
