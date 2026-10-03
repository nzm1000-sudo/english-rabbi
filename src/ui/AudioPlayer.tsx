import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type Ref } from 'react';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import type { Speaker, SpeechRate } from '@/services/speech/types';
import { canonicalSpeechText } from '@/services/speech/textPrep';
import { SpeakButton } from './SpeakButton';

export interface PlayerSegment {
  text: string;
  speaker?: Speaker;
}

export interface AudioPlayerHandle {
  playFrom(index: number): void;
}

type Clip = { url: string; segment: number; duration: number; rate: number };

const SPEEDS: { rate: SpeechRate; label: string }[] = [
  { rate: 'normal', label: 'רגיל' },
  { rate: 'slow', label: 'איטי' },
  { rate: 'slower', label: 'איטי מאוד' },
];

/**
 * Seekable player for a text made of recorded sentences: pause and resume
 * where it stopped, drag to any point, 5 seconds back, previous and next
 * sentence, speed. Reports the sentence being read so the text can follow.
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
  const [rate, setRate] = useState<SpeechRate>(prefs.rate === 'fast' ? 'normal' : prefs.rate);
  const [clips, setClips] = useState<Clip[] | null | 'missing'>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const index = useRef(0);
  const urls = useRef<string[]>([]);
  const speechState = useSyncExternalStore(speech.subscribe, speech.getState);
  const textKey = segments.map((s) => `${s.speaker ?? 'A'}:${s.text}`).join('|');

  // Load the clips and their lengths for this text and speed.
  useEffect(() => {
    let live = true;
    setClips(null);
    (async () => {
      const out: Clip[] = [];
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i]!;
        const found = await recorded.clipsFor({ text: canonicalSpeechText(s.text), accent: prefs.accent, rate, ...(s.speaker ? { speaker: s.speaker } : {}) });
        if (!found) return live && setClips('missing');
        for (const u of found.urls) out.push({ url: u, segment: i, duration: 0, rate: found.playbackRate });
      }
      const blobs = await Promise.all(out.map((c) => fetch(c.url).then((r) => r.blob())));
      if (!live) return;
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = blobs.map((b) => URL.createObjectURL(b));
      await Promise.all(
        urls.current.map(
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
      if (live) setClips(out);
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

  const load = useCallback(
    (i: number, offset: number, autoplay: boolean) => {
      const c = list[i];
      if (!c) return;
      index.current = i;
      const el = (audio.current ??= new Audio());
      el.src = urls.current[i]!;
      (el as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
      el.preservesPitch = true;
      el.defaultPlaybackRate = c.rate;
      el.playbackRate = c.rate;
      el.currentTime = offset;
      onSegment?.(c.segment);
      setPos(starts[i]! + offset);
      if (autoplay) {
        speech.stop();
        void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
    },
    [list, starts, onSegment, speech],
  );

  // Advance through the clips and keep the position up to date.
  useEffect(() => {
    const el = (audio.current ??= new Audio());
    const onTime = () => setPos((starts[index.current] ?? 0) + el.currentTime);
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

  // Another sound starting (a speaker button) pauses the player.
  useEffect(() => {
    if (speechState.status !== 'idle') pause();
  }, [speechState.status, pause]);

  // Leaving the screen or the app stops the player.
  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && pause();
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      audio.current?.pause();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
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
      speech.stop();
      void el.play().then(() => setPlaying(true));
    } else seek(pos >= total - 0.1 ? 0 : pos, true);
  };
  const currentSeg = list[index.current]?.segment ?? 0;
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  return (
    <div className="player" dir="ltr" aria-label="נגן הקראה">
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
        style={{ '--p': `${total ? (pos / total) * 100 : 0}%` } as CSSProperties}
      />
      <div className="player-row">
        <span className="player-time">{fmt(pos)}</span>
        <div className="player-buttons">
          <button type="button" className="player-btn" aria-label="המשפט הקודם" disabled={!list.length} onClick={() => playFrom(Math.max(0, currentSeg - (pos - (starts[segmentStart(currentSeg)] ?? 0) > 1.5 ? 0 : 1)))}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 5v14M18 5 9 12l9 7z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="player-btn" aria-label="5 שניות אחורה" disabled={!list.length} onClick={() => seek(pos - 5)}>
            <span className="player-5">5</span>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="player-btn player-main" aria-label={playing ? 'עצירה' : 'ניגון'} disabled={!list.length} onClick={toggle}>
            {playing ? (
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></svg>
            )}
          </button>
          <button type="button" className="player-btn" aria-label="המשפט הבא" disabled={!list.length || currentSeg >= segments.length - 1} onClick={() => playFrom(currentSeg + 1)}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M18 5v14M6 5l9 7-9 7z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <span className="player-time">{list.length ? fmt(total) : '...'}</span>
      </div>
      <div className="segmented player-speed" role="group" aria-label="מהירות" dir="rtl">
        {SPEEDS.map((s) => (
          <button
            key={s.rate}
            type="button"
            aria-pressed={rate === s.rate}
            onClick={() => {
              pause();
              setRate(s.rate);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
