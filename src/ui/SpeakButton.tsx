import { useId, useSyncExternalStore } from 'react';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import type { Speaker } from '@/services/speech/types';
import { SpeakerIcon, StopIcon, TurtleIcon } from './icons';

/**
 * The single speaker button used everywhere. Tap to play, tap again to stop.
 * Shows loading and playing states for this button only.
 */
export function SpeakButton({
  text,
  speaker,
  large = false,
  slow = false,
  label = 'השמעה',
  onPlayed,
}: {
  text: string;
  speaker?: Speaker;
  large?: boolean;
  /** Turtle button: always plays at the slowest speed. */
  slow?: boolean;
  label?: string;
  onPlayed?: () => void;
}) {
  const { speech, settings } = useServices();
  const prefs = useSpeechPrefs();
  const id = useId();
  const state = useSyncExternalStore(speech.subscribe, speech.getState);
  const mine = state.status !== 'idle' && state.key === id;

  const onClick = async () => {
    if (mine) {
      speech.stop();
      return;
    }
    const voiceId = prefs.accent === 'en-US' ? settings.get('deviceVoiceUS') : settings.get('deviceVoiceGB');
    const r = await speech.speak(text, { ...prefs, ...(slow ? { rate: 'slower' as const } : {}), key: id, ...(speaker ? { speaker } : {}), ...(voiceId ? { voiceId } : {}) });
    if (r === 'done') onPlayed?.();
  };

  return (
    <button
      type="button"
      className={`speak${large ? ' speak-lg' : ''}${slow ? ' speak-slow' : ''}`}
      data-state={mine ? state.status : 'idle'}
      aria-label={mine ? 'עצירה' : label}
      onClick={onClick}
    >
      {mine && state.status === 'playing' ? <StopIcon size={large ? 28 : 18} /> : slow ? <TurtleIcon size={26} /> : <SpeakerIcon size={large ? 30 : 20} />}
    </button>
  );
}
