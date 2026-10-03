import { registerSW } from 'virtual:pwa-register';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createAppServices, ServicesProvider } from './app/services';
import './app/styles/index.css';
import { installSharedDeviceGuard, isReload, startHash } from './app/sharedDevice';

async function boot() {
  // Shared family phone: every launch starts at "who is learning now?".
  const start = startHash(window.location.hash, isReload());
  if (start) window.history.replaceState(null, '', start);
  installSharedDeviceGuard();

  const services = createAppServices();
  try {
    await services.settings.load();
  } catch (e) {
    // No IndexedDB (private browsing, storage blocked or full): say so instead of a blank page.
    console.error(e);
    createRoot(document.getElementById('root')!).render(<StorageError />);
    return;
  }
  // Updates: a home-screen app is rarely closed, so look for a new version
  // every time it comes back to the front. A new version reloads the page.
  registerSW({
    immediate: true,
    onRegisteredSW: (_url, reg) => {
      if (!reg) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update();
      });
    },
  });
  // Leaving the app (home button, lock, switching apps) stops speech.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') services.speech.stop();
  });
  // Ask the browser not to evict our data under storage pressure.
  // On iPhone, installing to the Home Screen also exempts data from Safari's 7-day cleanup.
  void navigator.storage?.persist?.();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ServicesProvider services={services}>
        <App />
      </ServicesProvider>
    </StrictMode>,
  );
}

function StorageError() {
  return (
    <main className="screen empty-state">
      <p className="t-h3">אי אפשר לשמור נתונים במכשיר הזה</p>
      <p className="small muted">אם האפליקציה פתוחה בגלישה פרטית, צריך לפתוח אותה בדפדפן הרגיל. אחר כך לנסות שוב.</p>
      <button type="button" className="btn btn-primary btn-md" onClick={() => window.location.reload()}>
        לנסות שוב
      </button>
    </main>
  );
}

void boot();
