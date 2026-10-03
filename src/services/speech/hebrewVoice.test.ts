import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioKey } from './audioKey';
import { HEBREW_FALLBACK_VOICE, HEBREW_VOICE, setHebrewPlayback, speakHebrew } from './hebrewVoice';
import { abortError } from './types';

const key = audioKey(HEBREW_VOICE, 'normal', 'כל הכבוד!');

function stubFetch() {
  const f = vi.fn(async (url: string) =>
    url.endsWith('manifest.json') ? new Response(JSON.stringify({ entries: { [key]: 'audio/he/x.mp3' } })) : new Response('mp3'),
  );
  vi.stubGlobal('fetch', f);
  return f;
}

describe('speakHebrew', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('plays the natural recording when there is one', async () => {
    stubFetch();
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    const play = vi.fn(async () => {});
    setHebrewPlayback({ play, stop: vi.fn() });
    await speakHebrew('כל הכבוד!');
    expect(play).toHaveBeenCalledTimes(1);
    expect(speak).not.toHaveBeenCalled();
  });

  it('plays the older recording when the new voice has none', async () => {
    const old = audioKey(HEBREW_FALLBACK_VOICE, 'normal', 'נסו שוב');
    const f = vi.fn(async (url: string) =>
      url.endsWith('manifest.json') ? new Response(JSON.stringify({ entries: { [key]: 'audio/he/x.mp3', [old]: 'audio/he/old.mp3' } })) : new Response('mp3'),
    );
    vi.stubGlobal('fetch', f);
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    const play = vi.fn(async () => {});
    // A fresh module: the manifest is cached per page load.
    vi.resetModules();
    const fresh = await import('./hebrewVoice');
    fresh.setHebrewPlayback({ play, stop: vi.fn() });
    await fresh.speakHebrew('נסו שוב');
    expect(f).toHaveBeenCalledWith('audio/he/old.mp3', expect.anything());
    expect(play).toHaveBeenCalledTimes(1);
    expect(speak).not.toHaveBeenCalled();
  });

  it('stays quiet when another sound takes over', async () => {
    stubFetch();
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    setHebrewPlayback({ play: vi.fn(async () => Promise.reject(abortError())), stop: vi.fn() });
    await speakHebrew('כל הכבוד!');
    expect(speak).not.toHaveBeenCalled();
  });
});
