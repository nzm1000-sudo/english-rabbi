import { AWAY_MS, shouldReturnToPicker, startHash } from './sharedDevice';

describe('shared family device', () => {
  it('always starts on the picker, except for setup links', () => {
    expect(startHash('#/s/abc')).toBe('#/');
    expect(startHash('#/s/abc/practice/lesson')).toBe('#/');
    expect(startHash('#/parent')).toBe('#/');
    expect(startHash('')).toBeNull();
    expect(startHash('#/')).toBeNull();
    expect(startHash('#/setup?d=x')).toBeNull();
  });

  it('returns to the picker only after a long time away', () => {
    expect(shouldReturnToPicker(0, AWAY_MS - 1, '#/s/abc')).toBe(false);
    expect(shouldReturnToPicker(0, AWAY_MS + 1, '#/s/abc')).toBe(true);
    expect(shouldReturnToPicker(0, AWAY_MS + 1, '#/')).toBe(false);
    expect(shouldReturnToPicker(null, AWAY_MS + 1, '#/s/abc')).toBe(false);
  });
});
