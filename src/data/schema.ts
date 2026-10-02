import Dexie, { type Table } from 'dexie';
import type { Student } from '@/domain/student/student';
import { DEFAULT_PREFERENCES } from '@/domain/student/student';
import type { LearningEvent } from '@/domain/learning/events';
import type { DailyStat, SkillState, UnitMemory } from '@/domain/learning/projection';
import type { MistakePattern } from '@/domain/learning/memory';

/**
 * IndexedDB schema.
 *
 * RULES FOR CHANGING THE SCHEMA
 * 1. Never edit an existing version entry. Append a new one.
 * 2. Put data transformations in that version's `upgrade`.
 * 3. Add a migration test in db.test.ts that opens the previous version with
 *    data, upgrades, and checks nothing was lost.
 * 4. The events table is append-only. Never delete or rewrite events.
 */

export interface SkillStateRow extends SkillState {
  studentId: string;
}
export interface UnitMemoryRow extends UnitMemory {
  studentId: string;
  /** Mirror of card.due for indexing. */
  due: number;
}
export interface MistakePatternRow extends MistakePattern {
  studentId: string;
}
export interface DailyStatRow extends DailyStat {
  studentId: string;
}
export interface SessionRow {
  id: string;
  studentId: string;
  mode: string;
  domain?: string;
  startedAt: number;
  endedAt?: number;
  completed: number;
}
export interface MetaRow {
  key: string;
  value: unknown;
}
export interface TtsCacheRow {
  key: string;
  provider: string;
  voiceId: string;
  text: string;
  blob: Blob;
  createdAt: number;
  lastUsedAt: number;
  bytes: number;
}

export type VersionDef = {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: import('dexie').Transaction) => Promise<void> | void;
};

export const VERSIONS: VersionDef[] = [
  {
    version: 1,
    stores: {
      students: 'id, archived',
      events: 'id, studentId, [studentId+at], [studentId+type]',
      skillStates: '[studentId+skillId], studentId',
      unitMemories: '[studentId+unit], studentId, [studentId+due]',
      mistakePatterns: '[studentId+misconceptionId], studentId',
      dailyStats: '[studentId+day], studentId',
      sessions: 'id, studentId, [studentId+startedAt]',
      meta: 'key',
    },
  },
  {
    // v2: local audio cache for generated speech; backfill student preferences.
    version: 2,
    stores: {
      ttsCache: 'key, lastUsedAt',
    },
    upgrade: async (tx) => {
      await tx
        .table('students')
        .toCollection()
        .modify((s: Student) => {
          s.preferences = { ...DEFAULT_PREFERENCES, ...(s.preferences ?? {}) };
          s.interests = s.interests ?? [];
        });
    },
  },
];

export class TutorDB extends Dexie {
  students!: Table<Student, string>;
  events!: Table<LearningEvent, string>;
  skillStates!: Table<SkillStateRow, [string, string]>;
  unitMemories!: Table<UnitMemoryRow, [string, string]>;
  mistakePatterns!: Table<MistakePatternRow, [string, string]>;
  dailyStats!: Table<DailyStatRow, [string, string]>;
  sessions!: Table<SessionRow, string>;
  meta!: Table<MetaRow, string>;
  ttsCache!: Table<TtsCacheRow, string>;

  constructor(name = 'smart-english-tutor', upTo = VERSIONS.length) {
    super(name);
    for (const v of VERSIONS.slice(0, upTo)) {
      const def = this.version(v.version).stores(v.stores);
      if (v.upgrade) def.upgrade(v.upgrade);
    }
  }
}

export const LATEST_VERSION = VERSIONS[VERSIONS.length - 1]!.version;
