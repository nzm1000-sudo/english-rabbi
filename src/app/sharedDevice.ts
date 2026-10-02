/**
 * The family shares one phone. Whoever opens the app must choose who is
 * learning, so a child never lands in a sibling's profile.
 *
 * - On a cold start the app always opens on the student picker
 *   (except for a family setup link).
 * - After the app was in the background for longer than AWAY_MS, it returns
 *   to the picker. An unfinished practice session is closed normally.
 */
export const AWAY_MS = 3 * 60 * 1000;

const OPEN_PATHS = [/^#?\/?$/, /^#\/setup/];

export function startHash(currentHash: string): string | null {
  return OPEN_PATHS.some((re) => re.test(currentHash)) ? null : '#/';
}

export function shouldReturnToPicker(hiddenAt: number | null, now: number, currentHash: string): boolean {
  if (hiddenAt === null) return false;
  if (now - hiddenAt < AWAY_MS) return false;
  return startHash(currentHash) !== null;
}

export function installSharedDeviceGuard(win: Window = window): () => void {
  let hiddenAt: number | null = null;
  const onVisibility = () => {
    if (win.document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (shouldReturnToPicker(hiddenAt, Date.now(), win.location.hash)) win.location.hash = '#/';
    hiddenAt = null;
  };
  win.document.addEventListener('visibilitychange', onVisibility);
  return () => win.document.removeEventListener('visibilitychange', onVisibility);
}
