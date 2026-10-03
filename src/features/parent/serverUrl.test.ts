import { normalizeServerUrl } from './serverUrl';

it('adds the scheme a parent leaves out and trims', () => {
  expect(normalizeServerUrl(' 192.168.1.20:8880/ ')).toBe('http://192.168.1.20:8880');
  expect(normalizeServerUrl('https://tts.home')).toBe('https://tts.home');
  expect(normalizeServerUrl('HTTP://x:1')).toBe('HTTP://x:1');
  expect(normalizeServerUrl('   ')).toBe('');
});
