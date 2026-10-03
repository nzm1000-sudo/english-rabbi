// @vitest-environment node
import { splitSentences } from './textPrep';
import { audioKey } from './audioKey';
import { inferQuality, rankVoices } from './tts/voiceRanking';
import { SpeechService } from './speechService';
import { RemoteTtsProvider } from './tts/remoteProvider';
import { PrerenderedProvider } from './tts/prerenderedProvider';
import { abortError, type SpeakRequest, type SpeechProvider, type SpeechVoice } from './types';
import type { AudioPlayback } from './playback/audioPlayer';
import { DexieAudioCache } from '@/data/audioCache';
import { TutorDB } from '@/data/schema';

describe('sentence splitting', () => {
  it('splits at sentence ends but not at abbreviations or decimals', () => {
    expect(splitSentences('Hello, my name is Sarah. Mr. Smith paid 3.5 dollars! Is that OK?')).toEqual([
      'Hello, my name is Sarah.',
      'Mr. Smith paid 3.5 dollars!',
      'Is that OK?',
    ]);
  });

  it('keeps contractions intact', () => {
    expect(splitSentences("I would've called you if I'd known you were home.")).toHaveLength(1);
  });

  it('splits very long sentences at commas', () => {
    const long = Array.from({ length: 30 }, (_, i) => `part number ${i}`).join(', ') + '.';
    expect(splitSentences(long, 100).every((s) => s.length <= 110)).toBe(true);
  });
});

describe('audio key', () => {
  it('is stable and sensitive to voice, rate and text', () => {
    const k = audioKey('af_heart', 'normal', 'Hello there.');
    expect(k).toBe(audioKey('af_heart', 'normal', '  Hello   there. '));
    expect(k).toBe(audioKey('af_heart', 'normal', 'Hello there.'));
    expect(k).not.toBe(audioKey('bf_emma', 'normal', 'Hello there.'));
    expect(k).not.toBe(audioKey('af_heart', 'slow', 'Hello there.'));
    expect(audioKey('a', 'normal', "I’d")).toBe(audioKey('a', 'normal', "I'd"));
    expect(k).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('device voice ranking', () => {
  const v = (name: string, lang: string): SpeechVoice => ({ id: name, name, lang, accent: lang === 'en-US' ? 'en-US' : lang === 'en-GB' ? 'en-GB' : 'other', quality: inferQuality(name), provider: 'web', offline: true });

  it('prefers the requested accent and higher quality, and drops novelty voices', () => {
    const voices = [v('Zarvox', 'en-US'), v('Fred', 'en-US'), v('Daniel', 'en-GB'), v('Samantha', 'en-US'), v('Ava (Premium)', 'en-US'), v('Amélie', 'fr-CA')];
    expect(rankVoices(voices, 'en-US').map((x) => x.name)).toEqual(['Ava (Premium)', 'Samantha', 'Daniel']);
    expect(rankVoices(voices, 'en-GB')[0]!.name).toBe('Daniel');
  });

  it('recognizes neural voice names', () => {
    expect(inferQuality('Microsoft Aria Online (Natural) - English (United States)')).toBe('neural');
  });
});

class FakeProvider implements SpeechProvider {
  calls: SpeakRequest[] = [];
  label = 'fake';
  constructor(readonly id: string, private behavior: 'ok' | 'fail' | 'unavailable' | 'hang') {}
  async canSpeak() {
    return this.behavior !== 'unavailable';
  }
  async speak(req: SpeakRequest & { onStart?: () => void }) {
    this.calls.push(req);
    if (this.behavior === 'fail') throw new Error('boom');
    req.onStart?.();
    if (this.behavior === 'hang') {
      await new Promise((_, reject) => req.signal?.addEventListener('abort', () => reject(abortError())));
    }
  }
  stop() {}
  async voices() {
    return [];
  }
}

describe('speech service', () => {
  const opts = { accent: 'en-US' as const, rate: 'normal' as const };

  it('falls back to the next provider when one fails or is unavailable', async () => {
    const a = new FakeProvider('a', 'unavailable');
    const b = new FakeProvider('b', 'fail');
    const c = new FakeProvider('c', 'ok');
    const played: string[] = [];
    const s = new SpeechService([a, b, c], { onPlayed: (i) => played.push(i.provider) });
    expect(await s.speak('Hello', opts)).toBe('done');
    expect(a.calls).toHaveLength(0);
    expect(b.calls).toHaveLength(1);
    expect(played).toEqual(['c']);
  });

  it('reports failure without throwing when nothing can speak', async () => {
    const s = new SpeechService([new FakeProvider('a', 'fail')]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await s.speak('Hello', opts)).toBe('failed');
    expect(s.getState().status).toBe('idle');
  });

  it('a new request stops the previous one; no overlapping audio', async () => {
    const p = new FakeProvider('p', 'hang');
    const s = new SpeechService([p]);
    const first = s.speak('First sentence.', { ...opts, key: 'one' });
    await vi.waitFor(() => expect(s.getState()).toMatchObject({ status: 'playing', key: 'one' }));
    const second = s.speak('Second sentence.', { ...opts, key: 'two' });
    expect(await first).toBe('stopped');
    await vi.waitFor(() => expect(s.getState()).toMatchObject({ status: 'playing', key: 'two' }));
    s.stop();
    expect(await second).toBe('stopped');
    expect(s.getState().status).toBe('idle');
  });

  it('tells other players to pause on every stop and before every new sound', async () => {
    const s = new SpeechService([new FakeProvider('p', 'ok')]);
    const paused = vi.fn();
    const off = s.onStop(paused);
    s.stop();
    expect(paused).toHaveBeenCalledTimes(1);
    await s.speak('Hello', opts);
    expect(paused).toHaveBeenCalledTimes(2);
    off();
    s.stop();
    expect(paused).toHaveBeenCalledTimes(2);
  });

  it('dialogue lines use speaker A and B', async () => {
    const p = new FakeProvider('p', 'ok');
    const s = new SpeechService([p]);
    await s.speakDialogue([{ speaker: 'A', text: 'Hi, are you ready for the test?' }, { speaker: 'B', text: 'Not really.' }], opts);
    expect(p.calls.map((c) => c.speaker)).toEqual(['A', 'B']);
  });
});

class FakePlayback implements AudioPlayback {
  played: (Blob | string)[] = [];
  rates: number[] = [];
  async play(src: Blob | string, _signal?: AbortSignal, rate = 1) {
    this.played.push(src);
    this.rates.push(rate);
  }
  stop() {}
}

describe('home server provider', () => {
  it('generates once, then plays from the local cache', async () => {
    const fetchFn = vi.fn(async () => new Response(new Blob(['mp3'], { type: 'audio/mpeg' })));
    const db = new TutorDB(`tts-${Math.random()}`);
    const playback = new FakePlayback();
    const p = new RemoteTtsProvider(() => ({ baseUrl: 'http://home.local:8880' }), playback, new DexieAudioCache(db), fetchFn as typeof fetch);
    const req = { text: 'Have you ever been to London?', accent: 'en-GB' as const, rate: 'slow' as const };
    await p.speak(req);
    await p.speak(req);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ voice: 'bf_emma', speed: 0.8, input: 'Have you ever been to London?' });
    expect(playback.played).toHaveLength(2);
  });

  it('is unavailable without a configured URL and after a failure', async () => {
    const db = new TutorDB(`tts-${Math.random()}`);
    expect(await new RemoteTtsProvider(() => ({ baseUrl: '' }), new FakePlayback(), new DexieAudioCache(db)).canSpeak()).toBe(false);
    const failing = new RemoteTtsProvider(() => ({ baseUrl: 'http://x' }), new FakePlayback(), new DexieAudioCache(db), (async () => new Response('', { status: 500 })) as typeof fetch);
    await expect(failing.speak({ text: 'Hi', accent: 'en-US', rate: 'normal' })).rejects.toThrow();
    expect(await failing.canSpeak()).toBe(false);
  });
});

describe('audio cache', () => {
  it('evicts least recently used entries over the size cap', async () => {
    const db = new TutorDB(`cache-${Math.random()}`);
    let t = 0;
    const cache = new DexieAudioCache(db, 10, () => ++t);
    const meta = { provider: 'p', voiceId: 'v', text: 't' };
    await cache.put('a', new Blob(['1234']), meta);
    await cache.put('b', new Blob(['1234']), meta);
    await cache.get('a');
    await cache.put('c', new Blob(['1234']), meta);
    expect(await cache.get('b')).toBeUndefined();
    expect(await cache.get('a')).toBeDefined();
  });
});

describe('pre-rendered provider', () => {
  it('plays only texts that exist in the manifest', async () => {
    const manifest = { version: 1, engine: 'kokoro', entries: { [audioKey('af_heart', 'normal', 'beautiful')]: 'audio/x.mp3' } };
    const fetched: string[] = [];
    const fetchFn = (async (u: string) => {
      fetched.push(u);
      return u.endsWith('.json') ? new Response(JSON.stringify(manifest)) : new Response(new Blob([u]));
    }) as unknown as typeof fetch;
    const playback = new FakePlayback();
    const p = new PrerenderedProvider(playback, 'audio/manifest.json', fetchFn);
    expect(await p.canSpeak({ text: 'beautiful', accent: 'en-US', rate: 'normal' })).toBe(true);
    expect(await p.canSpeak({ text: 'beautiful', accent: 'en-GB', rate: 'normal' })).toBe(false);
    await p.speak({ text: 'beautiful', accent: 'en-US', rate: 'normal' });
    expect(fetched).toContain('audio/x.mp3');
    expect(playback.played).toHaveLength(1);
    expect(await (playback.played[0] as Blob).text()).toBe('audio/x.mp3');
  });

  it('plays a long text sentence by sentence when every sentence is pre-rendered', async () => {
    const a = 'The ground was dry.';
    const b = 'The students did not give up.';
    const manifest = { version: 1, engine: 'kokoro', entries: { [audioKey('af_heart', 'normal', a)]: 'audio/a.mp3', [audioKey('af_heart', 'normal', b)]: 'audio/b.mp3' } };
    const playback = new FakePlayback();
    const fetchFn = (async (u: string) => (u === 'm' ? new Response(JSON.stringify(manifest)) : new Response(new Blob([u])))) as unknown as typeof fetch;
    const p = new PrerenderedProvider(playback, 'm', fetchFn);
    await p.speak({ text: `${a} ${b}`, accent: 'en-US', rate: 'normal' });
    expect(await Promise.all(playback.played.map((x) => (x as Blob).text()))).toEqual(['audio/a.mp3', 'audio/b.mp3']);
    expect(await p.canSpeak({ text: `${a} Something else.`, accent: 'en-US', rate: 'normal' })).toBe(false);
  });

  it('very slow plays the slow recording a little slower, pitch kept by the player', async () => {
    const manifest = { version: 1, engine: 'k', entries: { [audioKey('af_heart', 'slow', 'beautiful')]: 'audio/slow.mp3' } };
    const fetchFn = (async (u: string) => (u === 'm' ? new Response(JSON.stringify(manifest)) : new Response(new Blob([u])))) as unknown as typeof fetch;
    const playback = new FakePlayback();
    const p = new PrerenderedProvider(playback, 'm', fetchFn);
    await p.speak({ text: 'beautiful', accent: 'en-US', rate: 'slower' });
    expect(await (playback.played[0] as Blob).text()).toBe('audio/slow.mp3');
    expect(playback.rates).toEqual([0.8]);
  });

  it('downloads every file for offline use', async () => {
    const manifest = { version: 1, engine: 'k', entries: { a: 'audio/1.mp3', b: 'audio/2.mp3', c: 'audio/2.mp3' } };
    const fetchFn = (async (u: string) => (u === 'm' ? new Response(JSON.stringify(manifest)) : u.endsWith('2.mp3') ? new Response('', { status: 404 }) : new Response('x'))) as unknown as typeof fetch;
    const p = new PrerenderedProvider(new FakePlayback(), 'm', fetchFn);
    const progress: number[] = [];
    const r = await p.downloadAll((d) => progress.push(d));
    expect(r).toEqual({ done: 2, failed: 1 });
    expect(progress).toEqual([1, 2]);
  });

  it('degrades gracefully when there is no manifest', async () => {
    const p = new PrerenderedProvider(new FakePlayback(), 'audio/manifest.json', (async () => new Response('', { status: 404 })) as typeof fetch);
    expect(await p.canSpeak({ text: 'x', accent: 'en-US', rate: 'normal' })).toBe(false);
  });
});
