import type { MistakePattern } from '../learning/memory';
import type { SkillState, UnitMemory } from '../learning/projection';

/** Read-only view of a student's derived learning state. */
export interface LearnerStateView {
  skills: ReadonlyMap<string, SkillState>;
  units: ReadonlyMap<string, UnitMemory>;
  patterns: ReadonlyMap<string, MistakePattern>;
}
