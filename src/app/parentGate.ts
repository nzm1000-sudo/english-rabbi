/**
 * The parent area opens only through the long press on the student picker.
 * The unlock lives in memory: a reload, or any return to the picker, locks it
 * again, so the browser's back button cannot reopen it for a child.
 */
let unlocked = false;

export const parentGate = {
  unlock: () => {
    unlocked = true;
  },
  lock: () => {
    unlocked = false;
  },
  isUnlocked: () => unlocked,
};
