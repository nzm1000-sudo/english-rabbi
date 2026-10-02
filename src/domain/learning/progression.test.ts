import { RANKS, rankFor } from './progression';

describe('ranks', () => {
  it('starts at rank 1', () => {
    expect(rankFor(0, 0, 0).current.level).toBe(1);
  });

  it('points alone do not raise the rank', () => {
    const r = rankFor(1_000_000, 0, 0);
    expect(r.current.level).toBe(1);
    expect(r.missing.join(' ')).toContain('מילים');
  });

  it('needs every requirement of the next rank', () => {
    expect(rankFor(600, 30, 3).current.level).toBe(3);
    expect(rankFor(600, 30, 2).current.level).toBe(2);
  });

  it('progress is limited by the weakest requirement', () => {
    const r = rankFor(1500, 30, 3);
    expect(r.progress).toBe(0);
  });

  it('top rank has no next', () => {
    const top = RANKS[RANKS.length - 1]!;
    expect(rankFor(top.xp, top.words, top.mastered).next).toBeNull();
  });
});
