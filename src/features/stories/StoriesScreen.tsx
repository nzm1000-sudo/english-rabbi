import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProfile, useStudent } from '@/app/hooks';
import { useServices } from '@/app/services';
import { CEFR_LEVELS, type CefrLevel } from '@/domain/skills/cefr';
import type { Story } from '@/domain/content/schema';
import type { Student } from '@/domain/student/student';
import type { LearnerProfile } from '@/domain/student/profile';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { TopBar } from '@/ui/TopBar';
import { Art } from '@/ui/Art';
import { BookIcon, ChatIcon, CheckIcon, ChevronIcon } from '@/ui/icons';

const LEVEL_HE: Partial<Record<CefrLevel, string>> = { A1: 'קל מאוד', A2: 'קל', B1: 'בינוני', B2: 'מתקדם', C1: 'מתקדם מאוד' };

/** The story level that fits: the reading level if known, else by age and track. */
export function storyLevelFor(student: Student, profile: LearnerProfile): CefrLevel {
  const reading = profile.domains.find((d) => d.domain === 'reading')?.level;
  if (reading) return reading;
  const age = student.birthYear ? new Date().getFullYear() - student.birthYear : undefined;
  if (age !== undefined && age <= 12) return 'A1';
  return student.goal.track === 'units-5' ? 'B1' : 'A2';
}

/** Story library: read stories and dialogues, grouped by level. */
export function StoriesScreen() {
  const { sid } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const { content, store } = useServices();
  const [kind, setKind] = useState<Story['kind']>('read');
  const results = useLiveQuery(() => (sid ? store.storyResults(sid) : undefined), [store, sid]);
  if (student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  if (!student || !profile) return <main className="screen" />;

  const fit = storyLevelFor(student, profile);
  const stories = [...content.stories.values()].filter((s) => s.kind === kind);
  const levels = CEFR_LEVELS.filter((l) => stories.some((s) => s.level === l));
  const base = `/s/${student.id}`;

  return (
    <main className="screen">
      <TopBar back={base} title="סיפורים" />
      <div className="segmented" role="tablist" aria-label="סוג">
        <button role="tab" aria-selected={kind === 'read'} onClick={() => setKind('read')}>
          <BookIcon size={18} /> סיפורי קריאה
        </button>
        <button role="tab" aria-selected={kind === 'dialogue'} onClick={() => setKind('dialogue')}>
          <ChatIcon size={18} /> שיחות להאזנה
        </button>
      </div>
      <section className="stories-intro">
        <Art name="stories" size={72} tone="reading" fallback={kind === 'read' ? <BookIcon /> : <ChatIcon />} />
        <p className="small muted grow">
          {kind === 'read'
            ? 'סיפורים קצרים על משפחת שפירו. קוראים שורה אחרי שורה ומקישים על מילה כדי לראות מה היא אומרת.'
            : 'שיחות בשני קולות. מקשיבים, עונים על שאלות, ואפשר לראות תרגום.'}
        </p>
      </section>
      {levels.map((level) => (
        <section className="stack gap-2" key={level} aria-label={`${level} ${LEVEL_HE[level] ?? ''}`}>
          <div className="level-head">
            <span className="path-level-code" lang="en">
              {level}
            </span>
            <h2 className="section-title grow">{LEVEL_HE[level]}</h2>
            {level === fit && <span className="badge badge-good">מתאים לך</span>}
          </div>
          <div className="list">
            {stories
              .filter((s) => s.level === level)
              .map((s) => {
                const r = results?.get(s.id);
                return (
                  <Link key={s.id} to={`${base}/stories/${s.id}`} className="list-item story-item">
                    <span className={`tile-icon ${r ? 'tone-good' : kind === 'read' ? 'tone-reading' : 'tone-listening'}`} aria-hidden="true">
                      {r ? <CheckIcon /> : kind === 'read' ? <BookIcon /> : <ChatIcon />}
                    </span>
                    <span className="grow stack gap-0">
                      <He inline className="t-strong">{s.title.he}</He>
                      <En as="div" className="story-en small muted">
                        {s.title.en}
                      </En>
                    </span>
                    {r && (
                      <span className="level-chip" aria-label={`${r.correct} מתוך ${r.total}`}>
                        {r.correct}/{r.total}
                      </span>
                    )}
                    <span className="chev">
                      <ChevronIcon />
                    </span>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
      {!stories.length && <p className="empty">עוד אין סיפורים כאן.</p>}
    </main>
  );
}
