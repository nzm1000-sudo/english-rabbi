import {
  applyDrift,
  confidence,
  expectedSuccess,
  priorAbility,
  updateAbility,
  type Observation,
} from './ability';

const obs = (o: Partial<Observation>): Observation => ({ b: 0, c: 0, score: 1, weight: 1, at: 1_000, ...o });

describe('ability model', () => {
  it('moves up on success and down on failure', () => {
    const p = priorAbility(0);
    expect(updateAbility(p, obs({ score: 1 })).mu).toBeGreaterThan(0);
    expect(updateAbility(p, obs({ score: 0 })).mu).toBeLessThan(0);
  });

  it('reduces uncertainty with evidence', () => {
    let s = priorAbility(0);
    for (let i = 0; i < 10; i++) s = updateAbility(s, obs({ score: i % 2, at: 1000 + i }));
    expect(s.variance).toBeLessThan(priorAbility().variance);
    expect(confidence(s)).toBeGreaterThan(0.3);
  });

  it('a hard item solved counts more than an easy item solved', () => {
    const p = priorAbility(0);
    const hard = updateAbility(p, obs({ b: 1.5 }));
    const easy = updateAbility(p, obs({ b: -1.5 }));
    expect(hard.mu - p.mu).toBeGreaterThan(easy.mu - p.mu);
  });

  it('a correct answer on a 2-option item counts less than on a typed item', () => {
    const p = priorAbility(0);
    const guessable = updateAbility(p, obs({ c: 0.5 }));
    const typed = updateAbility(p, obs({ c: 0 }));
    expect(typed.mu - p.mu).toBeGreaterThan(guessable.mu - p.mu);
  });

  it('a low-weight observation moves the estimate less', () => {
    const p = priorAbility(0);
    expect(updateAbility(p, obs({ weight: 0.3 })).mu).toBeLessThan(updateAbility(p, obs({ weight: 1 })).mu);
  });

  it('converges near the true ability with consistent evidence', () => {
    // Simulated learner with true theta = 1 answering items of varied difficulty.
    let s = priorAbility(-0.5);
    const trueTheta = 1;
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 400; i++) {
      const b = -2 + 4 * rand();
      const correct = rand() < 1 / (1 + Math.exp(-(trueTheta - b))) ? 1 : 0;
      s = updateAbility(s, obs({ b, score: correct, at: 1000 + i }));
    }
    expect(Math.abs(s.mu - trueTheta)).toBeLessThan(0.4);
  });

  it('uncertainty grows after a long break, but never above the prior', () => {
    let s = priorAbility(0);
    for (let i = 0; i < 20; i++) s = updateAbility(s, obs({ at: 1000 + i }));
    const later = applyDrift(s, 1000 + 120 * 86_400_000);
    expect(later.variance).toBeGreaterThan(s.variance);
    expect(later.variance).toBeLessThanOrEqual(priorAbility().variance);
    expect(later.mu).toBe(s.mu);
  });

  it('expected success is pulled toward 50% when uncertain', () => {
    const sure = { mu: 2, variance: 0.05 };
    const unsure = { mu: 2, variance: 2.25 };
    expect(expectedSuccess(sure, 0)).toBeGreaterThan(expectedSuccess(unsure, 0));
  });

  it('never produces NaN on extreme inputs', () => {
    let s = priorAbility(0);
    for (let i = 0; i < 200; i++) s = updateAbility(s, obs({ b: -10, score: 1, c: 0.9, at: 1000 + i }));
    expect(Number.isFinite(s.mu)).toBe(true);
    expect(Number.isFinite(s.variance)).toBe(true);
  });
});
