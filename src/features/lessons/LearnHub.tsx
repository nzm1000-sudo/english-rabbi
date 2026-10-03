import { He } from '@/ui/He';
import { Link, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useServices } from '@/app/services';
import { useProfile, useStudent } from '@/app/hooks';
import { TopBar } from '@/ui/TopBar';
import { Row } from '@/ui/layout';
import { ChevronIcon, RiddleIcon } from '@/ui/icons';
import { Art } from '@/ui/Art';
import { ButtonLink } from '@/ui/Button';
import type { CSSProperties } from 'react';
import { DOMAINS, domainOf } from '@/domain/skills/taxonomy';
import { domainNameHe } from '@/domain/student/profile';
import { compareLevels } from '@/domain/skills/cefr';
import { LessonView } from './LessonView';
import { DomainIcon } from '@/ui/DomainIcon';
import { pretestItems } from '@/features/practice/modes';

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
      <p className="subtitle">הסבר קצר, דוגמאות עם הקראה, טעויות נפוצות, ואז תרגול על הנושא.</p>
      {DOMAINS.map((d) => {
        const ls = lessons.filter((l) => domainOf(l.skill) === d);
        if (!ls.length) return null;
        return (
          <section key={d} className={`stack tone-${d}`}>
            <Row gap={2}>
              <Art name={d as never} size={40} tone={d} fallback={<DomainIcon domain={d} />} />
              <h2 className="section-title">{domainNameHe(d)}</h2>
            </Row>
            <nav className="list">
              {ls.map((l) => (
                <Link key={l.id} to={`/s/${student.id}/learn/${l.id}`} className="list-item">
                  <Row as="span" gap={2} wrap className="grow">
                    <He inline className="t-strong">{l.title.he}</He>
                    {[...weak].some((w) => w === l.skill || w.startsWith(`${l.skill}.`)) && <span className="badge badge-warn">כדאי לחזק</span>}
                  </Row>
                  <span className="level-chip" lang="en">
                    {l.level}
                  </span>
                  <span className="chev">
                    <ChevronIcon />
                  </span>
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
  // Reading lessons ask about passages, which the pretest leaves out: no card when it would be empty.
  const pretestCount = pretestItems(content, lesson.skill).length;
  return (
    <main className="screen">
      <TopBar back={`/s/${student.id}/learn`} />
      {pretestCount >= 3 && (
        <Link
          to={`/s/${student.id}/practice/pretest?skill=${encodeURIComponent(lesson.skill)}&lesson=${lesson.id}`}
          className="row-card"
          replace
        >
          <span className="art art-orb orb-speaking" style={{ '--art': '44px' } as CSSProperties} aria-hidden="true">
            <RiddleIcon />
          </span>
          <span className="grow">
            <strong>לנחש לפני ההסבר</strong>
            <span className="xs muted block">
              3 שאלות בלי לחץ. ניחוש לפני הלמידה עוזר לזכור יותר.
            </span>
          </span>
        </Link>
      )}
      <LessonView lesson={lesson} />
      {practiceCount > 0 && (
        <div className="actions">
          <ButtonLink to={`/s/${student.id}/practice/skill?skill=${encodeURIComponent(lesson.skill)}`} variant="primary" size="lg" block>
            תרגול על הנושא
          </ButtonLink>
        </div>
      )}
    </main>
  );
}
