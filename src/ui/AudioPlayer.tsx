import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type Ref } from 'react';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import type { Speaker } from '@/services/speech/types';
import { canonicalSpeechText } from '@/services/speech/textPrep';
import { createClipEngine, type ClipEngine, type PreparedClip } from '@/services/speech/playback/clipEngine';
import { SpeakButton } from './SpeakButton';
import { Back5Icon, NextIcon, PauseIcon, PlayIcon, PrevIcon } from './icons';

export interface PlayerSegment {
  text: string;
  speaker?: Speaker;
}

export interface AudioPlayerHandle {
  playFrom(index: number): void;
}

/** One recorded file of a sentence, at the speed `rate` it plays at. */
type Clip = PreparedClip & { segment: number; rate: number };
/** Recordings of a text: normal speed, and recorded slow. */
type FileSet = 'normal' | 'slow';
type Sets = { text: string } & Partial<Record<FileSet, Clip[] | 'missing'>>;

/**
 * The speed chip cycles through these. `file` picks the recordings (slow ones
 * are recorded slow, not stretched); `factor` speeds them up or down on playback.
 */
const SPEEDS: { key: string; file: FileSet; factor: number; label: string; he: string }[] = [
  { key: '1', file: 'normal', factor: 1, label: '1×', he: 'רגיל' },
  { key: '1.25', file: 'normal', factor: 1.25, label: '1.25×', he: 'מהיר' },
  { key: '1.5', file: 'normal', factor: 1.5, label: '1.5×', he: 'מהיר מאוד' },
  { key: '0.65', file: 'slow', factor: 0.8, label: '0.65×', he: 'איטי מאוד' },
  { key: '0.8', file: 'slow', factor: 1, label: '0.8×', he: 'איטי' },
];
const otherSet = (f: FileSet): FileSet => (f === 'normal' ? 'slow' : 'normal');

/**
 * Seekable player for a text made of recorded sentences: pause and resume
 * where it stopped, drag to any point, 5 seconds back, previous and next
 * sentence, speed (a chip that cycles). Reports the sentence being read so the text can follow.
 * Falls back to a plain speaker button when the text was not recorded.
 */
export function AudioPlayer({
  segments,
  onSegment,
  handle,
}: {
  segments: PlayerSegment[];
  onSegment?: (index: number | null) => void;
  handle?: Ref<AudioPlayerHandle>;
}) {
  const { recorded, speech } = useServices();
  const prefs = useSpeechPrefs();
  const [speedKey, setSpeedKey] = useState(() => (prefs.rate === 'slow' ? '0.8' : prefs.rate === 'slower' ? '0.65' : prefs.rate === 'fast' ? '1.25' : '1'));
  const speed = SPEEDS.find((x) => x.key === speedKey) ?? SPEEDS[0]!;
  const factor = useRef(speed.factor);
  factor.current = speed.factor;
  const [engine, setEngine] = useState<ClipEngine | null>(null);
  const [sets, setSets] = useState<Sets>({ text: '' });
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const index = useRef(0);
  const selfStop = useRef(false);
  const speechState = useSyncExternalStore(speech.subscribe, speech.getState);
  const textKey = segments.map((s) => `${s.speaker ?? 'A'}:${s.text}`).join('|');

  useEffect(() => {
    let live = true;
    let mine: ClipEngine | null = null;
    void createClipEngine().then((e) => {
      if (live) setEngine((mine = e));
      else e.dispose();
    });
    return () => {
      live = false;
      mine?.dispose();
    };
  }, []);

  // Load both recordings of this text once: the current speed first, the
  // other right after, so changing speed later is instant (no download).
  useEffect(() => {
    if (!engine) return;
    let live = true;
    const mine: Clip[] = [];
    setSets({ text: textKey });
    const loadSet = async (file: FileSet): Promise<Clip[] | 'missing'> => {
      const found: { url: string; segment: number; rate: number }[] = [];
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i]!;
        const got = await recorded.clipsFor({ text: canonicalSpeechText(s.text), accent: prefs.accent, rate: file, ...(s.speaker ? { speaker: s.speaker } : {}) });
        if (!got) return 'missing';
        for (const u of got.urls) found.push({ url: u, segment: i, rate: got.playbackRate });
      }
      const out = await Promise.all(
        found.map(async (f) => {
          const r = await fetch(f.url);
          if (!r.ok) throw new Error(`audio ${r.status}`);
          const c = await engine.prepare(await r.blob());
          if (c) mine.push({ ...c, segment: f.segment, rate: f.rate });
          return c && { ...c, segment: f.segment, rate: f.rate };
        }),
      );
      // A file that cannot be played (broken or not audio) counts as not recorded.
      return out.every((c) => !!c) ? (out as Clip[]) : 'missing';
    };
    (async () => {
      const first = (SPEEDS.find((x) => x.key === speedKey) ?? SPEEDS[0]!).file;
      for (const file of [first, otherSet(first)]) {
        const got = await loadSet(file).catch((): 'missing' => 'missing');
        if (!live) return;
        setSets((cur) => (cur.text === textKey ? { ...cur, [file]: got } : cur));
      }
    })();
    return () => {
      live = false;
      // Freed a little later: the new text keeps reading from the same point first.
      setTimeout(() => mine.forEach((c) => engine.release(c)), 3000);
    };
    // segments are compared by content (textKey); the speed only picks which set loads first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textKey, prefs.accent, recorded, engine]);

  const ready = (f: FileSet) => (Array.isArray(sets[f]) ? (sets[f] as Clip[]) : null);
  // The current speed's recordings, or the other set while those still load.
  const clips: Clip[] | null | 'missing' = ready(speed.file) ?? ready(otherSet(speed.file)) ?? (sets.normal === 'missing' && sets.slow === 'missing' ? 'missing' : null);

  const list = useMemo(() => (Array.isArray(clips) ? clips : []), [clips]);
  const starts = useMemo(() => {
    const out: number[] = [];
    let t = 0;
    for (const c of list) {
      out.push(t);
      t += c.duration;
    }
    return out;
  }, [list]);
  const total = list.reduce((sum, c) => sum + c.duration, 0);
  /** The clip the engine holds now (it may belong to an earlier list). */
  const current = useRef<Clip | null>(null);

  /** The next sentence, and this one at the other speed, ready to start at once. */
  const preloadAround = useCallback(
    (i: number) => {
      const c = list[i];
      if (!engine || !c) return;
      const next = list[i + 1];
      if (next) engine.preload(next);
      const other = [ready('normal'), ready('slow')].find((l) => l && l !== list)?.find((x) => x.segment === c.segment);
      if (other) engine.preload(other);
    },
    // ready reads sets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, engine, sets],
  );

  const pause = useCallback(() => {
    engine?.pause();
    setPlaying(false);
  }, [engine]);

  /** Silences any other sound before this player plays (without pausing itself). */
  const stopOthers = useCallback(() => {
    selfStop.current = true;
    speech.stop();
    selfStop.current = false;
  }, [speech]);

  const load = useCallback(
    (i: number, offset: number, autoplay: boolean) => {
      const c = list[i];
      if (!c || !engine) return;
      index.current = i;
      current.current = c;
      onSegment?.(c.segment);
      setPos(starts[i]! + offset);
      if (!autoplay) {
        engine.pause();
        return;
      }
      stopOthers();
      setPlaying(true);
      engine.play(c, offset, c.rate * factor.current).catch(() => setPlaying(false));
      preloadAround(i);
    },
    [list, starts, engine, onSegment, stopOthers, preloadAround],
  );

  // Advance through the clips.
  useEffect(() => {
    if (!engine) return;
    engine.onEnded = () => {
      if (index.current + 1 < list.length) load(index.current + 1, 0, true);
      else {
        setPlaying(false);
        onSegment?.(null);
      }
    };
  }, [engine, list, load, onSegment]);

  // Keep the position up to date while it plays.
  useEffect(() => {
    if (!playing || !engine) return;
    const id = setInterval(() => setPos((starts[index.current] ?? 0) + engine.time()), 200);
    return () => clearInterval(id);
  }, [playing, engine, starts]);

  // Another sound starting (a speaker button) pauses the player, and so
  // does any "stop all sound" (recording, leaving the screen).
  useEffect(() => {
    if (speechState.status !== 'idle') pause();
  }, [speechState.status, pause]);
  useEffect(() => speech.onStop(() => selfStop.current || pause()), [speech, pause]);

  // New clips (another speed, or a new line in the story): move to the same
  // point in the new clips. While it plays the engine switches without a gap.
  useEffect(() => {
    const old = current.current;
    if (!engine || !old || !list.length || list.includes(old)) return;
    const i = Math.max(0, Math.min(list.findIndex((c) => c.segment === old.segment), list.length - 1));
    const c = list[i]!;
    const at = c.segment === old.segment ? engine.map(old, engine.time(), c) : 0;
    index.current = i;
    current.current = c;
    setPos(starts[i]! + at);
    if (engine.playing) {
      engine.play(c, at, c.rate * factor.current).catch(() => setPlaying(false));
      preloadAround(i);
    }
    // Only when the clips change; starts follows them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, engine]);

  // Leaving the screen or the app stops the player.
  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && pause();
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [pause]);

  const seek = (t: number, autoplay = playing) => {
    const target = Math.max(0, Math.min(total - 0.05, t));
    let i = starts.findIndex((s, k) => target >= s && target < s + list[k]!.duration);
    if (i < 0) i = list.length - 1;
    load(i, target - starts[i]!, autoplay);
  };

  const segmentStart = (seg: number) => list.findIndex((c) => c.segment === seg);
  const playFrom = (seg: number) => {
    const i = segmentStart(seg);
    if (i >= 0) load(i, 0, true);
  };
  useImperativeHandle(handle, () => ({ playFrom }));

  if (clips === 'missing') {
    return <SpeakButton text={segments.map((s) => s.text).join(' ')} label="השמעה" />;
  }

  const toggle = () => {
    if (!list.length) return;
    engine?.unlock();
    if (playing) return pause();
    seek(pos >= total - 0.1 ? 0 : pos, true);
  };
  const currentSeg = list[index.current]?.segment ?? 0;
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  const nextSpeed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
  const pct = total ? (Math.min(pos, total) / total) * 100 : 0;

  // Media controls read left to right in every language: back on the left.
  return (
    <div className="player" dir="ltr" role="group" aria-label="נגן הקראה">
      <div className="player-track">
        <span className="player-time">{fmt(pos)}</span>
        <input
          className="player-bar"
          type="range"
          min={0}
          max={total || 1}
          step={0.1}
          value={Math.min(pos, total || 1)}
          disabled={!list.length}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="מיקום בהקראה"
          style={{ '--p': `${pct}%` } as CSSProperties}
        />
        <span className="player-time end">{list.length ? fmt(total) : '–:––'}</span>
      </div>
      <div className="player-row">
        <button type="button" className="player-btn" aria-label="5 שניות אחורה" disabled={!list.length} onClick={() => seek(pos - 5)}>
          <Back5Icon size={24} />
        </button>
        <button type="button" className="player-btn" aria-label="המשפט הקודם" disabled={!list.length} onClick={() => playFrom(Math.max(0, currentSeg - (pos - (starts[segmentStart(currentSeg)] ?? 0) > 1.5 ? 0 : 1)))}>
          <PrevIcon />
        </button>
        <button type="button" className="player-btn player-main" aria-label={playing ? 'השהיה' : 'ניגון'} disabled={!list.length} onClick={toggle}>
          {playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
        </button>
        <button type="button" className="player-btn" aria-label="המשפט הבא" disabled={!list.length || currentSeg >= segments.length - 1} onClick={() => playFrom(currentSeg + 1)}>
          <NextIcon />
        </button>
        <button
          type="button"
          className="player-speed"
          aria-label={`מהירות: ${speed.he}. להקיש למהירות ${nextSpeed.he}`}
          onClick={() => {
            factor.current = nextSpeed.factor;
            // Same recordings (1×, 1.25×, 1.5×): the running stream changes speed.
            // Other recordings: the clips change, and the effect above switches.
            const c = current.current;
            if (engine && c && nextSpeed.file === speed.file) engine.setRate(c.rate * nextSpeed.factor);
            setSpeedKey(nextSpeed.key);
          }}
        >
          {speed.label}
        </button>
      </div>
    </div>
  );
}
