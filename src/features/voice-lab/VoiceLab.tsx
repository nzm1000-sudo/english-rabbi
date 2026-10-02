import { useEffect, useState, useSyncExternalStore } from 'react';
import { useServices } from '@/app/services';
import { TopBar } from '@/ui/TopBar';
import { En } from '@/ui/En';
import { SpeakerIcon, StopIcon, CheckIcon } from '@/ui/icons';
import type { Accent, SpeechRate } from '@/domain/student/student';
import type { SpeechVoice } from '@/services/speech/types';
import { rankVoices } from '@/services/speech/tts/voiceRanking';

/**
 * Voice lab: compare voices by ear on this device with fixed test sentences
 * (contractions, questions, conditionals) and choose the preferred device
 * voice per accent. Engine quality cannot be judged from documentation.
 */
export const TEST_SENTENCES = [
  'Hello, my name is Sarah.',
  "I'd like to know what you're doing tomorrow.",
  'Have you ever been to London?',
  'Although it was raining, we decided to go outside.',
  "I would've called you if I'd known you were home.",
];

export function VoiceLab() {
  const { speech, settings } = useServices();
  const [accent, setAccent] = useState<Accent>('en-US');
  const [rate, setRate] = useState<SpeechRate>('normal');
  const [voices, setVoices] = useState<SpeechVoice[] | null>(null);
  const [providers, setProviders] = useState<{ id: string; label: string; ok: boolean }[]>([]);
  const prefs = useSyncExternalStore(settings.subscribe, settings.snapshot);
  const chosen = accent === 'en-US' ? prefs.deviceVoiceUS : prefs.deviceVoiceGB;

  useEffect(() => {
    const web = speech.getProviders().find((p) => p.id === 'web-speech');
    web?.voices().then(setVoices);
    Promise.all(
      speech.getProviders().map(async (p) => ({ id: p.id, label: p.label, ok: await p.canSpeak({ text: TEST_SENTENCES[0]!, accent, rate }).catch(() => false) })),
    ).then(setProviders);
  }, [speech, accent, rate]);

  const ranked = voices ? rankVoices(voices, accent).filter((v) => v.accent === accent) : [];
  const others = voices ? rankVoices(voices, accent).filter((v) => v.accent !== accent).slice(0, 4) : [];

  return (
    <main className="screen">
      <TopBar back="/parent" title="מעבדת קולות" />
      <p className="small muted">
        כאן בוחנים את הקולות במכשיר הזה באוזן. כדאי להקשיב במיוחד לקיצורים (I&apos;d, you&apos;re), לשאלות ולמשפט הארוך.
      </p>

      <div className="segmented" role="group" aria-label="מבטא">
        <button aria-pressed={accent === 'en-US'} onClick={() => setAccent('en-US')}>אמריקאי</button>
        <button aria-pressed={accent === 'en-GB'} onClick={() => setAccent('en-GB')}>בריטי</button>
      </div>
      <div className="segmented" role="group" aria-label="מהירות">
        <button aria-pressed={rate === 'slow'} onClick={() => setRate('slow')}>איטי</button>
        <button aria-pressed={rate === 'normal'} onClick={() => setRate('normal')}>רגיל</button>
      </div>

      <section className="stack">
        <span className="section-label">מנועים זמינים</span>
        <div className="list">
          {providers.map((p) => (
            <div key={p.id} className="list-item">
              <span className="grow">{p.label}</span>
              <span className={`badge ${p.ok ? 'badge-good' : 'badge-neutral'}`}>{p.ok ? 'פעיל' : 'לא זמין'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <span className="section-label">קולות המכשיר ({accent === 'en-US' ? 'אמריקאי' : 'בריטי'})</span>
        {voices === null ? (
          <p className="muted small">טוען קולות…</p>
        ) : ranked.length === 0 ? (
          <p className="muted small">לא נמצאו קולות במבטא הזה במכשיר.</p>
        ) : (
          <div className="list">
            {[...ranked, ...others].map((v) => (
              <VoiceRow
                key={v.id}
                voice={v}
                chosen={chosen === v.id}
                onChoose={() => settings.set(accent === 'en-US' ? { deviceVoiceUS: v.id } : { deviceVoiceGB: v.id })}
                accent={accent}
                rate={rate}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function VoiceRow({ voice, chosen, onChoose, accent, rate }: { voice: SpeechVoice; chosen: boolean; onChoose: () => void; accent: Accent; rate: SpeechRate }) {
  const { speech } = useServices();
  const state = useSyncExternalStore(speech.subscribe, speech.getState);
  const [i, setI] = useState(0);
  const key = `lab:${voice.id}`;
  const playing = state.status !== 'idle' && state.key === key;
  const play = () => {
    if (playing) return speech.stop();
    void speech.speak(TEST_SENTENCES[i]!, { accent, rate, voiceId: voice.id, provider: 'web-speech', key });
  };
  return (
    <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--s-2)' }}>
      <div className="row">
        <button className="speak" onClick={play} aria-label={playing ? 'עצירה' : `השמעה בקול ${voice.name}`} data-state={playing ? state.status : 'idle'}>
          {playing ? <StopIcon size={18} /> : <SpeakerIcon />}
        </button>
        <div className="grow">
          <En>{voice.name}</En>
          <div className="xs muted">
            <En>{voice.lang}</En> · {voice.quality === 'standard' ? 'רגיל' : voice.quality} · {voice.offline ? 'עובד בלי אינטרנט' : 'דורש אינטרנט'}
          </div>
        </div>
        <button className={`btn btn-sm ${chosen ? 'btn-primary' : ''}`} onClick={onChoose} aria-pressed={chosen}>
          {chosen ? <CheckIcon /> : 'בחירה'}
        </button>
      </div>
      <div className="chips">
        {TEST_SENTENCES.map((_, n) => (
          <button key={n} className="chip" style={{ minHeight: 32 }} aria-pressed={i === n} onClick={() => setI(n)} aria-label={`משפט ${n + 1}`}>
            {n + 1}
          </button>
        ))}
      </div>
      <En className="small muted">{TEST_SENTENCES[i]}</En>
    </div>
  );
}
