import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useServices } from '@/app/services';
import { stickers, type StickerInfo } from '@content/kids';
import type { Student } from '@/domain/student/student';
import { speakHebrew } from '@/services/speech/hebrewVoice';
import { Confetti } from '@/ui/Confetti';

/** End of a round: a new sticker for the album, every time. */
export function Reward({ student, score, onAgain }: { student: Student; score: { correct: number; total: number }; onAgain: () => void }) {
  const { store } = useServices();
  const [sticker, setSticker] = useState<StickerInfo | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void (async () => {
      const earned = await store.stickersEarned(student.id);
      const next = stickers.find((s) => !earned.includes(s.id)) ?? null;
      if (next) await store.log(student.id, 'sticker.earned', { stickerId: next.id });
      if (!live) return;
      setSticker(next);
      void speakHebrew(next ? `מדבקה חדשה! ${next.he}` : 'כל הכבוד! אספתם את כל המדבקות');
    })();
    return () => {
      live = false;
    };
  }, [store, student.id]);

  const base = `/s/${student.id}`;
  return (
    <main className="screen kids-screen">
      <Confetti />
      <div className="kids-done">
        <strong className="kids-reward-title">כל הכבוד!</strong>
        <span className="kids-stars big" aria-label={`${score.correct} מתוך ${score.total}`}>
          {Array.from({ length: score.total }, (_, i) => (
            <span key={i} data-on={i < Math.max(score.correct, Math.ceil(score.total / 2))}>
              ★
            </span>
          ))}
        </span>
        {sticker && (
          <div className="sticker-reveal">
            <img src={`stickers/${sticker.id}.svg`} alt={sticker.he} width={200} height={200} />
            <span>{sticker.he}</span>
          </div>
        )}
        {sticker === null && <span className="muted">אספתם את כל המדבקות!</span>}
        <div className="kids-actions">
          <button className="btn btn-primary btn-block kids-big-btn" onClick={onAgain}>
            🔁 עוד פעם
          </button>
          <Link className="btn btn-block kids-big-btn" to={`${base}/kids/album`}>
            ⭐ האלבום שלי
          </Link>
          <Link className="btn btn-ghost btn-block" to={base}>
            🏠 הביתה
          </Link>
        </div>
      </div>
    </main>
  );
}
