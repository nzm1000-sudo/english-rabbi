import { nextStep } from './nextStep';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
const map: Record<string, string[]> = { A1: ['a1x', 'a1y'], A2: ['a2x'], B1: ['b1x', 'b1y'], B2: ['b2x'], C1: [] };
const nodes = (l: string) => map[l]!;

describe('path next step', () => {
  it('is the first unfinished skill at the current level', () => {
    expect(nextStep(LEVELS, 'B1', nodes, () => false)).toBe('b1x');
    expect(nextStep(LEVELS, 'B1', nodes, (s) => s === 'b1x')).toBe('b1y');
  });

  it('moves up when the current level is finished', () => {
    expect(nextStep(LEVELS, 'B1', nodes, (s) => s.startsWith('b1'))).toBe('b2x');
  });

  it('exists for a level with no skills (C1) by going back to the gaps', () => {
    expect(nextStep(LEVELS, 'C1', nodes, (s) => s !== 'a2x')).toBe('a2x');
    expect(nextStep(LEVELS, 'C1', nodes, (s) => s !== 'a1y' && s !== 'b2x')).toBe('b2x');
  });

  it('is empty when everything is done', () => {
    expect(nextStep(LEVELS, 'A2', nodes, () => true)).toBeUndefined();
  });
});
