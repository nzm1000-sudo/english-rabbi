import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useServices } from '@/app/services';
import { kidBooks, kidWords, stickers } from '@content/kids';
import { KID_TOPICS, type KidStage } from '@/domain/kids/schema';
import type { Student } from '@/domain/student/student';
import { Avatar } from '@/ui/Avatar';
import { speakHebrew, stopHebrew } from '@/services/speech/hebrewVoice';
import { HoldButton } from './ParentGate';
import { TOPIC_INFO } from './topics';

/**
 * Home for children. Little ones (3-6) see only big picture tiles; leaving
 * needs a long press so they stay in their area. Early readers also get
 * letters, word building and sight words.
 */
export function KidsHome({ student, stage }: { student: Student; stage: KidStage }) {
  const { store } = useServices();
  const nav = useNavigate();
  const base = `/s/${student.id}/kids`;
  const earned = useLiveQuery(() => store.stickersEarned(student.id), [store, student.id]);
  const minutes = useLiveQuery(() => store.minutesToday(student.id, 'kids'), [store, student.id]);
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(`kids-unlocked:${student.id}`) === new Date().toDateString();
    } catch {
      return false;
    }
  });
  useEffect(() => () => stopHebrew(), []);

  const limit = stage === 'little' ? student.kidsDailyLimit : undefined;
  const timeUp = !!limit && (minutes ?? 0) >= limit && !unlocked;
  const topics = KID_TOPICS.filter((t) => kidWords.filter((w) => w.topic === t && w.stages.includes(stage)).length >= 3);
  const say = (he: string) => void speakHebrew(he);

  const exit = (
    <HoldButton label="יציאה (להחזיק לחוץ)" onDone={() => nav('/')}>
      <span aria-hidden="true">🚪</span>
    </HoldButton>
  );

  if (timeUp) {
    return (
      <main className="screen kids-screen">
        <header className="spread">{exit}</header>
        <div className="kids-done">
          <span className="kids-big-emoji" aria-hidden="true">🌙</span>
          <strong>להיום סיימנו!</strong>
          <span className="muted">נתראה מחר עם עוד מילים ומדבקות.</span>
          <HoldButton
            wide
            label="הורים: עוד זמן היום (להחזיק לחוץ)"
            onDone={() => {
              try {
                sessionStorage.setItem(`kids-unlocked:${student.id}`, new Date().toDateString());
              } catch {
                /* ignore */
              }
              setUnlocked(true);
            }}
          >
            <span className="xs">הורים: עוד זמן</span>
          </HoldButton>
        </div>
      </main>
    );
  }

  return (
    <main className="screen kids-screen">
      <header className="spread">
        <div className="row" style={{ gap: 10 }}>
          <Avatar name={student.name} hue={student.hue} />
          <strong style={{ fontSize: 'var(--t-lg)' }}>שלום, {student.name}</strong>
        </div>
        {stage === 'little' ? exit : (
          <Link to="/" className="switch-link">
            החלפה
          </Link>
        )}
      </header>

      {stage === 'young' && (
        <section className="stack">
          <h2 className="kids-h">קוראים 📖</h2>
          <div className="kids-grid">
            <KidTile to={`${base}/play?game=letters`} emoji="🔤" he="איזו אות?" hue={210} onTap={say} />
            <KidTile to={`${base}/play?game=build`} emoji="🧩" he="בונים מילה" hue={160} onTap={say} />
            <KidTile to={`${base}/play?game=sight`} emoji="✨" he="מילים קסומות" hue={280} onTap={say} />
            <KidTile to={`${base}/play?game=read`} emoji="🖼️" he="קוראים ומתאימים" hue={35} onTap={say} />
          </div>
        </section>
      )}

      <section className="stack">
        <h2 className="kids-h">{stage === 'little' ? 'שומעים ולוחצים 👂' : 'שומעים ולוחצים 👂'}</h2>
        <div className="kids-grid">
          {topics.map((t) => (
            <KidTile key={t} to={`${base}/play?game=listen&topic=${t}`} emoji={TOPIC_INFO[t].emoji} he={TOPIC_INFO[t].he} hue={TOPIC_INFO[t].hue} onTap={say} />
          ))}
        </div>
      </section>

      <section className="stack">
        <h2 className="kids-h">עוד משחקים 🎈</h2>
        <div className="kids-grid">
          <KidTile to={`${base}/play?game=memory`} emoji="🎴" he="זוגות" hue={190} onTap={say} />
          {kidBooks.some((b) => b.stage === stage) && <KidTile to={`${base}/books`} emoji="📚" he="ספרונים" hue={25} onTap={say} />}
          <KidTile to={`${base}/album`} emoji="⭐" he={`המדבקות שלי${earned ? ` (${earned.length}/${stickers.length})` : ''}`} hue={45} onTap={() => say('המדבקות שלי')} />
        </div>
      </section>
      {limit ? <p className="xs muted txt-center">{`היום: ${minutes ?? 0} מתוך ${limit} דקות`}</p> : null}
    </main>
  );
}

function KidTile({ to, emoji, he, hue, onTap }: { to: string; emoji: string; he: string; hue: number; onTap: (he: string) => void }) {
  return (
    <Link to={to} className="kid-tile" style={{ '--h': hue } as CSSProperties} onClick={() => onTap(he)}>
      <span className="kid-tile-emoji" aria-hidden="true">
        {emoji}
      </span>
      <span className="kid-tile-label">{he}</span>
    </Link>
  );
}
