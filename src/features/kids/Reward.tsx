import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useServices } from '@/app/services';
import { stickers, type StickerInfo } from '@content/kids';
import type { Student } from '@/domain/student/student';
import { speakHebrew } from '@/services/speech/hebrewVoice';
import { Confetti } from '@/ui/Confetti';
import { newStickerPhrase } from './hebrewPhrases';
import { AlbumIcon, HomeIcon, ReplayIcon, StarIcon } from './KidIcons';
import { OwlSays } from './KidsChrome';
import { stickerSrc } from './pics';

/**
 * A sticker is earned by real effort: in games at least half the answers
 * right on the first try; a book gives its sticker once (the first time it is
 * read through, page by page). Otherwise the child is praised and invited to
 * try again for a sticker.
 */
export function earnsSticker(score: { correct: number; total: number }): boolean {
  return score.total > 0 && score.correct * 2 >= score.total;
}

type Outcome = { kind: 'sticker'; sticker: StickerInfo } | { kind: 'all' } | { kind: 'none' };

/** End of a round: praise, and a new sticker when it was earned. */
export function Reward({
  student,
  score,
  onAgain,
  source,
  earned: earnedProp,
}: {
  student: Student;
  score: { correct: number; total: number };
  onAgain: () => void;
  /** What the sticker is for, e.g. "book:kb.young.bus" (books give one sticker each). */
  source: string;
  /** Overrides the score rule (books decide by reading, not by answers). */
  earned?: boolean;
}) {
  const { store } = useServices();
  const [outcome, setOutcome] = useState<Outcome | undefined>(undefined);
  const deserves = earnedProp ?? earnsSticker(score);
  // The award runs once, even when the effect runs twice (StrictMode).
  const job = useRef<Promise<Outcome> | null>(null);

  useEffect(() => {
    let live = true;
    job.current ??= (async (): Promise<Outcome> => {
      if (!deserves) return { kind: 'none' };
      if (source.startsWith('book:') && (await store.stickerEarnedFrom(student.id, source))) return { kind: 'none' };
      const have = await store.stickersEarned(student.id);
      const next = stickers.find((s) => !have.includes(s.id));
      if (!next) return { kind: 'all' };
      await store.log(student.id, 'sticker.earned', { stickerId: next.id, source });
      return { kind: 'sticker', sticker: next };
    })();
    void job.current.then((out) => {
      if (!live) return;
      setOutcome(out);
      void speakHebrew(out.kind === 'sticker' ? newStickerPhrase(out.sticker.he) : out.kind === 'all' ? 'כל הכבוד! אספתם את כל המדבקות' : 'כל הכבוד!');
    });
    return () => {
      live = false;
    };
  }, [store, student.id, source, deserves]);
  const sticker = outcome?.kind === 'sticker' ? outcome.sticker : outcome ? null : undefined;

  const base = `/s/${student.id}`;
  // Stars are generous: at least half of them always light up.
  const lit = Math.max(score.correct, Math.ceil(score.total / 2));
  const stars = Math.min(score.total, 8);
  return (
    <main className="screen kids-screen k-reward" data-mood="kids">
      <Confetti pieces={40} />
      <OwlSays title="כל הכבוד!" line={
          outcome?.kind === 'all'
            ? 'אספתם את כל המדבקות!'
            : outcome?.kind === 'none'
              ? source.startsWith('book:')
                ? deserves
                  ? 'את המדבקה של הספרון כבר קיבלתם'
                  : 'מקשיבים לכל דף, ומקבלים מדבקה'
                : 'עוד קצת תרגול, ומקבלים מדבקה'
              : 'מדבקה חדשה לאלבום'
        } size={88} />
      <div className="k-stars" role="img" aria-label={`${score.correct} מתוך ${score.total}`}>
        {Array.from({ length: stars }, (_, i) => (
          <span key={i} className="k-star-slot" style={{ animationDelay: `${120 + i * 90}ms` }}>
            <StarIcon size={stars > 6 ? 34 : 40} on={i < Math.round((lit / score.total) * stars)} />
          </span>
        ))}
      </div>
      <div className="k-reveal-stage">
        {sticker && (
          <div className="k-reveal">
            <span className="k-rays" aria-hidden="true" />
            <img className="k-reveal-pic" src={stickerSrc(sticker.id)} alt={sticker.he} width={220} height={220} />
            <span className="k-reveal-name">{sticker.he}</span>
          </div>
        )}
      </div>
      <div className="k-actions">
        <button className="k-btn primary" onClick={onAgain}>
          <ReplayIcon />
          עוד פעם
        </button>
        <div className="k-actions-row">
          <Link className="k-btn" to={`${base}/kids/album`}>
            <AlbumIcon />
            לאלבום
          </Link>
          <Link className="k-btn" to={base}>
            <HomeIcon size={28} />
            הביתה
          </Link>
        </div>
      </div>
    </main>
  );
}
