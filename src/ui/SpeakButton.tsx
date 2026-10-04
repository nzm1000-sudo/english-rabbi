import { useId, useSyncExternalStore, type MouseEvent } from 'react';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import type { Speaker } from '@/services/speech/types';
import { dialogueLines } from '@/services/speech/textPrep';
import { SpeakerIcon, TurtleIcon } from './icons';

export type SpeakSize = 'inline' | 'md' | 'hero';

/** Three bars that move while this button is playing (static with reduced motion). */
export function Equalizer({ size = 20 }: { size?: number }) {
  return (
    <svg className="eq" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect className="eq-bar" x="4" y="4" width="4" height="16" rx="2" />
      <rect className="eq-bar" x="10" y="4" width="4" height="16" rx="2" />
      <rect className="eq-bar" x="16" y="4" width="4" height="16" rx="2" />
    </svg>
  );
}

const ICON: Record<SpeakSize, number> = { inline: 18, md: 20, hero: 34 };

/**
 * The single speaker button used everywhere. Tap to play, tap again to stop.
 * Shows loading and playing states for this button only.
 * Sizes: inline (32 visual, 48 hit; inside text rows), md (48), hero (96).
 */
export function SpeakButton({
  text,
  speaker,
  size = 'md',
  large = false,
  slow = false,
  label = 'השמעה',
  onPlayed,
  className = '',
}: {
  text: string;
  speaker?: Speaker;
  size?: SpeakSize;
  /** Same as size="hero". */
  large?: boolean;
  /** Turtle button: always plays at the slowest speed. */
  slow?: boolean;
  label?: string;
  onPlayed?: () => void;
  className?: string;
}) {
  const { speech, settings } = useServices();
  const prefs = useSpeechPrefs();
  const id = useId();
  const state = useSyncExternalStore(speech.subscribe, speech.getState);
  const mine = state.status !== 'idle' && state.key === id;
  const sz: SpeakSize = large ? 'hero' : size;

  const onClick = async (e: MouseEvent) => {
    // Never also trigger the row it sits in (answer options).
    e.stopPropagation();
    if (mine) {
      speech.stop();
      return;
    }
    const voiceId = prefs.accent === 'en-US' ? settings.get('deviceVoiceUS') : settings.get('deviceVoiceGB');
    const opts = { ...prefs, ...(slow ? { rate: 'slower' as const } : {}), key: id, ...(voiceId ? { voiceId } : {}) };
    // A written dialogue ("Dan: ... Maya: ...") plays as two voices, without reading the names.
    const lines = speaker ? null : dialogueLines(text);
    const r = lines ? await speech.speakDialogue(lines, opts) : await speech.speak(text, { ...opts, ...(speaker ? { speaker } : {}) });
    if (r === 'done') onPlayed?.();
  };

  const playing = mine && state.status === 'playing';
  const icon = slow && sz === 'hero' ? 30 : ICON[sz];
  return (
    <button
      type="button"
      className={`speak speak-${sz}${slow ? ' speak-slow' : ''} ${className}`.trim()}
      data-state={mine ? state.status : 'idle'}
      aria-label={mine ? 'עצירה' : label}
      aria-pressed={playing || undefined}
      onClick={onClick}
    >
      {playing ? <Equalizer size={icon} /> : slow ? <TurtleIcon size={icon + 4} /> : <SpeakerIcon size={icon} />}
    </button>
  );
}
