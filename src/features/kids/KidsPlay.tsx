import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useStudent } from '@/app/hooks';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import { kidWords, phonics } from '@content/kids';
import type { ChoiceItem } from '@/domain/content/schema';
import type { ItemOutcome } from '@/domain/learning/events';
import { isDue } from '@/domain/learning/srs';
import {
  buildQuestions,
  firstLetterQuestions,
  listenQuestions,
  memoryCards,
  shuffle,
  seeded,
  sightQuestions,
} from '@/domain/kids/games';
import { KID_TOPICS, type KidStage, type KidTopic, type KidWord } from '@/domain/kids/schema';
import { stageOf, type Student } from '@/domain/student/student';
import { speakHebrew, stopHebrew } from '@/services/speech/hebrewVoice';
import { sounds } from '@/services/sound';
import { PRAISE } from './hebrewPhrases';
import { Picture } from './Picture';
import { Reward } from './Reward';
import { TOPIC_INFO } from './topics';

type Game = 'listen' | 'read' | 'letters' | 'build' | 'sight' | 'memory';
const GAMES: Game[] = ['listen', 'read', 'letters', 'build', 'sight', 'memory'];

export function KidsPlay() {
  const { sid } = useParams();
  const [search] = useSearchParams();
  const student = useStudent(sid);
  const game = (GAMES as string[]).includes(search.get('game') ?? '') ? (search.get('game') as Game) : 'listen';
  const topicParam = search.get('topic');
  const topic = topicParam && (KID_TOPICS as readonly string[]).includes(topicParam) ? (topicParam as KidTopic) : undefined;
  const [round, setRound] = useState(0);
  if (!student) return <main className="screen" />;
  const s = stageOf(student);
  const stage: KidStage = s === 'little' ? 'little' : 'young';
  return <Round key={`${game}:${topic}:${round}`} student={student} stage={stage} game={game} topic={topic} onAgain={() => setRound((r) => r + 1)} />;
}

/** One round of a game: a few questions, then a sticker. */
function Round({ student, stage, game, topic, onAgain }: { student: Student; stage: KidStage; game: Game; topic: KidTopic | undefined; onAgain: () => void }) {
  const { store, speech } = useServices();
  const prefs = useSpeechPrefs();
  const [known, setKnown] = useState<((w: KidWord) => boolean) | null>(null);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const sessionRef = useRef<string>('');
  const seed = useMemo(() => `${student.id}:${game}:${topic}:${Date.now()}`, [student.id, game, topic]);

  // Session for screen time; learner memory to put new words first.
  useEffect(() => {
    let sid = '';
    let live = true;
    void store.startSession(student.id, `kids:${game}`).then((s) => {
      sid = s.id;
      if (live) sessionRef.current = s.id;
      else void store.endSession(s.id, 'left');
    });
    void store.loadLearnerState(student.id).then((st) => {
      const now = Date.now();
      if (live)
        setKnown(() => (w: KidWord) => {
          const u = st.units.get(`word:${w.en.toLowerCase()}`);
          return !!u && u.lastScore >= 0.7 && !isDue(u.card, now);
        });
    });
    return () => {
      live = false;
      stopHebrew();
      speech.stop();
      if (sid) void store.endSession(sid, 'left');
    };
  }, [store, speech, student.id, game]);

  const sayEn = useCallback(
    (text: string, slow = false) => speech.speak(text, { ...prefs, ...(slow ? { rate: 'slower' as const } : {}), key: `kid-${text}` }),
    [speech, prefs],
  );

  const finish = useCallback(
    (correct: number, total: number) => {
      setScore({ correct, total });
      void store.log(student.id, 'kids.round', { game, ...(topic ? { topic } : {}), correct, total }, sessionRef.current || undefined);
      if (sessionRef.current) void store.endSession(sessionRef.current, 'finished');
    },
    [store, student.id, game, topic],
  );

  /** Records one picture answer in the learner memory (unit word:<en>), like any other item. */
  const record = useCallback(
    (w: KidWord, correct: boolean, wrongs: number, ms: number) => {
      const item: ChoiceItem = {
        id: `kids.${w.id}`,
        version: 1,
        type: 'choice',
        skill: game === 'read' ? 'reading.details' : 'listening.words',
        alsoSkills: [{ id: 'vocabulary.meaning', weight: 0.5 }],
        level: 'A1',
        difficulty: 0.1,
        unit: `word:${w.en.toLowerCase()}`,
        instruction: { he: 'איפה?', en: 'Where is it?' },
        explanation: { he: `${w.en} = ${w.he}`, en: w.en },
        hints: [],
        targetsMisconceptions: [],
        tags: ['kids'],
        interests: [],
        modality: game === 'read' ? 'read' : 'listen',
        estimatedTimeSec: 6,
        source: 'original',
        language: 'en',
        word: { lemma: w.en, he: w.he },
        prompt: w.en,
        promptLanguage: 'en',
        options: [{ id: 'a', text: w.he }, { id: 'b', text: '-' }],
        correctOptionId: 'a',
      };
      const outcome: ItemOutcome = {
        finalCorrect: correct,
        attempts: [...Array.from({ length: wrongs }, () => ({ answer: 'b', correct: false, atMs: Date.now() })), ...(correct ? [{ answer: 'a', correct: true, atMs: Date.now() }] : [])],
        hintsUsed: 0,
        explanationShown: false,
        revealed: !correct,
        skipped: false,
        responseMs: ms,
        answerChanges: 0,
        replays: 0,
      };
      void store.completeItem({ studentId: student.id, ...(sessionRef.current ? { sessionId: sessionRef.current } : {}), item, outcome });
    },
    [store, student.id, game],
  );

  if (score) return <Reward student={student} score={score} onAgain={onAgain} />;
  if (!known) return <main className="screen kids-screen" />;

  const back = `/s/${student.id}`;
  const common = { sayEn, onFinish: finish, back };
  if (game === 'memory') return <MemoryGame {...common} words={kidWords.filter((w) => w.stages.includes(stage) && (!topic || w.topic === topic))} seed={seed} />;
  if (game === 'letters') return <LettersGame {...common} seed={seed} />;
  if (game === 'build') return <BuildGame {...common} seed={seed} />;
  if (game === 'sight') return <SightGame {...common} seed={seed} />;
  return <PictureGame {...common} stage={stage} topic={topic} known={known} seed={seed} read={game === 'read'} onRecord={record} />;
}

type Common = {
  sayEn: (text: string, slow?: boolean) => Promise<unknown>;
  onFinish: (correct: number, total: number) => void;
  back: string;
};

function KidsTop({ back, progress, total, title }: { back: string; progress: number; total: number; title?: string }) {
  return (
    <header className="kids-top">
      <Link to={back} className="kids-home-btn" aria-label="הביתה">
        🏠
      </Link>
      {title && <span className="kids-title">{title}</span>}
      <div className="kids-stars" aria-label={`${progress} מתוך ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} data-on={i < progress}>
            ★
          </span>
        ))}
      </div>
    </header>
  );
}

/** Hear the word (or read it), tap the picture. Gentle: a wrong tap just says the word again. */
function PictureGame({
  stage,
  topic,
  known,
  seed,
  read,
  sayEn,
  onFinish,
  onRecord,
  back,
}: Common & {
  stage: KidStage;
  topic: KidTopic | undefined;
  known: (w: KidWord) => boolean;
  seed: string;
  read: boolean;
  onRecord: (w: KidWord, correct: boolean, wrongs: number, ms: number) => void;
}) {
  const questions = useMemo(() => listenQuestions(kidWords, { stage, ...(topic ? { topic } : {}), known, seed, count: 6, options: read ? 3 : undefined }), [stage, topic, known, seed, read]);
  const [i, setI] = useState(0);
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [solved, setSolved] = useState(false);
  const [correct, setCorrect] = useState(0);
  const shownAt = useRef(Date.now());
  const q = questions[i];

  const ask = useCallback(async () => {
    if (!q) return;
    if (!read) {
      await speakHebrew('איפה');
      await sayEn(q.say);
    }
  }, [q, read, sayEn]);

  useEffect(() => {
    shownAt.current = Date.now();
    void ask();
  }, [ask]);

  if (!questions.length) return <EmptyGame back={back} />;
  if (!q) return null;

  const tap = (w: KidWord) => {
    if (solved) return;
    if (w.id === q.target.id) {
      setSolved(true);
      sounds.correct();
      const first = wrong.size === 0;
      if (first) setCorrect((c) => c + 1);
      onRecord(q.target, first, wrong.size, Date.now() - shownAt.current);
      void (async () => {
        await speakHebrew(PRAISE[(i + correct) % PRAISE.length]!);
        await sayEn(q.target.sentence?.en ?? q.target.en);
        setTimeout(() => {
          if (i + 1 >= questions.length) onFinish(correct + (first ? 1 : 0), questions.length);
          else {
            setI(i + 1);
            setWrong(new Set());
            setSolved(false);
          }
        }, 500);
      })();
    } else {
      setWrong((s) => new Set(s).add(w.id));
      void sayEn(w.en).then(() => speakHebrew('נסו שוב')).then(() => sayEn(q.say));
    }
  };

  const hintOn = wrong.size >= 2;
  return (
    <main className="screen kids-screen">
      <KidsTop back={back} progress={i} total={questions.length} title={topic ? `${TOPIC_INFO[topic].emoji} ${TOPIC_INFO[topic].he}` : undefined} />
      <div className="kids-ask">
        {read ? (
          <div className="kids-word" dir="ltr" lang="en">
            {q.target.en}
          </div>
        ) : (
          <button className="kids-replay" onClick={() => void sayEn(q.say)} aria-label="לשמוע שוב">
            🔊
          </button>
        )}
        <div className="row" style={{ gap: 'var(--s-3)', justifyContent: 'center' }}>
          {read && (
            <button className="kids-mini" onClick={() => void sayEn(q.say)} aria-label="לשמוע את המילה">
              🔊
            </button>
          )}
          <button className="kids-mini" onClick={() => void sayEn(q.say, true)} aria-label="לשמוע לאט">
            🐢
          </button>
        </div>
      </div>
      <div className={`kids-options n${q.options.length}`}>
        {q.options.map((o) => (
          <button
            key={o.id}
            className="kids-card"
            data-state={solved && o.id === q.target.id ? 'right' : wrong.has(o.id) ? 'wrong' : hintOn && o.id === q.target.id ? 'hint' : undefined}
            onClick={() => tap(o)}
            aria-label={o.he}
          >
            <Picture picture={o.picture} size={stage === 'little' ? 84 : 72} />
          </button>
        ))}
      </div>
      {solved && (
        <div className="kids-caption" dir="ltr" lang="en">
          {q.target.en}
        </div>
      )}
    </main>
  );
}

function LettersGame({ seed, sayEn, onFinish, back }: Common & { seed: string }) {
  const questions = useMemo(() => firstLetterQuestions(phonics, seed), [seed]);
  const [i, setI] = useState(0);
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [correct, setCorrect] = useState(0);
  const q = questions[i];
  useEffect(() => {
    if (!q) return;
    void speakHebrew('באיזו אות זה מתחיל?').then(() => sayEn(q.word));
  }, [q, sayEn]);
  if (!questions.length) return <EmptyGame back={back} />;
  if (!q) return null;
  const tap = (c: string) => {
    if (done) return;
    if (c === q.answer) {
      setDone(true);
      sounds.correct();
      const first = wrong.size === 0;
      if (first) setCorrect((x) => x + 1);
      void speakHebrew(PRAISE[i % PRAISE.length]!).then(() => sayEn(q.word)).then(() =>
        setTimeout(() => {
          if (i + 1 >= questions.length) onFinish(correct + (first ? 1 : 0), questions.length);
          else {
            setI(i + 1);
            setWrong(new Set());
            setDone(false);
          }
        }, 400),
      );
    } else {
      setWrong((s) => new Set(s).add(c));
      void speakHebrew('נסו שוב').then(() => sayEn(q.word));
    }
  };
  return (
    <main className="screen kids-screen">
      <KidsTop back={back} progress={i} total={questions.length} title="🔤 איזו אות?" />
      <button className="kids-ask kids-picture-big" onClick={() => void sayEn(q.word)} aria-label="לשמוע שוב">
        <span className="kid-emoji" style={{ fontSize: 110 }}>
          {q.emoji}
        </span>
        <span className="kids-word" dir="ltr" lang="en">
          {done ? q.word : `_${q.word.slice(1)}`}
        </span>
      </button>
      <div className="kids-options n3">
        {q.options.map((c) => (
          <button key={c} className="kids-card kids-letter" data-state={done && c === q.answer ? 'right' : wrong.has(c) ? 'wrong' : undefined} onClick={() => tap(c)} dir="ltr">
            {c}
          </button>
        ))}
      </div>
    </main>
  );
}

function BuildGame({ seed, sayEn, onFinish, back }: Common & { seed: string }) {
  const questions = useMemo(() => buildQuestions(phonics, seed), [seed]);
  const [i, setI] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [shake, setShake] = useState(false);
  const q = questions[i];
  useEffect(() => {
    if (!q) return;
    setPlaced([]);
    void speakHebrew('בונים את המילה').then(() => sayEn(q.word));
  }, [q, sayEn]);
  if (!questions.length) return <EmptyGame back={back} />;
  if (!q) return null;
  const built = placed.map((p) => q.tiles[p]).join('');
  const done = built === q.word;
  const tap = (idx: number) => {
    if (done || placed.includes(idx)) return;
    const next = q.word[placed.length];
    if (q.tiles[idx] !== next) {
      setMistakes((m) => m + 1);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      void sayEn(q.word, true);
      return;
    }
    const now = [...placed, idx];
    setPlaced(now);
    if (now.length === q.word.length) {
      sounds.correct();
      const clean = mistakes === 0;
      if (clean) setCorrect((c) => c + 1);
      void speakHebrew(PRAISE[i % PRAISE.length]!).then(() => sayEn(q.word)).then(() =>
        setTimeout(() => {
          setMistakes(0);
          if (i + 1 >= questions.length) onFinish(correct + (clean ? 1 : 0), questions.length);
          else setI(i + 1);
        }, 500),
      );
    }
  };
  return (
    <main className="screen kids-screen">
      <KidsTop back={back} progress={i} total={questions.length} title="🧩 בונים מילה" />
      <button className="kids-ask kids-picture-big" onClick={() => void sayEn(q.word)} aria-label="לשמוע שוב">
        <span className="kid-emoji" style={{ fontSize: 100 }}>
          {q.emoji ?? '🔊'}
        </span>
        <span className="small muted">{q.he}</span>
      </button>
      <div className={`kids-slots${shake ? ' shake' : ''}`} dir="ltr">
        {q.word.split('').map((_, k) => (
          <span key={k} className="kids-slot" data-full={k < placed.length}>
            {k < placed.length ? q.tiles[placed[k]!] : ''}
          </span>
        ))}
      </div>
      <div className="kids-tiles" dir="ltr">
        {q.tiles.map((t, idx) => (
          <button key={idx} className="kids-tile-letter" disabled={placed.includes(idx)} onClick={() => tap(idx)}>
            {t}
          </button>
        ))}
      </div>
    </main>
  );
}

function SightGame({ seed, sayEn, onFinish, back }: Common & { seed: string }) {
  const questions = useMemo(() => sightQuestions(phonics, seed, 3), [seed]);
  const [i, setI] = useState(0);
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [correct, setCorrect] = useState(0);
  const q = questions[i];
  useEffect(() => {
    if (!q) return;
    void speakHebrew('איפה המילה').then(() => sayEn(q.word));
  }, [q, sayEn]);
  if (!questions.length) return <EmptyGame back={back} />;
  if (!q) return null;
  const tap = (w: string) => {
    if (done) return;
    if (w === q.word) {
      setDone(true);
      sounds.correct();
      const first = wrong.size === 0;
      if (first) setCorrect((c) => c + 1);
      void speakHebrew(PRAISE[i % PRAISE.length]!).then(() => sayEn(q.sentence.en)).then(() =>
        setTimeout(() => {
          if (i + 1 >= questions.length) onFinish(correct + (first ? 1 : 0), questions.length);
          else {
            setI(i + 1);
            setWrong(new Set());
            setDone(false);
          }
        }, 400),
      );
    } else {
      setWrong((s) => new Set(s).add(w));
      void sayEn(w).then(() => speakHebrew('נסו שוב')).then(() => sayEn(q.word));
    }
  };
  return (
    <main className="screen kids-screen">
      <KidsTop back={back} progress={i} total={questions.length} title="✨ מילים קסומות" />
      <div className="kids-ask">
        <button className="kids-replay" onClick={() => void sayEn(q.word)} aria-label="לשמוע שוב">
          🔊
        </button>
        {done && (
          <div className="stack txt-center" style={{ gap: 2 }}>
            <span className="kids-sentence" dir="ltr" lang="en">
              {q.sentence.en}
            </span>
            <span className="small muted">{q.sentence.he}</span>
          </div>
        )}
      </div>
      <div className="kids-options n3 kids-words">
        {q.options.map((w) => (
          <button key={w} className="kids-card kids-letter" data-state={done && w === q.word ? 'right' : wrong.has(w) ? 'wrong' : undefined} onClick={() => tap(w)} dir="ltr">
            {w}
          </button>
        ))}
      </div>
    </main>
  );
}

/** Memory: turn two cards, find the pairs. Each card says its word when it turns. */
function MemoryGame({ words, seed, sayEn, onFinish, back }: Common & { words: KidWord[]; seed: string }) {
  const pool = useMemo(() => shuffle(words.filter((w) => w.picture.emoji), seeded(seed)), [words, seed]);
  const cards = useMemo(() => memoryCards(pool, seed, 6), [pool, seed]);
  const [open, setOpen] = useState<string[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [turns, setTurns] = useState(0);
  if (cards.length < 4) return <EmptyGame back={back} />;
  const flip = (key: string, w: KidWord) => {
    if (open.includes(key) || found.has(w.id) || open.length === 2) return;
    void sayEn(w.en);
    const now = [...open, key];
    setOpen(now);
    if (now.length === 2) {
      setTurns((t) => t + 1);
      const [a, b] = now.map((k) => cards.find((c) => c.key === k)!.word);
      if (a!.id === b!.id) {
        sounds.correct();
        const f = new Set(found).add(a!.id);
        setTimeout(() => {
          setFound(f);
          setOpen([]);
          if (f.size * 2 === cards.length) void speakHebrew('כל הכבוד!').then(() => onFinish(cards.length / 2, cards.length / 2));
        }, 600);
      } else setTimeout(() => setOpen([]), 1100);
    }
  };
  return (
    <main className="screen kids-screen">
      <KidsTop back={back} progress={found.size} total={cards.length / 2} title="🎴 זוגות" />
      <div className="kids-memory">
        {cards.map((c) => {
          const up = open.includes(c.key) || found.has(c.word.id);
          return (
            <button key={c.key} className="kids-mem" data-up={up} data-found={found.has(c.word.id)} onClick={() => flip(c.key, c.word)} aria-label={up ? c.word.he : 'קלף סגור'}>
              {up ? <Picture picture={c.word.picture} size={52} /> : <span className="kids-mem-back">⭐</span>}
            </button>
          );
        })}
      </div>
      <p className="xs muted txt-center">{`ניסיונות: ${turns}`}</p>
    </main>
  );
}

function EmptyGame({ back }: { back: string }) {
  return (
    <main className="screen kids-screen">
      <div className="kids-done">
        <span className="kids-big-emoji">🧸</span>
        <strong>המשחק הזה עוד בהכנה</strong>
        <Link className="btn btn-primary" to={back}>
          הביתה
        </Link>
      </div>
    </main>
  );
}
