import { useSyncExternalStore } from 'react';
import { useServices } from '@/app/services';

const OPTIONS = [
  { id: 'auto', label: 'כמו בטלפון' },
  { id: 'light', label: 'בהיר' },
  { id: 'dark', label: 'כהה' },
] as const;

/** Light, dark, or follow the phone. Applies to the whole device. */
export function ThemePicker({ bare = false }: { bare?: boolean }) {
  const { settings } = useServices();
  const values = useSyncExternalStore(settings.subscribe, settings.snapshot);
  const current = values.theme ?? 'auto';
  return (
    <div className="field">
      {!bare && <span className="label">מראה</span>}
      <div className="segmented" role="group" aria-label="מראה">
        {OPTIONS.map((o) => (
          <button key={o.id} type="button" aria-pressed={current === o.id} onClick={() => void settings.set({ theme: o.id })}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
