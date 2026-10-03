import { useEffect, useRef, useState } from 'react';
import { compareReading, type ReadingResult } from '@/domain/learning/readingCheck';
import { PcmRecorder } from '@/services/speech/recording/pcmRecorder';
import { isRecognizerCached, isRecognizerReady, loadRecognizer, WhisperRecognizer } from '@/services/speech/recognition/whisperRecognizer';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import { MicIcon, SpeakerIcon, StopIcon } from './icons';
import { He } from './He';
import { En } from './En';

type Phase = 'idle' | 'ask' | 'loading' | 'recording' | 'checking' | 'done' | 'error';

const recognizer = new WhisperRecognizer();

export interface ReadCheckOutcome {
  /** Null when the learner chose not to download the checker. */
  result: ReadingResult | null;
}

/**
 * One clear flow: press the microphone, read the sentence, press stop. The
 * phone transcribes it (nothing is sent anywhere), colors each word, shows
 * what it heard, and lets the learner hear their own recording.
 */
export function ReadCheck({ text, onDone }: { text: string; onDone?: (o: ReadCheckOutcome) => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const [mine, setMine] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [noCheck, setNoCheck] = useState(false);
  const recorder = useRef(new PcmRecorder()).current;
  const audio = useRef<HTMLAudioElement | null>(null);
  const { speech } = useServices();
  const prefs = useSpeechPrefs();

  useEffect(() => () => recorder.release(), [recorder]);
  useEffect(() => () => void (mine && URL.revokeObjectURL(mine)), [mine]);
  useEffect(() => {
    if (phase !== 'recording') return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const record = async () => {
    setError('');
    speech.stop();
    audio.current?.pause();
    try {
      await recorder.start();
      setPhase('recording');
    } catch {
      setError('אין גישה למיקרופון. צריך לאשר גישה למיקרופון בהגדרות הדפדפן.');
      setPhase('error');
    }
  };

  const start = async () => {
    // Start the audio engine inside the tap (iPhone rule), before any waiting.
    if (recorder.isSupported()) recorder.prepare();
    if (!recorder.isSupported()) {
      setError('הדפדפן הזה לא מאפשר הקלטה.');
      setPhase('error');
      return;
    }
    if (noCheck || isRecognizerReady()) return record();
    if (!(await isRecognizerCached())) return setPhase('ask');
    setPhase('loading');
    try {
      await loadRecognizer();
      await record();
    } catch (e) {
      console.error('[read-check] load', e);
      setError('לא הצלחנו לטעון את הבודק. אפשר להקליט ולהשוות לבד.');
      setNoCheck(true);
      setPhase('error');
    }
  };

  const download = async () => {
    recorder.prepare();
    setPhase('loading');
    try {
      await loadRecognizer((l, t) => t && setProgress(Math.round((l / t) * 100)));
      await record();
    } catch (e) {
      console.error('[read-check] load', e);
      setError('ההורדה נכשלה. אפשר לנסות שוב עם Wi-Fi, או להקליט ולהשוות לבד.');
      setNoCheck(true);
      setPhase('error');
    }
  };

  const stop = async () => {
    setPhase('checking');
    try {
      const rec = await recorder.stop();
      setMine(URL.createObjectURL(rec.wav));
      if (noCheck) {
        setResult(null);
        setPhase('done');
        onDone?.({ result: null });
        return;
      }
      if (rec.durationMs < 600) throw new Error('too short');
      const r = await recognizer.recognizeSamples(rec.samples);
      const res = compareReading(text, r.transcript);
      setHeard(r.transcript);
      setResult(res);
      setPhase('done');
      onDone?.({ result: res });
    } catch (e) {
      console.error('[read-check]', e);
      setError('הבדיקה לא הצליחה. כדאי לנסות שוב ולדבר קרוב לטלפון.');
      setPhase('error');
    }
  };

  const playMine = () => {
    if (!mine) return;
    speech.stop();
    audio.current?.pause();
    audio.current = new Audio(mine);
    void audio.current.play();
  };
  const say = (w: string) => void speech.speak(w.replace(/[^\p{L}\p{N}' -]/gu, ''), { ...prefs, key: `readcheck-${w}` });

  return (
    <div className="read-check">
      {phase === 'ask' && (
        <div className="panel stack gap-2">
          <He className="small">כדי שהאפליקציה תבדוק את ההקראה, צריך להוריד פעם אחת בודק (כ־100 מגה, עדיף ב־Wi-Fi). הוא עובד בתוך הטלפון, והקול לא נשלח לשום מקום.</He>
          <button className="btn btn-primary btn-block" onClick={() => void download()}>
            להוריד ולהתחיל
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              recorder.prepare();
              setNoCheck(true);
              void record();
            }}
          >
            בלי בדיקה, רק להקליט ולהשוות
          </button>
        </div>
      )}

      {phase === 'loading' && <He className="small muted">{`מכינים את הבודק… ${progress ? `${progress}%` : ''}`}</He>}

      {phase === 'recording' ? (
        <button className="btn btn-bad btn-block rec-btn rec-live" onClick={() => void stop()}>
          <StopIcon /> סיימתי לקרוא ({seconds})
        </button>
      ) : phase === 'checking' ? (
        <button className="btn btn-block" disabled>
          בודקים מה שמענו…
        </button>
      ) : (
        phase !== 'ask' &&
        phase !== 'loading' && (
          <button className={`btn btn-block rec-btn ${phase === 'done' ? '' : 'btn-primary'}`} onClick={() => void start()}>
            <MicIcon /> {phase === 'done' ? 'להקליט שוב' : 'להקליט את הקריאה שלי'}
          </button>
        )
      )}
      {phase === 'recording' && <He className="xs muted">מקליטים. לקרוא את המשפט בקול, ואז ללחוץ על ״סיימתי״.</He>}
      {error && <He className="small rc-error">{error}</He>}

      {phase === 'done' && (
        <div className="rc-result stack">
          {result && (
            <>
              <He className="rc-verdict">
                {result.score >= 0.95
                  ? '✅ מצוין! כל המילים נשמעו נכון.'
                  : result.score >= 0.7
                    ? '👍 יפה! המילים הצבעוניות הן אלה שכדאי לתרגל.'
                    : '🔁 עוד ניסיון: להקשיב שוב, ואז לקרוא לאט ובקול ברור.'}
              </He>
              <p className="read-result" dir="ltr" lang="en">
                {result.words.map((w, i) => (
                  <span key={i}>
                    <button type="button" className="rc-word" data-status={w.status} onClick={() => say(w.text)}>
                      {w.text}
                    </button>{' '}
                  </span>
                ))}
              </p>
              <div className="rc-legend">
                <span><i className="rc-dot" data-status="ok" /> נכון</span>
                <span><i className="rc-dot" data-status="close" /> כמעט</span>
                <span><i className="rc-dot" data-status="wrong" /> נשמעה מילה אחרת</span>
                <span><i className="rc-dot" data-status="missed" /> לא נשמע</span>
              </div>
              <div className="rc-heard">
                <span className="xs muted">מה שהטלפון שמע:</span>
                <En className="small">{heard || '(לא נשמע דיבור)'}</En>
              </div>
              <He className="xs muted">לחיצה על מילה משמיעה איך אומרים אותה.</He>
            </>
          )}
          {mine && (
            <button className="btn btn-sm rec-btn" onClick={playMine}>
              <SpeakerIcon size={18} /> לשמוע את ההקלטה שלי
            </button>
          )}
        </div>
      )}
    </div>
  );
}
