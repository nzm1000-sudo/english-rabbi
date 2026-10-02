import { createContext, useContext, type ReactNode } from 'react';
import type { Accent, SpeechRate } from '@/domain/student/student';

/** Accent and speed of the active student. One accent per learning path. */
export interface SpeechPrefs {
  accent: Accent;
  rate: SpeechRate;
}

const DEFAULT: SpeechPrefs = { accent: 'en-US', rate: 'normal' };
const Ctx = createContext<SpeechPrefs>(DEFAULT);

export function SpeechPrefsProvider({ value, children }: { value: SpeechPrefs; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSpeechPrefs(): SpeechPrefs {
  return useContext(Ctx);
}
