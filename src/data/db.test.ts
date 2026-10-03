import Dexie from 'dexie';
import { TutorDB } from './schema';
import { LearningStore } from './store';
import { choiceItem, outcome, typedItem } from '@/domain/learning/testUtils';
import { DEFAULT_PREFERENCES } from '@/domain/student/student';

let n = 0;
function fresh(clockStart = 1_700_000_000_000) {
  const name = `test-db-${++n}`;
  let t = clockStart;
  const clock = () => (t += 1000);
  const db = new TutorDB(name);
  return { db, store: new LearningStore(db, clock), name, advance: (ms: number) => (t += ms) };
}

const wrongMuchMany = outcome({
  finalCorrect: true,
  attempts: [
    { answer: 'b', correct: false, misconception: 'quantifiers.much-many', atMs: 1 },
    { answer: 'a', correct: true, atMs: 2 },
  ],
  hintsUsed: 1,
});

describe('student separation', () => {
  it("one student's practice never changes another student's data", async () => {
    const { store } = fresh();
    const noa = await store.createStudent({ name: 'דנה' });
    const yael = await store.createStudent({ name: 'רון' });

    for (let i = 0; i < 5; i++) {
      await store.completeItem({ studentId: noa.id, item: choiceItem(), outcome: wrongMuchMany });
    }

    const a = await store.loadLearnerState(noa.id);
    const b = await store.loadLearnerState(yael.id);
    expect(a.skills.size).toBeGreaterThan(0);
    expect(a.patterns.get('quantifiers.much-many')?.count).toBe(5);
    expect(b.skills.size).toBe(0);
    expect(b.units.size).toBe(0);
    expect(b.patterns.size).toBe(0);
    expect(await store.dailyStats(yael.id)).toEqual([]);
  });

  it('archiving hides a student but keeps the history', async () => {
    const { store } = fresh();
    const s = await store.createStudent({ name: 'שירה' });
    await store.completeItem({ studentId: s.id, item: choiceItem(), outcome: outcome() });
    await store.archiveStudent(s.id);
    expect(await store.listStudents()).toHaveLength(0);
    expect(await store.listStudents(true)).toHaveLength(1);
    expect((await store.loadLearnerState(s.id)).skills.size).toBeGreaterThan(0);
  });

  it('rejects an empty name', async () => {
    const { store } = fresh();
    await expect(store.createStudent({ name: '   ' })).rejects.toThrow();
  });
});

describe('progress persistence', () => {
  it('progress survives closing and reopening the database', async () => {
    const { db, store, name } = fresh();
    const s = await store.createStudent({ name: 'Test' });
    await store.completeItem({ studentId: s.id, item: typedItem(), outcome: outcome() });
    const before = await store.loadLearnerState(s.id);
    db.close();

    const reopened = new LearningStore(new TutorDB(name));
    const after = await reopened.loadLearnerState(s.id);
    expect(after).toEqual(before);
    expect((await reopened.eventsFor(s.id)).filter((e) => e.type === 'item.completed')).toHaveLength(1);
  });

  it('writes the event and derived state atomically', async () => {
    const { db, store } = fresh();
    const s = await store.createStudent({ name: 'Test' });
    // Force the derived write to fail inside the transaction.
    const orig = db.dailyStats.put.bind(db.dailyStats);
    db.dailyStats.put = (() => Promise.reject(new Error('disk full'))) as unknown as typeof db.dailyStats.put;
    await expect(store.completeItem({ studentId: s.id, item: choiceItem(), outcome: outcome() })).rejects.toThrow('disk full');
    db.dailyStats.put = orig;

    const events = await store.eventsFor(s.id);
    expect(events.some((e) => e.type === 'item.completed')).toBe(false);
    expect((await store.loadLearnerState(s.id)).skills.size).toBe(0);
  });

  it('tracks daily stats and session counts', async () => {
    const { store } = fresh();
    const s = await store.createStudent({ name: 'Test' });
    const session = await store.startSession(s.id, 'practice', 'grammar');
    await store.completeItem({ studentId: s.id, sessionId: session.id, item: choiceItem(), outcome: outcome() });
    await store.completeItem({ studentId: s.id, sessionId: session.id, item: typedItem(), outcome: outcome({ skipped: true, finalCorrect: false }) });
    await store.endSession(session.id, 'finished');
    const days = await store.dailyStats(s.id);
    expect(days).toHaveLength(1);
    expect(days[0]!.itemsCompleted).toBe(1);
    expect((await store.db.sessions.get(session.id))!.completed).toBe(1);
  });
});

describe('event log is the source of truth', () => {
  it('rebuilding derived state from events gives the same state', async () => {
    const { store, advance } = fresh();
    const s = await store.createStudent({ name: 'Test' });
    const items = [choiceItem(), typedItem(), choiceItem({ id: 'c2', unit: 'word:x', skill: 'vocabulary.meaning' })];
    const outcomes = [outcome(), wrongMuchMany, outcome({ revealed: true, finalCorrect: false }), outcome({ hintsUsed: 2 })];
    for (let i = 0; i < 24; i++) {
      advance(i % 5 === 0 ? 86_400_000 * 2 : 60_000);
      await store.completeItem({ studentId: s.id, item: items[i % items.length]!, outcome: outcomes[i % outcomes.length]! });
    }
    const incremental = await store.loadLearnerState(s.id);
    const dailyBefore = await store.dailyStats(s.id);

    await store.rebuildDerived(s.id);
    expect(await store.loadLearnerState(s.id)).toEqual(incremental);
    expect(await store.dailyStats(s.id)).toEqual(dailyBefore);
  });
});

describe('backup', () => {
  it('export -> import into an empty device restores everything', async () => {
    const a = fresh();
    const s = await a.store.createStudent({ name: 'Test' });
    for (let i = 0; i < 6; i++) await a.store.completeItem({ studentId: s.id, item: choiceItem(), outcome: wrongMuchMany });
    const backup = JSON.parse(JSON.stringify(await a.store.exportBackup()));

    const b = fresh();
    await b.store.importBackup(backup);
    expect(await b.store.loadLearnerState(s.id)).toEqual(await a.store.loadLearnerState(s.id));
  });

  it('importing the same backup twice does not duplicate events', async () => {
    const a = fresh();
    const s = await a.store.createStudent({ name: 'Test' });
    await a.store.completeItem({ studentId: s.id, item: choiceItem(), outcome: outcome() });
    const backup = await a.store.exportBackup();
    await a.store.importBackup(backup);
    await a.store.importBackup(backup);
    expect((await a.store.eventsFor(s.id)).filter((e) => e.type === 'item.completed')).toHaveLength(1);
  });

  it('keeps "my words" through export and import', async () => {
    const a = fresh();
    const s = await a.store.createStudent({ name: 'Test' });
    await a.store.saveWord(s.id, { lemma: 'brave', he: 'אמיץ', example: 'A brave dog.' });
    const backup = JSON.parse(JSON.stringify(await a.store.exportBackup()));

    const b = fresh();
    await b.store.importBackup(backup);
    expect((await b.store.savedWords(s.id)).map((w) => w.lemma)).toEqual(['brave']);
    // An old backup without the table still imports.
    const c = fresh();
    await c.store.importBackup({ ...backup, savedWords: undefined });
    expect(await c.store.savedWords(s.id)).toEqual([]);
  });

  it('rejects a file with the right format tag but no data', async () => {
    const { store } = fresh();
    await expect(store.importBackup({ format: 'smart-english-tutor-backup', schemaVersion: 1 } as never)).rejects.toThrow();
  });

  it('rejects foreign files', async () => {
    const { store } = fresh();
    await expect(store.importBackup({ format: 'x' } as never)).rejects.toThrow();
  });
});

describe('database migrations', () => {
  it('v1 -> latest keeps all data and backfills student preferences', async () => {
    const name = `migration-${++n}`;
    const v1 = new TutorDB(name, 1);
    await v1.open();
    // A student saved by v1 code without the later preference fields.
    await v1.table('students').add({
      id: 's1', name: 'Old', createdAt: 1, updatedAt: 1, goal: { track: 'general' },
      preferences: { accent: 'en-GB' }, hue: 10, archived: false,
    });
    await v1.table('events').add({ id: 'e1', studentId: 's1', at: 1, type: 'student.created', payload: { name: 'Old' } });
    await v1.table('skillStates').add({ studentId: 's1', skillId: 'grammar', mu: 0.3, variance: 0.5, evidence: 4, updatedAt: 1, attempts: 4, successes: 3, history: [] });
    v1.close();

    const latest = new TutorDB(name);
    await latest.open();
    expect(latest.verno).toBe(3);
    const s = await latest.students.get('s1');
    expect(s!.preferences).toEqual({ ...DEFAULT_PREFERENCES, accent: 'en-GB' });
    expect(s!.interests).toEqual([]);
    expect(await latest.events.count()).toBe(1);
    expect((await latest.skillStates.get(['s1', 'grammar']))!.mu).toBe(0.3);
    expect(latest.tables.map((t) => t.name)).toContain('ttsCache');
    expect(latest.tables.map((t) => t.name)).toContain('savedWords');
    latest.close();
    await Dexie.delete(name);
  });
});

describe('my words', () => {
  it('saves once, keeps students apart, and removes', async () => {
    const { store } = fresh();
    const a = await store.createStudent({ name: 'א' });
    const b = await store.createStudent({ name: 'ב' });
    await store.saveWord(a.id, { lemma: 'bread', he: 'לחם', example: 'We eat bread.' });
    await store.saveWord(a.id, { lemma: 'bread', he: 'לחם', example: 'Other.' });
    expect(await store.savedWords(a.id)).toHaveLength(1);
    expect((await store.savedWords(a.id))[0]!.example).toBe('We eat bread.');
    expect(await store.savedWords(b.id)).toHaveLength(0);
    await store.removeWord(a.id, 'bread');
    expect(await store.savedWords(a.id)).toHaveLength(0);
  });

  it('keeps the best result per story', async () => {
    const { store } = fresh();
    const s = await store.createStudent({ name: 'א' });
    await store.log(s.id, 'story.completed', { storyId: 'x', correct: 1, total: 3 });
    await store.log(s.id, 'story.completed', { storyId: 'x', correct: 3, total: 3 });
    expect((await store.storyResults(s.id)).get('x')).toEqual({ correct: 3, total: 3 });
  });
});
