import { createContext, useContext, type ReactNode } from 'react';
import { TutorDB } from '@/data/schema';
import { LearningStore } from '@/data/store';
import { DexieAudioCache } from '@/data/audioCache';
import { contentRegistry } from '@content/index';
import type { ContentRegistry } from '@/domain/content/registry';
import { SpeechService } from '@/services/speech/speechService';
import { HtmlAudioPlayback } from '@/services/speech/playback/audioPlayer';
import { PrerenderedProvider } from '@/services/speech/tts/prerenderedProvider';
import { RemoteTtsProvider } from '@/services/speech/tts/remoteProvider';
import { WebSpeechProvider } from '@/services/speech/tts/webSpeechProvider';
import { Settings } from './settings';

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
}

export function createAppServices(): AppServices {
  const db = new TutorDB();
  const store = new LearningStore(db);
  const settings = new Settings(db);
  const playback = new HtmlAudioPlayback();
  const remote = new RemoteTtsProvider(() => ({ baseUrl: settings.get('homeServerUrl') ?? '' }), playback, new DexieAudioCache(db));
  settings.subscribe(() => remote.resetHealth());
  // Priority: neural audio first, device voice last so speech always works offline.
  const speech = new SpeechService([new PrerenderedProvider(playback), remote, new WebSpeechProvider()]);
  return { db, store, content: contentRegistry, speech, settings };
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
