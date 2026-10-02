import type { CefrLevel } from '../skills/cefr';
import type { Domain, SkillId } from '../skills/taxonomy';

/**
 * Israeli curriculum adapter.
 *
 * This is a mapping layer on top of the CEFR-based core. Nothing in the
 * learning engine depends on it. It answers questions such as
 * "what level does a 4-unit student need in reading?" and later will hold
 * bagrut task types and official word lists.
 *
 * STATUS: approximate. The targets below follow the general CEFR alignment of
 * the Ministry of Education curriculum (Foundation, Intermediate, Proficiency
 * bands). They are NOT verified against current official documents.
 * Verify before using them for exam preparation decisions.
 */
export type BagrutTrack = 'units-3' | 'units-4' | 'units-5';

export interface TrackDefinition {
  id: BagrutTrack;
  name: { he: string; en: string };
  /** Expected end-of-high-school level per domain. */
  targets: Partial<Record<Domain, CefrLevel>>;
  /** Skills that carry extra weight for this track. */
  emphasis: SkillId[];
  verified: false;
}

export const TRACKS: Record<BagrutTrack, TrackDefinition> = {
  'units-3': {
    id: 'units-3',
    name: { he: '3 יחידות', en: '3 units' },
    targets: { vocabulary: 'A2', grammar: 'A2', reading: 'B1', writing: 'A2', listening: 'A2', speaking: 'A2' },
    emphasis: ['reading.details', 'reading.main-idea', 'vocabulary.meaning'],
    verified: false,
  },
  'units-4': {
    id: 'units-4',
    name: { he: '4 יחידות', en: '4 units' },
    targets: { vocabulary: 'B1', grammar: 'B1', reading: 'B1', writing: 'B1', listening: 'B1', speaking: 'B1' },
    emphasis: ['reading.inference', 'vocabulary.context', 'writing.paragraph'],
    verified: false,
  },
  'units-5': {
    id: 'units-5',
    name: { he: '5 יחידות', en: '5 units' },
    targets: { vocabulary: 'B2', grammar: 'B2', reading: 'B2', writing: 'B2', listening: 'B2', speaking: 'B1' },
    emphasis: ['reading.inference', 'writing.opinion', 'grammar.connectors', 'vocabulary.collocations'],
    verified: false,
  },
};

export function trackTarget(track: BagrutTrack, domain: Domain): CefrLevel | undefined {
  return TRACKS[track].targets[domain];
}
