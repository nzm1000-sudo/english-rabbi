import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProfile, useStudent } from '@/app/hooks';
import { useServices } from '@/app/services';
import { CEFR_LEVELS, type CefrLevel } from '@/domain/skills/cefr';
import { unitOf } from '@/domain/content/schema';
import { En } from '@/ui/En';
import { TopBar } from '@/ui/TopBar';
import { Art } from '@/ui/Art';
import { BookIcon, CheckIcon, ChevronIcon } from '@/ui/icons';
import { RowLink } from '@/ui/RowLink';
import { storyLevelFor } from '@/features/stories/StoriesScreen';

const LEVEL_HE: Partial<Record<CefrLevel, string>> = { A2: 'קל', B1: 'בינוני (3 יח״ל)', B2: 'מתקדם (4 עד 5 יח״ל)', C1: 'מתקדם מאוד (5 יח״ל)' };

/** Passages of the Unseen packs: long texts with a full set of Bagrut-style questions. */
export const isUnseenPassage = (id: string) => id.startsWith('passage.un');

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Unseen: long reading passages by level. Each one opens a session with all
 * its questions in order. Mixed reading practice stays one tap away.
 */
export function UnseenScreen() {
  const { sid } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const { content, store } = useServices();
  const units = useLiveQuery(async () => (sid ? (await store.loadLearnerState(sid)).units : undefined), [store, sid]);
  if (student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  if (!student || !profile) return <main className="screen" />;

  const base = `/s/${student.id}`;
  const fit = storyLevelFor(student, profile);
  const passages = [...content.passages.values()].filter((p) => isUnseenPassage(p.id));
  const itemsOf = (pid: string) => content.items.filter((i) => i.passageId === pid);
  const levels = CEFR_LEVELS.filter((l) => passages.some((p) => p.level === l));

  return (
    <main className="screen">
      <TopBar back={base} title="הבנת הנקרא" />
      <section className="stories-intro">
        <Art name="stories" size={72} tone="reading" fallback={<BookIcon />} />
        <p className="small muted grow">קטעי Unseen ארוכים בסגנון הבגרות. קוראים את הקטע ועונים על כל השאלות שלו, אחת אחרי השנייה.</p>
      </section>
      <div className="list">
        <RowLink to={`${base}/practice/reading`} art="stories" tone="reading" icon={<BookIcon />} title="תרגול מעורב" sub="שאלות מקטעים קצרים, לפי הרמה שלך" />
      </div>
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
            {passages
              .filter((p) => p.level === level)
              .map((p) => {
                const items = itemsOf(p.id);
                const seen = units ? items.filter((i) => units.has(unitOf(i))) : [];
                const done = items.length > 0 && seen.length === items.length;
                const right = done ? seen.filter((i) => (units!.get(unitOf(i))!.lastScore ?? 0) >= 0.99).length : 0;
                return (
                  <Link key={p.id} to={`${base}/practice/unseen?passage=${encodeURIComponent(p.id)}`} className="list-item story-item">
                    <span className={`tile-icon ${done ? 'tone-good' : 'tone-reading'}`} aria-hidden="true">
                      {done ? <CheckIcon /> : <BookIcon />}
                    </span>
                    <span className="grow stack gap-0">
                      <En as="div" className="t-strong">{p.title}</En>
                      <span className="small muted">
                        {words(p.text)} מילים · {items.length} שאלות
                      </span>
                    </span>
                    {done && (
                      <span className="level-chip" aria-label={`${right} מתוך ${items.length} נכונות בפעם האחרונה`}>
                        {right}/{items.length}
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
    </main>
  );
}
