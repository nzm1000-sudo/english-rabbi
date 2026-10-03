import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useServices } from '@/app/services';
import { kidBooks, kidWords, stickers } from '@content/kids';
import { KID_TOPICS, type KidStage } from '@/domain/kids/schema';
import type { Student } from '@/domain/student/student';
import { speakHebrew, stopHebrew } from '@/services/speech/hebrewVoice';
import { HoldButton } from './ParentGate';
import { Blocks, KidTile, MemoryArt, OwlSays, TileArt, TileGrid, type Tint } from './KidsChrome';
import { DoorIcon } from './KidIcons';
import { stickerPic, topicPic, wordPic } from './pics';
import { TOPIC_INFO } from './topics';
import { kidsLimit, TimeUp, unlockedToday } from './timeLimit';

/** Tile tints cycle so that no two neighbors share one (2 columns). */
const TINTS: Tint[] = ['sky', 'peach', 'mint', 'butter', 'lilac', 'rose'];
const tint = (i: number) => TINTS[i % TINTS.length]!;

/**
 * Home for children. Little ones (3-6) see only big picture tiles; early
 * readers also get letters, word building and sight words. Leaving needs a
 * long press, so the child stays in their area.
 */
export function KidsHome({ student, stage }: { student: Student; stage: KidStage }) {
  const { store } = useServices();
  const nav = useNavigate();
  const base = `/s/${student.id}/kids`;
  const earned = useLiveQuery(() => store.stickersEarned(student.id), [store, student.id]);
  const minutes = useLiveQuery(() => store.minutesToday(student.id, 'kids'), [store, student.id]);
  const [unlocked, setUnlocked] = useState(() => unlockedToday(student.id));
  useEffect(() => () => stopHebrew(), []);

  const limit = kidsLimit(student);
  const timeUp = !!limit && (minutes ?? 0) >= limit && !unlocked;
  const topics = KID_TOPICS.filter((t) => kidWords.filter((w) => w.topic === t && w.stages.includes(stage)).length >= 3);
  const say = (he: string) => () => void speakHebrew(he);

  const exit = (
    <HoldButton label={stage === 'little' ? 'יציאה (להחזיק לחוץ)' : 'החלפה (להחזיק לחוץ)'} onDone={() => nav('/')}>
      <DoorIcon />
    </HoldButton>
  );

  if (timeUp) return <TimeUp studentId={student.id} onUnlock={() => setUnlocked(true)} end={exit} />;

  const more = [
    <KidTile key="memory" to={`${base}/play?game=memory`} label="זוגות" tint="lilac" art={<MemoryArt src={wordPic('cat')} />} onTap={say('זוגות')} />,
    kidBooks.some((b) => b.stage === stage) ? (
      <KidTile key="books" to={`${base}/books`} label="ספרונים" tint="sky" art={<TileArt src={wordPic('book')} />} onTap={say('ספרונים')} />
    ) : null,
    <KidTile
      key="album"
      to={`${base}/album`}
      label="מדבקות"
      tint="butter"
      art={<TileArt src={stickerPic('star')} />}
      badge={earned ? `${earned.length}/${stickers.length}` : undefined}
      onTap={say('המדבקות שלי')}
    />,
  ].filter(Boolean);

  return (
    <main className="screen kids-screen k-home" data-mood="kids">
      <div className="k-home-head">
        <OwlSays title={`שלום, ${student.name}!`} line="בואו נשחק!" size={88} />
        {exit}
      </div>

      {stage === 'young' && (
        <section className="k-section" aria-labelledby="k-h-read">
          <h2 id="k-h-read" className="k-h">קוראים</h2>
          <TileGrid>
            <KidTile to={`${base}/play?game=letters`} label="איזו אות?" tint="sky" art={<TileArt><Blocks text="ABC" /></TileArt>} onTap={say('איזו אות?')} />
            <KidTile to={`${base}/play?game=build`} label="בונים מילה" tint="peach" art={<TileArt src={wordPic('puzzle')} />} onTap={say('בונים מילה')} />
            <KidTile to={`${base}/play?game=sight`} label="מילים קסומות" tint="butter" art={<TileArt src={wordPic('star')} />} onTap={say('מילים קסומות')} />
            <KidTile to={`${base}/play?game=read`} label="מילה ותמונה" tint="mint" art={<TileArt src={wordPic('read')} />} onTap={say('קוראים ומתאימים')} />
          </TileGrid>
        </section>
      )}

      <section className="k-section" aria-labelledby="k-h-listen">
        <h2 id="k-h-listen" className="k-h">שומעים ולוחצים</h2>
        <TileGrid>
          {topics.map((t, i) => {
            const pic = topicPic(t);
            return (
              <KidTile
                key={t}
                to={`${base}/play?game=listen&topic=${t}`}
                label={TOPIC_INFO[t].he}
                tint={tint(i)}
                art={t === 'numbers' ? <TileArt><Blocks text="123" /></TileArt> : pic ? <TileArt src={pic} /> : <TileArt><span className="k-tile-emoji">{TOPIC_INFO[t].emoji}</span></TileArt>}
                onTap={say(TOPIC_INFO[t].he)}
              />
            );
          })}
        </TileGrid>
      </section>

      <section className="k-section" aria-labelledby="k-h-more">
        <h2 id="k-h-more" className="k-h">עוד משחקים</h2>
        <TileGrid>{more}</TileGrid>
      </section>

      {limit ? <p className="k-foot">{`היום: ${minutes ?? 0} מתוך ${limit} דקות`}</p> : null}
    </main>
  );
}
