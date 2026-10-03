import { useEffect, useRef, useState } from 'react';
import { compareReading, type ReadingResult } from '@/domain/learning/readingCheck';
import { MediaRecorderRecorder } from '@/services/speech/recording/mediaRecorder';
import { isRecognizerCached, isRecognizerReady, loadRecognizer, WhisperRecognizer } from '@/services/speech/recognition/whisperRecognizer';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import { MicIcon, StopIcon } from './icons';
import { He } from './He';

type Phase = 'idle' | 'ask' | 'loading' | 'recording' | 'checking' | 'done' | 'error';

const recognizer = new WhisperRecognizer();

/**
 * "Read it and check me": records the learner reading a sentence, transcribes
 * it on the phone and colors each word. Tapping a red word plays it.
 */
export function ReadCheck({ text, onResult }: { text: string; onResult?: (r: ReadingResult) => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [error, setError] = useState('');
  const recorder = useRef(new MediaRecorderRecorder()).current;
  const { speech } = useServices();
  const prefs = useSpeechPrefs();
  useEffect(() => () => recorder.release(), [recorder]);

  const record = async () => {
    setError('');
    speech.stop();
    try {
      await recorder.start();
      setPhase('recording');
    } catch {
      setError('אין גישה למיקרופון. צריך לאשר גישה בהגדרות הדפדפן.');
      setPhase('error');
    }
  };

  const start = async () => {
    if (!recorder.isSupported()) {
      setError('הדפדפן הזה לא מאפשר הקלטה.');
      setPhase('error');
      return;
    }
    if (isRecognizerReady()) return record();
    if (!(await isRecognizerCached())) return setPhase('ask');
    setPhase('loading');
    try {
      await loadRecognizer();
      await record();
    } catch {
      setError('לא הצלחנו לטעון את בודק ההקראה.');
      setPhase('error');
    }
  };

  const download = async () => {
    setPhase('loading');
    try {
      await loadRecognizer((l, t) => t && setProgress(Math.round((l / t) * 100)));
      await record();
    } catch (e) {
      console.error('[read-check] load', e);
      setError('ההורדה נכשלה. כדאי לנסות שוב עם אינטרנט.');
      setPhase('error');
    }
  };

  const stop = async () => {
    setPhase('checking');
    try {
      const rec = await recorder.stop();
      const heard = await recognizer.recognize(rec.blob);
      const r = compareReading(text, heard.transcript);
      setResult(r);
      onResult?.(r);
      setPhase('done');
    } catch (e) {
      console.error('[read-check]', e);
      setError('הבדיקה לא הצליחה. כדאי לנסות שוב, קרוב יותר לטלפון.');
      setPhase('error');
    }
  };

  const say = (w: string) => void speech.speak(w.replace(/[^\p{L}\p{N}' -]/gu, ''), { ...prefs, key: `readcheck-${w}` });

  return (
    <div className="read-check">
      {phase === 'ask' && (
        <div className="stack" style={{ gap: 'var(--s-2)' }}>
          <He className="small">בודק ההקראה עובד בתוך הטלפון, והקול לא נשלח לשום מקום. צריך להוריד אותו פעם אחת (כ־70 מגה, עדיף ב־Wi-Fi).</He>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <button className="btn btn-primary btn-sm" onClick={() => void download()}>
              להוריד ולהתחיל
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPhase('idle')}>
              לא עכשיו
            </button>
          </div>
        </div>
      )}
      {phase === 'loading' && <span className="small muted">מכינים את בודק ההקראה… {progress ? `${progress}%` : ''}</span>}
      {phase === 'checking' && <span className="small muted">בודקים…</span>}
      {phase === 'recording' ? (
        <button className="btn btn-bad btn-sm rec-btn" onClick={() => void stop()}>
          <StopIcon size={18} /> סיימתי לקרוא
        </button>
      ) : (
        (phase === 'idle' || phase === 'done' || phase === 'error') && (
          <button className="btn btn-sm rec-btn" onClick={() => void start()}>
            <MicIcon size={18} /> {phase === 'idle' ? 'להקריא ולבדוק' : 'לנסות שוב'}
          </button>
        )
      )}
      {error && <span className="small" style={{ color: 'var(--bad-ink)' }}>{error}</span>}
      {phase === 'done' && result && (
        <div className="stack" style={{ gap: 4 }}>
          <p className="read-result" dir="ltr" lang="en">
            {result.words.map((w, i) => (
              <span key={i}>
                <button type="button" className="rc-word" data-status={w.status} onClick={() => say(w.text)} title={w.heard ? `שמענו: ${w.heard}` : undefined}>
                  {w.text}
                </button>{' '}
              </span>
            ))}
          </p>
          <He className="small">
            {result.score >= 0.95
              ? 'מצוין! כל המילים נשמעו נכון.'
              : result.score >= 0.7
                ? 'יפה! המילים בצבע הן אלה שכדאי לתרגל. אפשר ללחוץ עליהן ולשמוע.'
                : 'עוד ניסיון: להקשיב קודם, ואז לקרוא לאט ובקול ברור.'}
          </He>
        </div>
      )}
    </div>
  );
}
