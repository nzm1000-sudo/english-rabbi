import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStudent } from '@/app/hooks';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import { kidBooks } from '@content/kids';
import type { KidBook } from '@/domain/kids/schema';
import { stageOf } from '@/domain/student/student';
import { speakHebrew, stopHebrew } from '@/services/speech/hebrewVoice';
import { ArrowIcon, BookIcon, SpeakerIcon, StarIcon } from './KidIcons';
import { KidsIconLink, KidsMessage, KidsTopBar, type Tint } from './KidsChrome';
import { bookPagePic, scenePics } from './pics';
import { Reward } from './Reward';

const TINTS: Tint[] = ['peach', 'sky', 'mint', 'butter', 'lilac', 'rose'];

/** The pictures on a book cover: the cover scene, or the first page that has pictures. */
function coverPics(b: KidBook): string[] {
  const own = scenePics(b.cover, b.title.en);
  if (own.length) return own;
  for (const p of b.pages) {
    const s = scenePics(p.scene, p.en);
    if (s.length) return s;
  }
  return [];
}

/** One or two floating pictures, arranged; or a soft drawn placeholder when there are none. */
function Scene({ pics, fallback }: { pics: string[]; fallback: string }) {
  if (!pics.length) {
    return (
      <span className="k-scene placeholder" aria-hidden="true">
        <svg className="k-scene-hills" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
          <circle cx="320" cy="70" r="34" className="sun" />
          <path d="M0 220 Q 90 160 190 210 T 400 200 V300 H0z" className="hill-b" />
          <path d="M0 250 Q 120 200 230 245 T 400 240 V300 H0z" className="hill-a" />
        </svg>
        <span className="k-scene-emoji">{fallback}</span>
      </span>
    );
  }
  return (
    <span className={`k-scene n${pics.length}`} aria-hidden="true">
      {pics.map((src, i) => (
        <span key={src} className={`k-float p${i}${src.includes('/c-') ? ' char' : ''}`}>
          <img src={src} alt="" draggable={false} decoding="async" />
        </span>
      ))}
    </span>
  );
}

/** Shelf of little books for the child's stage. */
export function KidsBooks() {
  const { sid } = useParams();
  const student = useStudent(sid);
  if (!student) return <main className="screen kids-screen" data-mood="kids" />;
  const stage = stageOf(student) === 'little' ? 'little' : 'young';
  const books = kidBooks.filter((b) => b.stage === stage);
  return (
    <main className="screen kids-screen" data-mood="kids">
      <KidsTopBar start={<KidsIconLink to={`/s/${student.id}`} label="הביתה" />} title="ספרונים" />
      {books.length ? (
        <div className="k-shelf">
          {books.map((b, i) => (
            <Link key={b.id} to={`/s/${student.id}/kids/books/${b.id}`} className="k-book" data-tint={TINTS[i % TINTS.length]} onClick={() => void speakHebrew(b.title.he)}>
              <span className="k-book-art">
                <Scene pics={coverPics(b)} fallback={b.cover} />
              </span>
              <span className="k-book-title">{b.title.he}</span>
            </Link>
          ))}
        </div>
      ) : (
        <KidsMessage title="הספרונים בדרך" line="בקרוב יהיו כאן ספרונים חדשים." />
      )}
    </main>
  );
}

/** One little book. Keyed by the book, so moving to another book starts it fresh. */
export function KidsBook() {
  const { bookId } = useParams();
  return <BookReader key={bookId} />;
}

/** A big picture, one sentence, read aloud. Early readers can tap each word. */
function BookReader() {
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

  if (!student || !book || !p) {
    return (
      <main className="screen kids-screen" data-mood="kids">
        <KidsMessage title="הספרון לא נמצא" action={sid ? <Link className="k-btn primary" to={`/s/${sid}/kids/books`}>לספרונים</Link> : undefined} />
      </main>
    );
  }
  if (done) return <Reward student={student} score={{ correct: book.pages.length, total: book.pages.length }} onAgain={() => { setDone(false); setPage(0); }} />;
  const young = book.stage === 'young';
  const last = page === book.pages.length - 1;
  const full = bookPagePic(book.id, page);
  const replay = () => void speech.speak(p.en, { ...prefs, key: `book-${p.en}` });
  const go = (to: number) => {
    setPage(to);
    setShowHe(false);
  };

  return (
    <main className="screen kids-screen k-reader" data-mood="kids">
      <KidsTopBar
        start={
          <KidsIconLink to={`/s/${student.id}/kids/books`} label="לספרונים">
            <BookIcon size={30} />
          </KidsIconLink>
        }
        title={book.title.he}
        end={
          <button className="k-icon-btn" onClick={replay} aria-label="לשמוע שוב">
            <SpeakerIcon size={30} />
          </button>
        }
      />
      <button className={`k-stage${full ? ' full' : ''}`} onClick={replay} aria-label="לשמוע שוב" key={page}>
        {full ? <img src={full} alt="" draggable={false} /> : <Scene pics={scenePics(p.scene, p.en)} fallback={p.scene} />}
      </button>
      <p className="k-page-text" dir="ltr" lang="en">
        {p.en.split(/(\s+)/).map((w, i) =>
          /^\s+$/.test(w) || !young ? (
            <span key={i}>{w}</span>
          ) : (
            <button key={i} className="k-page-word" onClick={() => void speech.speak(w.replace(/[^\p{L}']/gu, ''), { ...prefs, key: `bw-${w}` })}>
              {w}
            </button>
          ),
        )}
      </p>
      <div className="k-page-he">
        {showHe ? (
          <p>{p.he}</p>
        ) : (
          <button className="k-link" onClick={() => setShowHe(true)}>
            תרגום להורים
          </button>
        )}
      </div>
      <nav className="k-page-nav" dir="ltr" aria-label="דפים">
        <button className="k-nav-btn" disabled={page === 0} onClick={() => go(page - 1)} aria-label="הדף הקודם">
          <ArrowIcon left />
        </button>
        <span className="k-dots" role="img" aria-label={`דף ${page + 1} מתוך ${book.pages.length}`}>
          {book.pages.map((_, i) => (
            <i key={i} data-on={i === page} data-past={i < page} />
          ))}
        </span>
        <button className="k-nav-btn primary" onClick={() => (last ? setDone(true) : go(page + 1))} aria-label={last ? 'סוף' : 'הדף הבא'}>
          {last ? <StarIcon size={34} /> : <ArrowIcon />}
        </button>
      </nav>
    </main>
  );
}
