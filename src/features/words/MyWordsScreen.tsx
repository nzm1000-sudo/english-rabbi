import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useStudent } from '@/app/hooks';
import { useServices } from '@/app/services';
import { isDue } from '@/domain/learning/srs';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { SpeakButton } from '@/ui/SpeakButton';
import { TopBar } from '@/ui/TopBar';
import { CloseIcon } from '@/ui/icons';

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
        <div className="panel stack txt-center">
          <strong>עוד אין מילים שמורות</strong>
          <p className="small muted">בזמן קריאת סיפור מקישים על מילה. היא נשמרת כאן, וחוזרת לתרגול בדיוק כשמתחילים לשכוח אותה.</p>
          <Link to={`${base}/stories`} className="btn btn-primary">
            לסיפורים
          </Link>
        </div>
      ) : (
        <>
          <div className="panel spread">
            <span>
              <strong>{data.words.length}</strong> מילים · <strong>{due}</strong> לתרגול עכשיו
            </span>
            <Link to={`${base}/practice/mywords`} className="btn btn-primary btn-sm">
              לתרגל
            </Link>
          </div>
          <div className="list">
            {data.words.map((w) => (
              <div key={w.lemma} className="list-item" style={{ alignItems: 'center' }}>
                <SpeakButton text={w.lemma} />
                <span className="grow stack" style={{ gap: 2 }}>
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
