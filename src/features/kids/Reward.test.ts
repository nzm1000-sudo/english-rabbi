import { describe, expect, it } from 'vitest';
import { earnsSticker } from './Reward';

describe('earnsSticker', () => {
  it('needs at least half right on the first try', () => {
    expect(earnsSticker({ correct: 0, total: 6 })).toBe(false);
    expect(earnsSticker({ correct: 2, total: 6 })).toBe(false);
    expect(earnsSticker({ correct: 3, total: 6 })).toBe(true);
    expect(earnsSticker({ correct: 6, total: 6 })).toBe(true);
  });
  it('gives nothing for an empty round', () => {
    expect(earnsSticker({ correct: 0, total: 0 })).toBe(false);
  });
});
