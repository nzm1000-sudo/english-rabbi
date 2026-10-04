import { describe, expect, it } from 'vitest';
import { explainLevel } from './ExplainCard';

describe('explainLevel', () => {
  const now = new Date(2026, 9, 4).getTime();
  it('gives the simple version up to 12 and when the age is unknown', () => {
    expect(explainLevel({ birthYear: 2014 }, now)).toBe('kids');
    expect(explainLevel({ birthYear: 2013 }, now)).toBe('adult');
    expect(explainLevel({}, now)).toBe('kids');
    expect(explainLevel(null, now)).toBe('kids');
  });
});
