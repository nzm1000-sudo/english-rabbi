import type { TutorDB } from '@/data/schema';

/**
 * Device-wide settings stored in the meta table (not per student).
 * Loaded once at startup and kept in memory so reads are synchronous.
 */
export interface SettingsShape {
  homeServerUrl?: string;
  deviceVoiceUS?: string;
  deviceVoiceGB?: string;
  /** UI sounds on (default) or off. */
  soundOff?: boolean;
  /** Colors: follow the phone (default), or always light / dark. */
  theme?: 'auto' | 'light' | 'dark';
}

const THEME_KEY = 'theme';
/** Page background per theme (--bg in src/app/styles/tokens.css), for the phone's status bar. */
const THEME_COLOR = { light: '#f8fafc', dark: '#0e1220' } as const;

/** Applies the theme to the page and mirrors it for the next start (no flash). */
export function applyTheme(theme: SettingsShape['theme']): void {
  const t = theme && theme !== 'auto' ? theme : undefined;
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  // index.html has one theme-color per color scheme; a fixed theme overrides both.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const scheme = m.getAttribute('media')?.includes('dark') ? 'dark' : 'light';
    m.setAttribute('content', THEME_COLOR[t ?? scheme]);
  });
  try {
    if (t) localStorage.setItem(THEME_KEY, t);
    else localStorage.removeItem(THEME_KEY);
  } catch {
    /* storage may be blocked; the setting still applies for this visit */
  }
}

export class Settings {
  private values: SettingsShape = {};
  private listeners = new Set<() => void>();

  constructor(private readonly db: TutorDB) {}

  async load(): Promise<void> {
    const row = await this.db.meta.get('settings');
    this.values = (row?.value as SettingsShape) ?? {};
    this.emit();
  }

  get<K extends keyof SettingsShape>(key: K): SettingsShape[K] {
    return this.values[key];
  }

  snapshot = (): SettingsShape => this.values;

  async set(patch: Partial<SettingsShape>): Promise<void> {
    this.values = { ...this.values, ...patch };
    await this.db.meta.put({ key: 'settings', value: this.values });
    this.emit();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    for (const l of this.listeners) l();
  }
}
