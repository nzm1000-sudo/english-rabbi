import { useEffect, useState, type ReactNode } from 'react';
import { useServices } from '@/app/services';
import { stageOf, type Student } from '@/domain/student/student';
import { HoldButton } from './ParentGate';
import { KidsMessage, KidsTopBar } from './KidsChrome';

/**
 * The daily time limit of the little children's area. A parent can add time
 * for the rest of the day (until the app is closed).
 */
const unlockKey = (studentId: string) => `kids-unlocked:${studentId}`;

export function unlockedToday(studentId: string): boolean {
  try {
    return sessionStorage.getItem(unlockKey(studentId)) === new Date().toDateString();
  } catch {
    return false;
  }
}

export function unlockToday(studentId: string): void {
  try {
    sessionStorage.setItem(unlockKey(studentId), new Date().toDateString());
  } catch {
    /* ignore */
  }
}

/** Daily minutes for this student's kids area, or undefined when there is no limit. */
export function kidsLimit(student: Student): number | undefined {
  return stageOf(student) === 'little' && student.kidsDailyLimit ? student.kidsDailyLimit : undefined;
}

/** "Time is up for today", with a long press for a parent to add time. */
export function TimeUp({ studentId, onUnlock, start, end }: { studentId: string; onUnlock: () => void; start?: ReactNode; end?: ReactNode }) {
  return (
    <main className="screen kids-screen" data-mood="kids">
      <KidsTopBar start={start} end={end} />
      <KidsMessage
        title="להיום סיימנו!"
        line="נתראה מחר עם עוד מילים ומדבקות."
        action={
          <HoldButton
            wide
            label="הורים: עוד זמן היום (להחזיק לחוץ)"
            onDone={() => {
              unlockToday(studentId);
              onUnlock();
            }}
          >
            הורים: עוד זמן (להחזיק)
          </HoldButton>
        }
      />
    </main>
  );
}

/**
 * Checks the limit once, when a game round or a book starts, so "again" on
 * the reward screen cannot play on past the limit. A round already under way
 * is never cut off in the middle.
 */
export function TimeGate({ student, home, children }: { student: Student; home: ReactNode; children: ReactNode }) {
  const { store } = useServices();
  const limit = kidsLimit(student);
  const [unlocked, setUnlocked] = useState(() => unlockedToday(student.id));
  const [timeUp, setTimeUp] = useState<boolean | undefined>(undefined);
  const check = !!limit && !unlocked;
  useEffect(() => {
    if (!check) return;
    let live = true;
    void store.minutesToday(student.id, 'kids').then((m) => {
      if (live) setTimeUp(m >= limit!);
    });
    return () => {
      live = false;
    };
  }, [store, student.id, check, limit]);
  if (!check) return children;
  if (timeUp === undefined) return <main className="screen kids-screen" data-mood="kids" />;
  if (timeUp) return <TimeUp studentId={student.id} onUnlock={() => setUnlocked(true)} start={home} />;
  return children;
}
