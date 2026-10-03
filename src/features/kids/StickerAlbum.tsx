import { useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useServices } from '@/app/services';
import { stickers, type StickerInfo } from '@content/kids';
import { speakHebrew } from '@/services/speech/hebrewVoice';
import { CloseIcon, HomeIcon, LockIcon } from './KidIcons';
import { KidsIconLink, KidsMessage, KidsTopBar } from './KidsChrome';
import { stickerShape, stickerSrc } from './pics';

const THEMES: Record<string, string> = { nature: 'טבע', animals: 'בעלי חיים', values: 'ערכים והישגים', jewish: 'חיים יהודיים' };
/** Locked stickers shown as silhouettes: only the next few, so the album never looks empty and grey. */
const NEXT = 3;

/** The sticker album: earned stickers by theme, and the next few still waiting as silhouettes. */
export function StickerAlbum() {
  const { sid } = useParams();
  const { store } = useServices();
  const earned = useLiveQuery(() => (sid ? store.stickersEarned(sid) : []), [store, sid]);
  const [big, setBig] = useState<StickerInfo | null>(null);
  const have = new Set(earned ?? []);
  const themes = [...new Set(stickers.map((s) => s.theme))];
  // Rewards hand out stickers in list order, so these are the next ones to come.
  const waiting = stickers.filter((s) => !have.has(s.id));
  const next = waiting.slice(0, NEXT);
  const home = `/s/${sid}`;

  const open = (s: StickerInfo) => {
    setBig(s);
    void speakHebrew(s.he);
  };

  return (
    <main className="screen kids-screen k-album" data-mood="kids">
      <KidsTopBar
        start={<KidsIconLink to={home} label="הביתה" />}
        title="מדבקות"
        end={
          <span className="k-count" role="img" aria-label={`${have.size} מתוך ${stickers.length}`}>
            <b>{have.size}</b>
            <i>{stickers.length}</i>
          </span>
        }
      />

      {earned && have.size === 0 && (
        <KidsMessage
          title="המדבקה הראשונה מחכה!"
          line="כל משחק נגמר במדבקה חדשה לאלבום."
          action={
            <Link className="k-btn primary" to={home}>
              <HomeIcon size={28} />
              למשחקים
            </Link>
          }
        />
      )}

      {themes.map((t) => {
        const mine = stickers.filter((s) => s.theme === t && have.has(s.id));
        if (!mine.length) return null;
        const all = stickers.filter((s) => s.theme === t).length;
        return (
          <section key={t} className="k-section" aria-labelledby={`k-theme-${t}`}>
            <div className="k-theme-head">
              <h2 id={`k-theme-${t}`} className="k-h">
                {THEMES[t] ?? t}
              </h2>
              <span className="k-theme-count">{`${mine.length}/${all}`}</span>
            </div>
            <div className="k-meter" aria-hidden="true">
              <i style={{ '--v': mine.length / all } as CSSProperties} />
            </div>
            <div className="k-album-grid">
              {mine.map((s) => (
                <button key={s.id} className="k-sticker" onClick={() => open(s)} aria-label={s.he}>
                  <img src={stickerSrc(s.id)} alt="" loading="lazy" width={240} height={240} />
                  <span className="k-sticker-name">{s.he}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {have.size > 0 && next.length > 0 && (
        <section className="k-section" aria-labelledby="k-next">
          <div className="k-theme-head">
            <h2 id="k-next" className="k-h">
              מחכות לכם
            </h2>
            <span className="k-theme-count">{`עוד ${waiting.length}`}</span>
          </div>
          <div className="k-next-grid">
            {next.map((s) => {
              const shape = stickerShape(s.id);
              return (
                <span key={s.id} className="k-locked" role="img" aria-label="מדבקה שעוד לא נאספה">
                  {shape ? (
                    <span className="k-silhouette" style={{ '--shape': `url(${shape})` } as CSSProperties} />
                  ) : (
                    <span className="k-silhouette disc" />
                  )}
                  <span className="k-lock-badge" aria-hidden="true">
                    <LockIcon size={20} />
                  </span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {big && (
        <div className="k-sheet-backdrop" onClick={() => setBig(null)}>
          <div className="k-sticker-sheet" role="dialog" aria-label={big.he} onClick={(e) => e.stopPropagation()}>
            <img className="k-sheet-pic" src={stickerSrc(big.id)} alt={big.he} width={240} height={240} />
            <strong className="k-sheet-title">{big.he}</strong>
            <span className="k-sheet-en" dir="ltr" lang="en">
              {big.en}
            </span>
            <button className="k-icon-btn close" onClick={() => setBig(null)} aria-label="סגירה">
              <CloseIcon />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
