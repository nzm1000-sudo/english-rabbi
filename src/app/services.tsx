import { createContext, useContext, type ReactNode } from 'react';
import { TutorDB } from '@/data/schema';
import { LearningStore } from '@/data/store';
import { DexieAudioCache } from '@/data/audioCache';
import { contentRegistry } from '@content/index';
import type { ContentRegistry } from '@/domain/content/registry';
import { SpeechService } from '@/services/speech/speechService';
import { HtmlAudioPlayback } from '@/services/speech/playback/audioPlayer';
import { setHebrewPlayback } from '@/services/speech/hebrewVoice';
import { PrerenderedProvider } from '@/services/speech/tts/prerenderedProvider';
import { RemoteTtsProvider } from '@/services/speech/tts/remoteProvider';
import { WebSpeechProvider } from '@/services/speech/tts/webSpeechProvider';
import { applyTheme, Settings } from './settings';
import { setSoundEnabled } from '@/services/sound';

/**
 * Composition root. The only place that wires concrete implementations.
 * Tests build their own AppServices with fakes.
 */
export interface AppServices {
  db: TutorDB;
  store: LearningStore;
  content: ContentRegistry;
  speech: SpeechService;
  settings: Settings;
  /** Pre-recorded audio files, for the seekable audio player. */
  recorded: PrerenderedProvider;
}

export function createAppServices(): AppServices {
  const db = new TutorDB();
  const store = new LearningStore(db);
  const settings = new Settings(db);
  const playback = new HtmlAudioPlayback();
  const remote = new RemoteTtsProvider(() => ({ baseUrl: settings.get('homeServerUrl') ?? '' }), playback, new DexieAudioCache(db));
  settings.subscribe(() => {
    remote.resetHealth();
    setSoundEnabled(!settings.get('soundOff'));
    applyTheme(settings.get('theme'));
  });
  // Priority: neural audio first, device voice last so speech always works offline.
  const recorded = new PrerenderedProvider(playback);
  setHebrewPlayback(playback);
  const speech = new SpeechService([recorded, remote, new WebSpeechProvider()]);
  return { db, store, content: contentRegistry, speech, settings, recorded };
}

const Ctx = createContext<AppServices | null>(null);

export function ServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}

export function useServices(): AppServices {
  const s = useContext(Ctx);
  if (!s) throw new Error('ServicesProvider missing');
  return s;
}
