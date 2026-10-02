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
