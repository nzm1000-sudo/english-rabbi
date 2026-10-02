import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createAppServices, ServicesProvider } from './app/services';
import './app/styles.css';

async function boot() {
  const services = createAppServices();
  await services.settings.load();
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

void boot();
