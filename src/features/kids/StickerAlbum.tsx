import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useServices } from '@/app/services';
import { stickers, type StickerInfo } from '@content/kids';
import { speakHebrew } from '@/services/speech/hebrewVoice';

const THEMES: Record<string, string> = { nature: 'טבע', animals: 'בעלי חיים', values: 'ערכים והישגים', jewish: 'חיים יהודיים' };

/** The sticker album: earned stickers in color, the rest still waiting. */
export function StickerAlbum() {
  const { sid } = useParams();
  const { store } = useServices();
  const earned = useLiveQuery(() => (sid ? store.stickersEarned(sid) : []), [store, sid]);
  const [big, setBig] = useState<StickerInfo | null>(null);
  const have = new Set(earned ?? []);
  const themes = [...new Set(stickers.map((s) => s.theme))];
  return (
    <main className="screen kids-screen">
      <header className="kids-top">
        <Link to={`/s/${sid}`} className="kids-home-btn" aria-label="הביתה">
          🏠
        </Link>
        <span className="kids-title">⭐ האלבום שלי</span>
        <span className="small muted">{`${have.size}/${stickers.length}`}</span>
      </header>
      {themes.map((t) => (
        <section key={t} className="stack">
          <h2 className="kids-h">{THEMES[t] ?? t}</h2>
          <div className="album-grid">
            {stickers
              .filter((s) => s.theme === t)
              .map((s) =>
                have.has(s.id) ? (
                  <button
                    key={s.id}
                    className="album-slot"
                    onClick={() => {
                      setBig(s);
                      void speakHebrew(s.he);
                    }}
                  >
                    <img src={`stickers/${s.id}.svg`} alt={s.he} loading="lazy" />
                  </button>
                ) : (
                  <span key={s.id} className="album-slot empty" aria-label="מדבקה שעוד לא נאספה">
                    <img src={`stickers/${s.id}.svg`} alt="" loading="lazy" />
                  </span>
                ),
              )}
          </div>
        </section>
      ))}
      {big && (
        <div className="sheet-backdrop" onClick={() => setBig(null)}>
          <div className="sticker-reveal sticker-big" onClick={(e) => e.stopPropagation()}>
            <img src={`stickers/${big.id}.svg`} alt={big.he} width={260} height={260} />
            <span>{big.he}</span>
            <span className="small muted" dir="ltr" lang="en">
              {big.en}
            </span>
            <button className="btn btn-primary" onClick={() => setBig(null)}>
              סגירה
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
