/**
 * "Continue where you stopped": the in-progress practice session or story of
 * each student, kept in this browser's storage. Only ids and results are kept;
 * answers are already saved in the database as they happen.
 */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export interface SessionSnapshot {
  mode: string;
  paramsKey: string;
  title: string;
  savedAt: number;
  /** Item ids presented, in order. The last one is unanswered if results are shorter. */
  recent: string[];
  results: unknown[];
  total: number;
  /** Fixed list (exam, daily...): registry ids, or full items for generated ones. */
  fixedIds?: string[];
  fixedItems?: unknown[];
}

export interface StorySnapshot {
  shown: number;
  answered: [string, boolean][];
  savedAt: number;
}

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as T & { savedAt?: number };
    if (!v.savedAt || Date.now() - v.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return undefined;
    }
    return v;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: resuming is a convenience only */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const paramsKey = (p: Record<string, string>) =>
  JSON.stringify(Object.keys(p).sort().map((k) => [k, p[k]]));

// One saved place per student and mode, so starting a quiz does not erase a half-done exam.
const sessionKey = (studentId: string, mode: string) => `resume:${studentId}:${mode}`;
const storyKey = (studentId: string, storyId: string) => `story:${studentId}:${storyId}`;

export const resume = {
  getSession: (studentId: string, mode: string) => read<SessionSnapshot>(sessionKey(studentId, mode)),
  saveSession: (studentId: string, s: Omit<SessionSnapshot, 'savedAt'>) => write(sessionKey(studentId, s.mode), { ...s, savedAt: Date.now() }),
  clearSession: (studentId: string, mode: string) => remove(sessionKey(studentId, mode)),
  /** The most recently saved unfinished session of a student, for the home screen. */
  latestSession(studentId: string): (SessionSnapshot & { params: Record<string, string> }) | undefined {
    let best: SessionSnapshot | undefined;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith(`resume:${studentId}:`)) continue;
        const s = read<SessionSnapshot>(k);
        if (s && s.recent.length > 0 && (!best || s.savedAt > best.savedAt)) best = s;
      }
    } catch {
      return undefined;
    }
    if (!best) return undefined;
    return { ...best, params: Object.fromEntries(JSON.parse(best.paramsKey) as [string, string][]) };
  },
  getStory: (studentId: string, storyId: string) => read<StorySnapshot>(storyKey(studentId, storyId)),
  saveStory: (studentId: string, storyId: string, s: Omit<StorySnapshot, 'savedAt'>) => write(storyKey(studentId, storyId), { ...s, savedAt: Date.now() }),
  clearStory: (studentId: string, storyId: string) => remove(storyKey(studentId, storyId)),
};
