import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProfile, useStudent } from '@/app/hooks';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import { CEFR_LEVELS } from '@/domain/skills/cefr';
import type { Speaker } from '@/services/speech/types';
import { MediaRecorderRecorder } from '@/services/speech/recording/mediaRecorder';
import { seededShuffle } from '@/features/practice/shuffle';
import { storyLevelFor } from '@/features/stories/StoriesScreen';
import { En } from '@/ui/En';
import { SpeakButton } from '@/ui/SpeakButton';
import { TopBar } from '@/ui/TopBar';
import { MicIcon, StopIcon } from '@/ui/icons';

const ROUND = 8;
const RATINGS = [
  { value: 1, label: 'עוד לא' },
  { value: 2, label: 'כמעט' },
  { value: 3, label: 'מצוין' },
] as const;

type Phase = 'listen' | 'recording' | 'compare';

/**
 * Shadowing: listen, say it aloud, compare. The recording stays in memory on
 * this phone and is gone when the screen closes. No speech recognition, so no
 * audio is sent anywhere.
 */
export function ShadowScreen() {
  const { sid } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const { content, store, speech } = useServices();
  const prefs = useSpeechPrefs();
  const recorder = useRef(new MediaRecorderRecorder()).current;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('listen');
  const [mine, setMine] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [scores, setScores] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const sentences = useMemo(() => {
    if (!student || !profile) return [];
    const fit = CEFR_LEVELS.indexOf(storyLevelFor(student, profile));
    const lines = [...content.stories.values()]
      .filter((s) => Math.abs(CEFR_LEVELS.indexOf(s.level) - fit) <= 1)
      .flatMap((s) => s.lines.map((l) => ({ text: l.en, speaker: (l.speaker ?? 'A') as Speaker })))
      .filter((l) => {
        const n = l.text.split(/\s+/).length;
        return n >= 3 && n <= 12;
      });
    return seededShuffle(lines, `${student.id}:${new Date().toDateString()}`).slice(0, ROUND);
  }, [content, student, profile]);

  // Release the microphone and the recording when leaving.
  useEffect(() => () => recorder.release(), [recorder]);
  useEffect(() => () => void (mine && URL.revokeObjectURL(mine)), [mine]);

  if (student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  if (!student || !profile) return <main className="screen" />;
  const base = `/s/${student.id}`;
  const current = sentences[index];

  if (!recorder.isSupported()) {
    return (
      <main className="screen">
        <TopBar back={base} title="חזרה בקול" />
        <p className="empty">הדפדפן הזה לא מאפשר הקלטה. כדאי לפתוח את האפליקציה בספארי או בכרום מעודכן.</p>
      </main>
    );
  }

  if (!current) {
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return (
      <main className="screen">
        <TopBar back={base} title="חזרה בקול" />
        <div className="panel stack txt-center">
          <strong style={{ fontSize: 'var(--t-lg)' }}>{scores.length ? 'כל הכבוד על התרגול!' : 'אין עדיין משפטים לתרגול'}</strong>
          {scores.length > 0 && <p className="muted">{avg >= 2.5 ? 'נשמע מצוין. אפשר לנסות משפטים ארוכים יותר.' : 'כל חזרה משפרת את ההגייה. מחר עוד סבב.'}</p>}
          <Link className="btn btn-primary btn-block" to={base}>
            למסך הבית
          </Link>
        </div>
      </main>
    );
  }

  const listen = () => void speech.speak(current.text, { ...prefs, speaker: current.speaker, key: 'shadow-model' });

  const record = async () => {
    setError('');
    speech.stop();
    try {
      await recorder.start();
      setPhase('recording');
    } catch {
      setError('אין גישה למיקרופון. צריך לאשר גישה בהגדרות הדפדפן.');
    }
  };

  const stop = async () => {
    try {
      const r = await recorder.stop();
      setMine(URL.createObjectURL(r.blob));
      setPhase('compare');
    } catch {
      setPhase('listen');
    }
  };

  const playMine = () => {
    if (!mine) return;
    speech.stop();
    audioRef.current?.pause();
    audioRef.current = new Audio(mine);
    void audioRef.current.play();
  };

  const rate = (value: 1 | 2 | 3) => {
    void store.log(student.id, 'speaking.shadowed', { text: current.text, rating: value });
    audioRef.current?.pause();
    setScores((s) => [...s, value]);
    setMine(null);
    setPhase('listen');
    setIndex((i) => i + 1);
  };

  return (
    <main className="screen">
      <TopBar back={base} title="חזרה בקול" end={<span className="small muted">{index + 1}/{sentences.length}</span>} />
      <p className="small muted">להקשיב, להגיד את המשפט בקול באותו קצב ובאותה מנגינה, ואז להשוות. ההקלטה נשארת רק בטלפון ונמחקת ביציאה.</p>
      <div className="prompt-card shadow-card">
        <En as="p" className="prompt">
          {current.text}
        </En>
        <div className="row" style={{ justifyContent: 'center', gap: 'var(--s-4)' }}>
          <SpeakButton text={current.text} speaker={current.speaker} large label="להקשיב" />
          <SpeakButton text={current.text} speaker={current.speaker} slow label="להקשיב לאט" />
        </div>
      </div>

      {phase === 'recording' ? (
        <button className="btn btn-bad btn-block rec-btn" onClick={() => void stop()}>
          <StopIcon /> לסיים הקלטה
        </button>
      ) : (
        <button className="btn btn-primary btn-block rec-btn" onClick={() => void record()}>
          <MicIcon /> {phase === 'compare' ? 'להקליט שוב' : 'להקליט את עצמי'}
        </button>
      )}
      {error && <p className="feedback feedback-hint">{error}</p>}

      {phase === 'compare' && (
        <div className="panel stack">
          <div className="grid-2">
            <button className="btn" onClick={listen}>
              המקור
            </button>
            <button className="btn" onClick={playMine}>
              ההקלטה שלי
            </button>
          </div>
          <span className="section-label">איך זה נשמע?</span>
          <div className="grid-3">
            {RATINGS.map((r) => (
              <button key={r.value} className="btn" onClick={() => rate(r.value)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === 'listen' && index > 0 && (
        <button className="btn btn-ghost" onClick={() => rate(1)}>
          לדלג על המשפט
        </button>
      )}
    </main>
  );
}
