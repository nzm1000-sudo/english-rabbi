import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioKey } from './audioKey';
import { HEBREW_VOICE, setHebrewPlayback, speakHebrew } from './hebrewVoice';
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

  it('stays quiet when another sound takes over', async () => {
    stubFetch();
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    setHebrewPlayback({ play: vi.fn(async () => Promise.reject(abortError())), stop: vi.fn() });
    await speakHebrew('כל הכבוד!');
    expect(speak).not.toHaveBeenCalled();
  });
});
