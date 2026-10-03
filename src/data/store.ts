import { createStudent, type NewStudentInput, type Student } from '@/domain/student/student';
import { localDay, newEventId, type EventMap, type EventType, type ItemOutcome, type LearningEvent } from '@/domain/learning/events';
import {
  affectedMisconceptions,
  affectedSkills,
  projectCompletion,
  replay,
  type CompletionResult,
  type DailyStat,
  type SkillState,
  type UnitMemory,
} from '@/domain/learning/projection';
import type { MistakePattern } from '@/domain/learning/memory';
import { snapshotItem } from '@/domain/learning/selector';
import type { ContentItem } from '@/domain/content/schema';
import { TutorDB, LATEST_VERSION, type SavedWordRow, type SessionRow } from './schema';

export interface LearnerState {
  skills: Map<string, SkillState>;
  units: Map<string, UnitMemory>;
  patterns: Map<string, MistakePattern>;
}

const DERIVED_TABLES = ['skillStates', 'unitMemories', 'mistakePatterns', 'dailyStats'] as const;

/**
 * A session never ended (the app was killed or crashed) counts at most this
 * long past its last activity (its start or its latest event); otherwise it
 * would count every minute until midnight toward the daily limit.
 */
export const OPEN_SESSION_CAP_MS = 20 * 60 * 1000;
/** How far before midnight a session may start and still reach into today. */
const SESSION_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/**
 * The only module that writes learner data. All writes for one answer happen
 * in a single IndexedDB transaction: the raw event and every derived record
 * are saved together or not at all.
 */
export class LearningStore {
  constructor(readonly db: TutorDB, private readonly clock: () => number = Date.now) {}

  // Students -----------------------------------------------------------------

  async createStudent(input: NewStudentInput): Promise<Student> {
    const now = this.clock();
    const student = createStudent(input, crypto.randomUUID(), now);
    await this.db.transaction('rw', this.db.students, this.db.events, async () => {
      await this.db.students.add(student);
      await this.db.events.add(this.event(student.id, 'student.created', { name: student.name }, now));
    });
    return student;
  }

  async updateStudent(id: string, patch: Partial<Omit<Student, 'id' | 'createdAt'>>): Promise<Student> {
    const now = this.clock();
    return this.db.transaction('rw', this.db.students, this.db.events, async () => {
      const cur = await this.db.students.get(id);
      if (!cur) throw new Error(`student ${id} not found`);
      const next: Student = { ...cur, ...patch, id: cur.id, createdAt: cur.createdAt, updatedAt: now };
      await this.db.students.put(next);
      await this.db.events.add(this.event(id, 'student.updated', { fields: Object.keys(patch) }, now));
      return next;
    });
  }

  /** Hides the student. Learning history is kept. */
  async archiveStudent(id: string): Promise<void> {
    await this.updateStudent(id, { archived: true });
  }

  async listStudents(includeArchived = false): Promise<Student[]> {
    const all = await this.db.students.toArray();
    return all.filter((s) => includeArchived || !s.archived).sort((a, b) => a.createdAt - b.createdAt);
  }

  getStudent(id: string): Promise<Student | undefined> {
    return this.db.students.get(id);
  }

  // Events -------------------------------------------------------------------

  async log<T extends EventType>(studentId: string, type: T, payload: EventMap[T], sessionId?: string): Promise<void> {
    await this.db.events.add(this.event(studentId, type, payload, this.clock(), sessionId));
  }

  async startSession(studentId: string, mode: string, domain?: string): Promise<SessionRow> {
    const now = this.clock();
    const row: SessionRow = { id: crypto.randomUUID(), studentId, mode, startedAt: now, completed: 0, ...(domain ? { domain } : {}) };
    await this.db.transaction('rw', this.db.sessions, this.db.events, async () => {
      await this.db.sessions.add(row);
      await this.db.events.add(this.event(studentId, 'session.started', { mode, ...(domain ? { domain } : {}) }, now, row.id));
    });
    return row;
  }

  async endSession(sessionId: string, reason: 'finished' | 'left'): Promise<void> {
    const now = this.clock();
    await this.db.transaction('rw', this.db.sessions, this.db.events, async () => {
      const s = await this.db.sessions.get(sessionId);
      if (!s || s.endedAt) return;
      await this.db.sessions.update(sessionId, { endedAt: now });
      await this.db.events.add(
        this.event(s.studentId, 'session.ended', { completed: s.completed, durationMs: now - s.startedAt, reason }, now, sessionId),
      );
    });
  }

  /**
   * Records a finished item and updates every derived record atomically.
   */
  async completeItem(args: {
    studentId: string;
    sessionId?: string;
    item: ContentItem;
    outcome: ItemOutcome;
    predicted?: number;
  }): Promise<CompletionResult> {
    const at = this.clock();
    const event = this.event(
      args.studentId,
      'item.completed',
      {
        item: snapshotItem(args.item),
        outcome: args.outcome,
        day: localDay(at),
        ...(args.predicted !== undefined ? { predicted: args.predicted } : {}),
      },
      at,
      args.sessionId,
    ) as LearningEvent<'item.completed'>;
    return this.applyCompletion(event);
  }

  private async applyCompletion(event: LearningEvent<'item.completed'>): Promise<CompletionResult> {
    const { db } = this;
    const sid = event.studentId;
    const p = event.payload;
    return db.transaction(
      'rw',
      [db.events, db.skillStates, db.unitMemories, db.mistakePatterns, db.dailyStats, db.sessions],
      async () => {
        const skillIds = [...affectedSkills(p).keys()];
        const { mistakes, repaired } = affectedMisconceptions(p);
        const mids = [...mistakes, ...repaired];

        const skillRows = await db.skillStates.bulkGet(skillIds.map((id) => [sid, id] as [string, string]));
        const unitRow = await db.unitMemories.get([sid, p.item.unit]);
        const patternRows = await db.mistakePatterns.bulkGet(mids.map((m) => [sid, m] as [string, string]));
        const dailyRow = await db.dailyStats.get([sid, p.day]);

        const result = projectCompletion({
          event,
          skills: Object.fromEntries(skillIds.map((id, i) => [id, strip(skillRows[i])])),
          unit: strip(unitRow),
          patterns: Object.fromEntries(mids.map((m, i) => [m, strip(patternRows[i])])),
          daily: strip(dailyRow),
        });

        await db.events.add(event);
        await db.skillStates.bulkPut(result.skills.map((s) => ({ ...s, studentId: sid })));
        await db.unitMemories.put({ ...result.unit, studentId: sid, due: result.unit.card.due });
        if (result.patterns.length) await db.mistakePatterns.bulkPut(result.patterns.map((x) => ({ ...x, studentId: sid })));
        await db.dailyStats.put({ ...result.daily, studentId: sid });
        if (event.sessionId && !event.payload.outcome.skipped) {
          await db.sessions.where('id').equals(event.sessionId).modify((s) => {
            s.completed += 1;
          });
        }
        return result;
      },
    );
  }

  // My words -----------------------------------------------------------------

  /** Saves a word from a story. Saving it again keeps the first example. */
  async saveWord(studentId: string, w: Omit<SavedWordRow, 'studentId' | 'addedAt'>): Promise<void> {
    const now = this.clock();
    const lemma = w.lemma.trim();
    await this.db.transaction('rw', this.db.savedWords, this.db.events, async () => {
      if (await this.db.savedWords.get([studentId, lemma])) return;
      await this.db.savedWords.put({ ...w, lemma, studentId, addedAt: now });
      await this.db.events.add(this.event(studentId, 'word.saved', { lemma, ...(w.storyId ? { storyId: w.storyId } : {}) }, now));
    });
  }

  async removeWord(studentId: string, lemma: string): Promise<void> {
    const now = this.clock();
    await this.db.transaction('rw', this.db.savedWords, this.db.events, async () => {
      await this.db.savedWords.delete([studentId, lemma]);
      await this.db.events.add(this.event(studentId, 'word.removed', { lemma }, now));
    });
  }

  async savedWords(studentId: string): Promise<SavedWordRow[]> {
    const rows = await this.db.savedWords.where('studentId').equals(studentId).toArray();
    return rows.sort((a, b) => b.addedAt - a.addedAt);
  }

  /** Sticker ids earned, oldest first. */
  async stickersEarned(studentId: string): Promise<string[]> {
    const evs = (await this.db.events.where('[studentId+type]').equals([studentId, 'sticker.earned']).toArray()) as LearningEvent<'sticker.earned'>[];
    return [...new Set(evs.sort((a, b) => a.at - b.at).map((e) => e.payload.stickerId))];
  }

  /** Whether a sticker was already earned from this source (e.g. one book). */
  async stickerEarnedFrom(studentId: string, source: string): Promise<boolean> {
    const evs = (await this.db.events.where('[studentId+type]').equals([studentId, 'sticker.earned']).toArray()) as LearningEvent<'sticker.earned'>[];
    return evs.some((e) => e.payload.source === source);
  }

  /**
   * Minutes spent today in sessions whose mode starts with a prefix (e.g.
   * "kids"). Only the part after midnight counts, also of a session that
   * started before it; an open session counts up to OPEN_SESSION_CAP_MS past
   * its last activity.
   */
  async minutesToday(studentId: string, modePrefix: string, now = this.clock()): Promise<number> {
    const d = new Date(now);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const rows = (
      await this.db.sessions.where('[studentId+startedAt]').between([studentId, start - SESSION_LOOKBACK_MS], [studentId, now + 1]).toArray()
    ).filter((r) => r.mode.startsWith(modePrefix));
    const open = rows.filter((r) => r.endedAt === undefined);
    const lastActive = new Map(open.map((r) => [r.id, r.startedAt]));
    if (open.length) {
      const from = Math.min(...open.map((r) => r.startedAt));
      const evs = await this.db.events.where('[studentId+at]').between([studentId, from], [studentId, now + 1]).toArray();
      for (const e of evs) {
        const at = e.sessionId ? lastActive.get(e.sessionId) : undefined;
        if (at !== undefined && e.at > at) lastActive.set(e.sessionId!, e.at);
      }
    }
    const ms = rows.reduce((sum, r) => {
      const end = Math.min(now, r.endedAt ?? lastActive.get(r.id)! + OPEN_SESSION_CAP_MS);
      return sum + Math.max(0, end - Math.max(r.startedAt, start));
    }, 0);
    return Math.round(ms / 60000);
  }

  /** Story id -> best result, from story.completed events. */
  async storyResults(studentId: string): Promise<Map<string, { correct: number; total: number }>> {
    const evs = await this.db.events.where('[studentId+type]').equals([studentId, 'story.completed']).toArray();
    const out = new Map<string, { correct: number; total: number }>();
    for (const e of evs as LearningEvent<'story.completed'>[]) {
      const prev = out.get(e.payload.storyId);
      if (!prev || e.payload.correct > prev.correct) out.set(e.payload.storyId, { correct: e.payload.correct, total: e.payload.total });
    }
    return out;
  }

  // Reads --------------------------------------------------------------------

  async loadLearnerState(studentId: string): Promise<LearnerState> {
    const [skills, units, patterns] = await Promise.all([
      this.db.skillStates.where('studentId').equals(studentId).toArray(),
      this.db.unitMemories.where('studentId').equals(studentId).toArray(),
      this.db.mistakePatterns.where('studentId').equals(studentId).toArray(),
    ]);
    return {
      skills: new Map(skills.map((s) => [s.skillId, strip(s)!])),
      units: new Map(units.map((u) => [u.unit, strip(u)!])),
      patterns: new Map(patterns.map((p) => [p.misconceptionId, strip(p)!])),
    };
  }

  async dailyStats(studentId: string): Promise<DailyStat[]> {
    const rows = await this.db.dailyStats.where('studentId').equals(studentId).toArray();
    return rows.map((r) => strip(r)!).sort((a, b) => (a.day < b.day ? -1 : 1));
  }

  async eventsFor(studentId: string): Promise<LearningEvent[]> {
    return this.db.events.where('studentId').equals(studentId).sortBy('id');
  }

  async dueCount(studentId: string, now = this.clock()): Promise<number> {
    return this.db.unitMemories.where('[studentId+due]').between([studentId, 0], [studentId, now], true, true).count();
  }

  // Maintenance --------------------------------------------------------------

  /**
   * Rebuilds all derived state for a student from the event log. Safe to run
   * at any time; used after model improvements and to verify consistency.
   */
  async rebuildDerived(studentId: string): Promise<void> {
    const { db } = this;
    await db.transaction('rw', [db.events, ...DERIVED_TABLES.map((t) => db.table(t))], async () => {
      const events = await db.events.where('studentId').equals(studentId).sortBy('id');
      const state = replay(events);
      for (const t of DERIVED_TABLES) await db.table(t).where('studentId').equals(studentId).delete();
      await db.skillStates.bulkPut([...state.skills.values()].map((s) => ({ ...s, studentId })));
      await db.unitMemories.bulkPut([...state.units.values()].map((u) => ({ ...u, studentId, due: u.card.due })));
      await db.mistakePatterns.bulkPut([...state.patterns.values()].map((p) => ({ ...p, studentId })));
      await db.dailyStats.bulkPut([...state.daily.values()].map((d) => ({ ...d, studentId })));
    });
  }

  /** Full JSON backup of all tables except the audio cache. */
  async exportBackup(): Promise<BackupFile> {
    const { db } = this;
    return {
      format: 'smart-english-tutor-backup',
      schemaVersion: LATEST_VERSION,
      exportedAt: this.clock(),
      students: await db.students.toArray(),
      events: await db.events.toArray(),
      sessions: await db.sessions.toArray(),
      savedWords: await db.savedWords.toArray(),
    };
  }

  /**
   * Restores a backup by merging: students and events are upserted by id
   * (never duplicated), then derived state is rebuilt from the merged event
   * log. Existing events are never removed.
   */
  async importBackup(file: BackupFile): Promise<{ students: number; events: number }> {
    if (file.format !== 'smart-english-tutor-backup') throw new Error('not a backup file');
    if (file.schemaVersion > LATEST_VERSION) throw new Error('backup is from a newer app version');
    const { db } = this;
    if (!Array.isArray(file.students) || !Array.isArray(file.events) || !Array.isArray(file.sessions)) throw new Error('not a backup file');
    await db.transaction('rw', [db.students, db.events, db.sessions, db.savedWords], async () => {
      for (const s of file.students) {
        const cur = await db.students.get(s.id);
        if (!cur || cur.updatedAt <= s.updatedAt) await db.students.put(s);
      }
      await db.events.bulkPut(file.events);
      await db.sessions.bulkPut(file.sessions);
      // Older backups have no saved words; a word saved on this device stays.
      for (const w of file.savedWords ?? []) {
        if (!(await db.savedWords.get([w.studentId, w.lemma]))) await db.savedWords.put(w);
      }
    });
    for (const s of file.students) await this.rebuildDerived(s.id);
    return { students: file.students.length, events: file.events.length };
  }

  private event<T extends EventType>(studentId: string, type: T, payload: EventMap[T], at: number, sessionId?: string): LearningEvent<T> {
    return { id: newEventId(at), studentId, at, type, payload, ...(sessionId ? { sessionId } : {}) };
  }
}

export interface BackupFile {
  format: 'smart-english-tutor-backup';
  schemaVersion: number;
  exportedAt: number;
  students: Student[];
  events: LearningEvent[];
  sessions: SessionRow[];
  /** "My words". Missing in backups made before it was included. */
  savedWords?: SavedWordRow[];
}

/** Removes the storage-only columns so domain code gets clean objects. */
function strip<T extends { studentId?: string; due?: number } | undefined>(row: T): Omit<NonNullable<T>, 'studentId' | 'due'> | undefined {
  if (!row) return undefined;
  const { studentId: _s, due: _d, ...rest } = row as NonNullable<T> & { studentId?: string; due?: number };
  return rest as Omit<NonNullable<T>, 'studentId' | 'due'>;
}
