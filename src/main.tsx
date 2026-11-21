import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { PreferencesProvider } from './hooks/usePreferences';
import './index.css';

const SESSION_FLAG_KEY = 'lct-session-active';
const IMAGE_CACHE_NAME = 'lct-coin-images-v1';

// Ao entrar no site em uma nova sessão, limpa o cache de imagens anterior.
// Ao dar F5 (reload na mesma sessão), preserva o cache para não baixar novamente.
try {
  if (sessionStorage.getItem(SESSION_FLAG_KEY) !== '1') {
    sessionStorage.setItem(SESSION_FLAG_KEY, '1');
    if ('caches' in window) {
      void caches.delete(IMAGE_CACHE_NAME);
    }
  }
} catch {
  // Ignora ambientes sem sessionStorage
}

declare const __BUILD_ID__: string;

const RELOADED_BUILD_KEY = 'lct-reloaded-build';
let lastVersionCheckAt = 0;

async function forceRefreshForUpdate(targetBuildId: string): Promise<void> {
  try {
    if (sessionStorage.getItem(RELOADED_BUILD_KEY) === targetBuildId) {
      return;
    }
    sessionStorage.setItem(RELOADED_BUILD_KEY, targetBuildId);
  } catch {
    // ignore storage errors
  }

  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith('lct-coin-images-'))
          .map((key) => caches.delete(key)),
      );
    } catch {
      // ignore cache cleanup errors
    }
  }

  try {
    await fetch(import.meta.env.BASE_URL, { cache: 'reload' });
  } catch {
    // ignore network errors before reload
  }

  window.location.reload();
}

async function checkForAppUpdate(): Promise<void> {
  const now = Date.now();
  if (now - lastVersionCheckAt < 30_000) return;
  lastVersionCheckAt = now;

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${now}`, {
      cache: 'no-store',
    });
    if (!response.ok) return;
    const data = (await response.json()) as { buildId?: string };
    if (data.buildId && data.buildId !== __BUILD_ID__) {
      await forceRefreshForUpdate(data.buildId);
    }
  } catch {
    // ignore offline/transient errors
  }
}

if ('serviceWorker' in navigator) {
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
    .then((registration) => registration.update().catch(() => {}))
    .catch(() => {});
}

window.addEventListener('vite:preloadError', () => {
  void forceRefreshForUpdate(`preload-${__BUILD_ID__}`);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void checkForAppUpdate();
  }
});

void checkForAppUpdate();

// Evita que botões e links clicados com o mouse fiquem com anel de foco congelado.
// Cliques via teclado (Enter/Space, detail === 0) preservam o foco acessível normalmente.
document.addEventListener(
  'click',
  (event) => {
    if (event.detail === 0) return;
    const target = event.target as HTMLElement | null;
    const interactive = target?.closest('button, a, [role="button"], summary');
    if (interactive instanceof HTMLElement) {
      interactive.blur();
    }
  },
  { capture: true, passive: true }
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 90_000,
      gcTime: 30 * 60_000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </QueryClientProvider>
  </StrictMode>
);

const bootLoader = document.getElementById('lct-boot-loader');
if (bootLoader) {
  requestAnimationFrame(() => {
    bootLoader.classList.add('is-hidden');
    window.setTimeout(() => {
      bootLoader.remove();
    }, 240);
  });
}
