import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServices } from '@/app/services';
import { useProfile, useStudent } from '@/app/hooks';
import { useSpeechPrefs } from '@/app/speechPrefs';
import { CloseIcon, TrophyIcon } from '@/ui/icons';
import { Confetti } from '@/ui/Confetti';
import { sounds } from '@/services/sound';
import { localDay, type ItemOutcome } from '@/domain/learning/events';
import { seededShuffle } from '@/features/practice/shuffle';
import { pickMatchWords, type MatchWord } from './matchWords';

const PAIRS_PER_ROUND = 5;
const ROUNDS = 3;

type Side = 'en' | 'he';

/**
 * Match pairs: low-stakes retrieval of words that are due or fading.
 * Untimed; each pair becomes a normal answer in the learner model.
 */
export function MatchGame() {
  const [n, setN] = useState(0);
  return <MatchRound key={n} again={() => setN((x) => x + 1)} />;
}

function MatchRound({ again }: { again: () => void }) {
  const { sid } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const { store, content, speech } = useServices();
  const prefs = useSpeechPrefs();
  const nav = useNavigate();
  const [words, setWords] = useState<MatchWord[] | null>(null);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<{ side: Side; lemma: string } | null>(null);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const missed = useRef(new Map<string, number>());
  const started = useRef(Date.now());
  const sessionId = useRef('');
  const [finished, setFinished] = useState(false);
  const [firstTry, setFirstTry] = useState(0);

  useEffect(() => {
    if (!student || !profile || words) return;
    (async () => {
      const st = await store.loadLearnerState(student.id);
      const session = await store.startSession(student.id, 'match');
      sessionId.current = session.id;
      setWords(pickMatchWords(content.items, st.units, profile.overallTheta, Date.now(), PAIRS_PER_ROUND * ROUNDS, Math.random));
    })();
  }, [student, profile, words, store, content.items]);

  const roundWords = useMemo(() => (words ?? []).slice(round * PAIRS_PER_ROUND, (round + 1) * PAIRS_PER_ROUND), [words, round]);
  const enCol = useMemo(() => seededShuffle(roundWords, `en${round}`), [roundWords, round]);
  const heCol = useMemo(() => seededShuffle(roundWords, `he${round}`), [roundWords, round]);

  if (!student || !words) return <main className="screen" />;
  if (!words.length) return <main className="screen empty">אין עדיין מספיק מילים</main>;

  const record = async (w: MatchWord) => {
    const misses = missed.current.get(w.lemma) ?? 0;
    const outcome: ItemOutcome = {
      finalCorrect: true,
      attempts: [
        ...Array.from({ length: misses }, () => ({ answer: '(mismatch)', correct: false, atMs: Date.now() })),
        { answer: w.he, correct: true, atMs: Date.now() },
      ],
      hintsUsed: 0,
      explanationShown: false,
      revealed: false,
      skipped: false,
      responseMs: 4000,
      answerChanges: 0,
      replays: 0,
    };
    await store.completeItem({ studentId: student.id, sessionId: sessionId.current, item: w.item, outcome });
    if (!misses) setFirstTry((n) => n + 1);
  };

  const finishGame = async () => {
    setFinished(true);
    sounds.finish();
    const total = words.length;
    const correct = words.filter((w) => !missed.current.get(w.lemma)).length;
    await store.log(student.id, 'game.finished', { game: 'match', day: localDay(Date.now()), correct, total, score: Math.round((correct / total) * 100), durationMs: Date.now() - started.current }, sessionId.current);
    await store.endSession(sessionId.current, 'finished');
  };

  const pick = (side: Side, w: MatchWord) => {
    if (done.has(w.lemma)) return;
    if (side === 'en') void speech.speak(w.lemma, { ...prefs, key: `match:${w.lemma}` });
    if (!sel || sel.side === side) {
      setSel({ side, lemma: w.lemma });
      return;
    }
    if (sel.lemma === w.lemma) {
      sounds.correct();
      const next = new Set(done).add(w.lemma);
      setDone(next);
      setSel(null);
      void record(w);
      if (roundWords.every((x) => next.has(x.lemma))) {
        setTimeout(() => {
          if (round + 1 < ROUNDS && words.length > (round + 1) * PAIRS_PER_ROUND) setRound((r) => r + 1);
          else void finishGame();
        }, 450);
      }
    } else {
      sounds.wrong();
      for (const l of [sel.lemma, w.lemma]) missed.current.set(l, (missed.current.get(l) ?? 0) + 1);
      setWrongFlash(`${sel.lemma}|${w.lemma}`);
      setSel(null);
      setTimeout(() => setWrongFlash(null), 400);
    }
  };

  const state = (side: Side, w: MatchWord) => {
    if (done.has(w.lemma)) return 'done';
    if (wrongFlash?.split('|').includes(w.lemma) && sel === null) return 'wrong';
    if (sel?.side === side && sel.lemma === w.lemma) return 'selected';
    return undefined;
  };

  const home = `/s/${student.id}`;
  return (
    <main className="screen" style={{ gap: 'var(--s-4)' }}>
      <header className="row">
        <button className="icon-btn" onClick={() => nav(home)} aria-label="יציאה">
          <CloseIcon />
        </button>
        <div className="grow progress">
          <span style={{ width: `${Math.round((done.size / words.length) * 100)}%` }} />
        </div>
        <span className="small muted">
          {Math.min(round + 1, ROUNDS)}/{Math.min(ROUNDS, Math.ceil(words.length / PAIRS_PER_ROUND))}
        </span>
      </header>

      {!finished ? (
        <>
          <div className="ex-instruction">
            <span className="dot" />
            להתאים כל מילה לפירוש שלה
          </div>
          <div className="match-grid">
            <div className="stack" style={{ gap: 'var(--s-2)' }}>
              {heCol.map((w) => (
                <button key={`he-${w.lemma}`} className="match-card" data-state={state('he', w)} onClick={() => pick('he', w)} disabled={done.has(w.lemma)}>
                  {w.he}
                </button>
              ))}
            </div>
            <div className="stack" style={{ gap: 'var(--s-2)' }}>
              {enCol.map((w) => (
                <button key={`en-${w.lemma}`} className="match-card en" dir="ltr" lang="en" data-state={state('en', w)} onClick={() => pick('en', w)} disabled={done.has(w.lemma)}>
                  {w.lemma}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <section className="stack" style={{ gap: 'var(--s-4)' }}>
          {firstTry >= words.length * 0.6 && <Confetti />}
          <div className="result-hero">
            <span className="tile-icon result-icon">
              <TrophyIcon size={30} />
            </span>
            <h2 className="title">כל הזוגות הותאמו</h2>
            <span className="big">
              {firstTry}/{words.length}
            </span>
            <span style={{ opacity: 0.92 }}>בניסיון הראשון</span>
          </div>
          <button className="btn btn-primary btn-block" onClick={again}>
            עוד משחק
          </button>
          <button className="btn btn-block" onClick={() => nav(home)}>
            חזרה למסך הבית
          </button>
        </section>
      )}
    </main>
  );
}
