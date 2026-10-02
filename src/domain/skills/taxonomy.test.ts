import { DOMAINS, SKILLS, getSkill, lineage, parentOf } from './taxonomy';
import { CEFR_LEVELS, itemTheta, levelCenter, thetaToLevel } from './cefr';

describe('skill taxonomy', () => {
  it('has unique ids', () => {
    const ids = SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every non-domain skill has an existing parent', () => {
    for (const s of SKILLS) {
      const p = parentOf(s.id);
      if (p) expect(getSkill(p), `parent of ${s.id}`).toBeDefined();
    }
  });

  it('every prerequisite exists and no skill requires itself', () => {
    for (const s of SKILLS) {
      for (const pre of s.prerequisites ?? []) {
        expect(getSkill(pre), `${s.id} -> ${pre}`).toBeDefined();
        expect(pre).not.toBe(s.id);
      }
    }
  });

  it('has a root node for every domain', () => {
    for (const d of DOMAINS) expect(getSkill(d)).toBeDefined();
  });

  it('lineage goes from leaf to domain', () => {
    expect(lineage('grammar.past-simple.irregular')).toEqual([
      'grammar.past-simple.irregular',
      'grammar.past-simple',
      'grammar',
    ]);
  });
});

describe('CEFR scale', () => {
  it('round-trips level centers', () => {
    for (const l of CEFR_LEVELS) expect(thetaToLevel(levelCenter(l))).toBe(l);
  });

  it('maps within-level difficulty to the band', () => {
    expect(itemTheta('B1', 0.5)).toBe(0);
    expect(thetaToLevel(itemTheta('A2', 0))).toBe('A2');
    expect(thetaToLevel(itemTheta('A2', 0.99))).toBe('A2');
  });

  it('clamps extreme thetas', () => {
    expect(thetaToLevel(-10)).toBe('PreA1');
    expect(thetaToLevel(10)).toBe('C2');
  });
});
