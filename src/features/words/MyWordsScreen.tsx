import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useStudent } from '@/app/hooks';
import { useServices } from '@/app/services';
import { isDue } from '@/domain/learning/srs';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { SpeakButton } from '@/ui/SpeakButton';
import { TopBar } from '@/ui/TopBar';
import { BookmarkIcon, CloseIcon } from '@/ui/icons';
import { Art } from '@/ui/Art';
import { ButtonLink } from '@/ui/Button';

/** Words the learner saved from stories, with practice and spaced review. */
export function MyWordsScreen() {
  const { sid } = useParams();
  const student = useStudent(sid);
  const { store } = useServices();
  const data = useLiveQuery(
    async () => (sid ? { words: await store.savedWords(sid), state: await store.loadLearnerState(sid) } : undefined),
    [store, sid],
  );
  if (student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  if (!student || !data) return <main className="screen" />;
  const base = `/s/${student.id}`;
  const now = Date.now();
  const due = data.words.filter((w) => {
    const u = data.state.units.get(`word:${w.lemma.toLowerCase()}`);
    return !u || isDue(u.card, now);
  }).length;

  return (
    <main className="screen">
      <TopBar back={base} title="המילים שלי" />
      {data.words.length === 0 ? (
        <div className="panel empty-state">
          <Art name="empty" size={112} tone="vocabulary" fallback={<BookmarkIcon />} />
          <p className="t-h3">עוד אין מילים שמורות</p>
          <p className="muted">בזמן קריאת סיפור מקישים על מילה. היא נשמרת כאן, וחוזרת לתרגול בדיוק כשמתחילים לשכוח אותה.</p>
          <ButtonLink to={`${base}/stories`} variant="primary" size="lg">
            לסיפורים
          </ButtonLink>
        </div>
      ) : (
        <>
          <div className="panel spread">
            <span>
              {data.words.length === 1 ? (
                <strong>מילה אחת</strong>
              ) : (
                <>
                  <strong className="num">{data.words.length}</strong> מילים
                </>
              )}{' '}
              · <strong className="num">{due}</strong> לתרגול עכשיו
            </span>
            <ButtonLink to={`${base}/practice/mywords`} variant="primary">
              לתרגל
            </ButtonLink>
          </div>
          <div className="list">
            {data.words.map((w) => (
              <div key={w.lemma} className="list-item">
                <SpeakButton text={w.lemma} size="inline" />
                <span className="grow stack gap-1">
                  <En>
                    <strong>{w.lemma}</strong>
                  </En>
                  <He className="small muted">{w.he}</He>
                </span>
                <button className="icon-btn" aria-label={`להסיר את ${w.lemma}`} onClick={() => void store.removeWord(student.id, w.lemma)}>
                  <CloseIcon size={18} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
