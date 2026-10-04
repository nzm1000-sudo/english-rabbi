import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type Ref } from 'react';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import type { Speaker, SpeechRate } from '@/services/speech/types';
import { canonicalSpeechText } from '@/services/speech/textPrep';
import { SpeakButton } from './SpeakButton';
import { Back5Icon, NextIcon, PauseIcon, PlayIcon, PrevIcon } from './icons';

export interface PlayerSegment {
  text: string;
  speaker?: Speaker;
}

export interface AudioPlayerHandle {
  playFrom(index: number): void;
}

type Clip = { url: string; segment: number; duration: number; rate: number };

/**
 * The speed chip cycles through these. `rate` picks the recordings (slow ones
 * are recorded slow, not stretched); `factor` speeds the normal ones up on
 * playback, which sounds natural and needs no reload.
 */
const SPEEDS: { key: string; rate: SpeechRate; factor: number; label: string; he: string }[] = [
  { key: '1', rate: 'normal', factor: 1, label: '1×', he: 'רגיל' },
  { key: '1.25', rate: 'normal', factor: 1.25, label: '1.25×', he: 'מהיר' },
  { key: '1.5', rate: 'normal', factor: 1.5, label: '1.5×', he: 'מהיר מאוד' },
  { key: '0.65', rate: 'slower', factor: 1, label: '0.65×', he: 'איטי מאוד' },
  { key: '0.8', rate: 'slow', factor: 1, label: '0.8×', he: 'איטי' },
];

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
  const [speedKey, setSpeedKey] = useState(() => (prefs.rate === 'slow' ? '0.8' : prefs.rate === 'slower' ? '0.65' : '1'));
  const speed = SPEEDS.find((x) => x.key === speedKey) ?? SPEEDS[0]!;
  const rate = speed.rate;
  const factor = useRef(speed.factor);
  factor.current = speed.factor;
  const [clips, setClips] = useState<Clip[] | null | 'missing'>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const index = useRef(0);
  const urls = useRef<string[]>([]);
  const selfStop = useRef(false);
  /** Files of the clips being replaced (another speed): freed once the new ones play. */
  const oldUrls = useRef<string[]>([]);
  const loadedText = useRef<string | null>(null);
  const speechState = useSyncExternalStore(speech.subscribe, speech.getState);
  const textKey = segments.map((s) => `${s.speaker ?? 'A'}:${s.text}`).join('|');

  // Load the clips and their lengths for this text and speed.
  useEffect(() => {
    let live = true;
    // A new text starts empty; a new speed keeps playing the old clips until the new ones are ready.
    if (loadedText.current !== textKey) setClips(null);
    (async () => {
      const out: Clip[] = [];
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i]!;
        const found = await recorded.clipsFor({ text: canonicalSpeechText(s.text), accent: prefs.accent, rate, ...(s.speaker ? { speaker: s.speaker } : {}) });
        if (!found) return live && setClips('missing');
        for (const u of found.urls) out.push({ url: u, segment: i, duration: 0, rate: found.playbackRate });
      }
      const blobs = await Promise.all(
        out.map((c) =>
          fetch(c.url).then((r) => {
            if (!r.ok) throw new Error(`audio ${r.status}`);
            return r.blob();
          }),
        ),
      );
      if (!live) return;
      const fresh = blobs.map((b) => URL.createObjectURL(b));
      const probe = fresh;
      await Promise.all(
        probe.map(
          (u, i) =>
            new Promise<void>((resolve) => {
              const a = new Audio();
              a.preload = 'metadata';
              a.onloadedmetadata = () => {
                out[i]!.duration = Number.isFinite(a.duration) ? a.duration : 0;
                resolve();
              };
              a.onerror = () => resolve();
              a.src = u;
            }),
        ),
      );
      if (!live) return fresh.forEach((u) => URL.revokeObjectURL(u));
      oldUrls.current.push(...urls.current);
      urls.current = fresh;
      loadedText.current = textKey;
      // A file that cannot be played (broken or not audio) means no player: use the speaker button.
      setClips(out.every((c) => c.duration > 0) ? out : 'missing');
    })().catch(() => live && setClips('missing'));
    return () => {
      live = false;
    };
    // segments are compared by content (textKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textKey, rate, prefs.accent, recorded]);

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

  const pause = useCallback(() => {
    audio.current?.pause();
    setPlaying(false);
  }, []);

  /** A play cut short by a newer load (dragging the bar) is not a stop. */
  const playEl = useCallback((el: HTMLAudioElement) => {
    el.play().then(
      () => setPlaying(true),
      (e: unknown) => (e as Error)?.name !== 'AbortError' && setPlaying(false),
    );
  }, []);

  /** Silences any other sound before this player plays (without pausing itself). */
  const stopOthers = useCallback(() => {
    selfStop.current = true;
    speech.stop();
    selfStop.current = false;
  }, [speech]);

  const load = useCallback(
    (i: number, offset: number, autoplay: boolean) => {
      const c = list[i];
      if (!c) return;
      index.current = i;
      const el = (audio.current ??= new Audio());
      el.src = urls.current[i]!;
      (el as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
      el.preservesPitch = true;
      el.defaultPlaybackRate = c.rate * factor.current;
      el.playbackRate = c.rate * factor.current;
      el.currentTime = offset;
      onSegment?.(c.segment);
      setPos(starts[i]! + offset);
      if (autoplay) {
        stopOthers();
        playEl(el);
      }
    },
    [list, starts, onSegment, stopOthers, playEl],
  );

  // Advance through the clips and keep the position up to date.
  useEffect(() => {
    const el = (audio.current ??= new Audio());
    const onTime = () => el.getAttribute('src') && setPos((starts[index.current] ?? 0) + el.currentTime);
    const onEnded = () => {
      if (index.current + 1 < list.length) load(index.current + 1, 0, true);
      else {
        setPlaying(false);
        onSegment?.(null);
      }
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
    };
  }, [list, starts, load, onSegment]);

  // Another sound starting (a speaker button) pauses the player, and so
  // does any "stop all sound" (recording, leaving the screen).
  useEffect(() => {
    if (speechState.status !== 'idle') pause();
  }, [speechState.status, pause]);
  useEffect(() => speech.onStop(() => selfStop.current || pause()), [speech, pause]);

  // New clips (another speed, or a new line in the story): the element still
  // holds a file of the old list. Move to the same point in the new clips and
  // keep playing if it was playing, so a speed change never stops the reading.
  useEffect(() => {
    const el = audio.current;
    const free = () => {
      oldUrls.current.forEach((u) => URL.revokeObjectURL(u));
      oldUrls.current = [];
    };
    if (!el?.getAttribute('src') || !list.length || urls.current.includes(el.src)) return free();
    const i = Math.min(index.current, list.length - 1);
    const part = el.duration > 0 ? Math.min(1, el.currentTime / el.duration) : 0;
    const wasPlaying = !el.paused && !el.ended;
    if (wasPlaying) load(i, part * list[i]!.duration, true);
    else {
      el.pause();
      el.removeAttribute('src');
      el.load();
      index.current = i;
      setPos(starts[i]! + part * list[i]!.duration);
    }
    free();
    // Only when the clips change; load and starts follow them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  // Leaving the screen or the app stops the player.
  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && pause();
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      audio.current?.pause();
      [...urls.current, ...oldUrls.current].forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
      oldUrls.current = [];
    };
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
    if (playing) return pause();
    const el = audio.current;
    if (el && el.src && el.currentTime > 0 && !el.ended) {
      stopOthers();
      playEl(el);
    } else seek(pos >= total - 0.1 ? 0 : pos, true);
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
            // Same recordings (1×, 1.25×, 1.5×): change speed in place, without a pause.
            const el = audio.current;
            const c = list[index.current];
            if (el && c && nextSpeed.rate === rate) el.playbackRate = c.rate * nextSpeed.factor;
            setSpeedKey(nextSpeed.key);
          }}
        >
          {speed.label}
        </button>
      </div>
    </div>
  );
}
