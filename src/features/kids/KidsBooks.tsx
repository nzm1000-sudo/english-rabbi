import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStudent } from '@/app/hooks';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import { kidBooks } from '@content/kids';
import { stageOf } from '@/domain/student/student';
import { speakHebrew, stopHebrew } from '@/services/speech/hebrewVoice';
import { Reward } from './Reward';

/** Shelf of little books for the child's stage. */
export function KidsBooks() {
  const { sid } = useParams();
  const student = useStudent(sid);
  if (!student) return <main className="screen" />;
  const stage = stageOf(student) === 'little' ? 'little' : 'young';
  return (
    <main className="screen kids-screen">
      <header className="kids-top">
        <Link to={`/s/${student.id}`} className="kids-home-btn" aria-label="הביתה">
          🏠
        </Link>
        <span className="kids-title">📚 ספרונים</span>
        <span />
      </header>
      <div className="kids-grid">
        {kidBooks
          .filter((b) => b.stage === stage)
          .map((b) => (
            <Link key={b.id} to={`/s/${student.id}/kids/books/${b.id}`} className="kid-tile book-tile" onClick={() => void speakHebrew(b.title.he)}>
              <span className="kid-tile-emoji">{b.cover}</span>
              <span className="kid-tile-label">{b.title.he}</span>
            </Link>
          ))}
      </div>
    </main>
  );
}

/** One little book: a big picture, one sentence, read aloud. Early readers can tap each word. */
export function KidsBook() {
  const { sid, bookId } = useParams();
  const student = useStudent(sid);
  const { speech, store } = useServices();
  const prefs = useSpeechPrefs();
  const book = kidBooks.find((b) => b.id === bookId);
  const [page, setPage] = useState(0);
  const [showHe, setShowHe] = useState(false);
  const [done, setDone] = useState(false);
  const p = book?.pages[page];

  useEffect(() => {
    if (!p) return;
    void speech.speak(p.en, { ...prefs, key: `book-${p.en}` });
  }, [p, speech, prefs]);
  useEffect(
    () => () => {
      speech.stop();
      stopHebrew();
    },
    [speech],
  );
  useEffect(() => {
    if (!student) return;
    let id = '';
    void store.startSession(student.id, 'kids:book').then((s) => (id = s.id));
    return () => {
      if (id) void store.endSession(id, 'left');
    };
  }, [store, student]);

  if (!student || !book || !p) return <main className="screen empty">הספרון לא נמצא</main>;
  if (done) return <Reward student={student} score={{ correct: book.pages.length, total: book.pages.length }} onAgain={() => { setDone(false); setPage(0); }} />;
  const young = book.stage === 'young';
  const last = page === book.pages.length - 1;

  return (
    <main className="screen kids-screen">
      <header className="kids-top">
        <Link to={`/s/${student.id}/kids/books`} className="kids-home-btn" aria-label="לספרונים">
          📚
        </Link>
        <span className="kids-title">{book.title.he}</span>
        <span className="small muted">{`${page + 1}/${book.pages.length}`}</span>
      </header>
      <button className="book-page" onClick={() => void speech.speak(p.en, { ...prefs, key: `book-${p.en}` })} aria-label="לשמוע שוב">
        <span className="book-scene" aria-hidden="true">
          {p.scene}
        </span>
      </button>
      <p className="book-text" dir="ltr" lang="en">
        {p.en.split(/(\s+)/).map((w, i) =>
          /^\s+$/.test(w) || !young ? (
            <span key={i}>{w}</span>
          ) : (
            <button key={i} className="book-word" onClick={() => void speech.speak(w.replace(/[^\p{L}']/gu, ''), { ...prefs, key: `bw-${w}` })}>
              {w}
            </button>
          ),
        )}
      </p>
      {showHe ? (
        <p className="txt-center muted">{p.he}</p>
      ) : (
        <button className="link-btn small" style={{ alignSelf: 'center' }} onClick={() => setShowHe(true)}>
          תרגום להורים
        </button>
      )}
      <div className="book-nav">
        <button className="btn kids-big-btn" disabled={page === 0} onClick={() => { setPage(page - 1); setShowHe(false); }} aria-label="הקודם">
          ▶
        </button>
        <button className="btn btn-primary kids-big-btn" onClick={() => { if (last) setDone(true); else { setPage(page + 1); setShowHe(false); } }} aria-label={last ? 'סוף' : 'הבא'}>
          {last ? '⭐' : '◀'}
        </button>
      </div>
    </main>
  );
}
