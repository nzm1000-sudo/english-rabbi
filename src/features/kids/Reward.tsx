import { useEffect, useState } from 'react';
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
      void speakHebrew(next ? newStickerPhrase(next.he) : 'כל הכבוד! אספתם את כל המדבקות');
    })();
    return () => {
      live = false;
    };
  }, [store, student.id]);

  const base = `/s/${student.id}`;
  // Stars are generous: at least half of them always light up.
  const lit = Math.max(score.correct, Math.ceil(score.total / 2));
  const stars = Math.min(score.total, 8);
  return (
    <main className="screen kids-screen k-reward" data-mood="kids">
      <Confetti pieces={40} />
      <OwlSays title="כל הכבוד!" line={sticker === null ? 'אספתם את כל המדבקות!' : 'מדבקה חדשה לאלבום'} size={88} />
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
