import { buildTutorContext, tutorSystemPrompt } from './tutorContext';
import { buildLearnerProfile } from '@/domain/student/profile';
import { createStudent } from '@/domain/student/student';
import { NoAIProvider } from './types';

describe('AI layer', () => {
  const student = createStudent({ name: 'נועה כהן', birthYear: 2012, interests: ['music'] }, 'secret-id', 0);
  const profile = buildLearnerProfile(student, { skills: new Map(), units: new Map(), patterns: new Map() }, [], () => undefined, 0, '2026-01-01');

  it('tutor context contains only what teaching needs', () => {
    const ctx = buildTutorContext(profile);
    const json = JSON.stringify(ctx);
    expect(ctx.firstName).toBe('נועה');
    expect(json).not.toContain('secret-id');
    expect(json).not.toContain('2012');
    expect(json).not.toContain('כהן');
  });

  it('system prompt encodes the hint-first teaching policy', () => {
    expect(tutorSystemPrompt(buildTutorContext(profile))).toMatch(/hint first/);
  });

  it('the default provider is off and core learning does not need it', async () => {
    const p = new NoAIProvider();
    expect(await p.isAvailable()).toBe(false);
    await expect(p.complete()).rejects.toThrow();
  });
});
