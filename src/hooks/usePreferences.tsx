/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { AppPreferences } from '../types/crypto';

const PREFS_STORAGE_KEY = 'lct-preferences-v1';

export const DEFAULT_PREFERENCES: AppPreferences = {
  themeMode: 'dark',
  density: 'compact',
  reduceMotion: 'system',
  numberLocale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  decimalMode: 'auto',
  refreshIntervalSec: 60,
  refetchOnFocus: true,
};

interface ThemeOrigin {
  x: number;
  y: number;
}

interface PreferencesContextValue {
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => void;
  setThemeWithAnimation: (themeMode: AppPreferences['themeMode'], origin?: ThemeOrigin) => void;
  resetPreferences: () => void;
  resolvedTheme: 'dark' | 'light';
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function readPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function applyThemeToDom(theme: 'dark' | 'light') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(() => readPreferences());
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolveTheme = useCallback(
    (mode: AppPreferences['themeMode']): 'dark' | 'light' =>
      mode === 'system' ? (systemDark ? 'dark' : 'light') : mode,
    [systemDark]
  );

  const resolvedTheme = resolveTheme(preferences.themeMode);

  useEffect(() => {
    applyThemeToDom(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage quota / private mode errors
    }
  }, [preferences]);

  const updatePreferences = useCallback((patch: Partial<AppPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const setThemeWithAnimation = useCallback(
    (themeMode: AppPreferences['themeMode'], origin?: ThemeOrigin) => {
      const nextResolved = resolveTheme(themeMode);
      const shouldReduce =
        preferences.reduceMotion === 'reduce' ||
        (preferences.reduceMotion === 'system' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      if (shouldReduce || nextResolved === resolvedTheme) {
        setPreferences((prev) => ({ ...prev, themeMode }));
        return;
      }

      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? window.innerHeight / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const docWithTransition = document as Document & {
        startViewTransition?: (cb: () => void) => { ready: Promise<void> };
      };

      if (typeof docWithTransition.startViewTransition === 'function') {
        const transition = docWithTransition.startViewTransition(() => {
          flushSync(() => {
            setPreferences((prev) => ({ ...prev, themeMode }));
          });
          applyThemeToDom(nextResolved);
        });

        transition.ready
          .then(() => {
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
              },
              {
                duration: 420,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                pseudoElement: '::view-transition-new(root)',
              }
            );
          })
          .catch(() => {
            // Ignore view transition abort errors
          });
        return;
      }

      // Fallback using Web Animations API directly
      setPreferences((prev) => ({ ...prev, themeMode }));
      applyThemeToDom(nextResolved);
      document.documentElement.animate([{ opacity: 0.88 }, { opacity: 1 }], {
        duration: 220,
        easing: 'ease-out',
      });
    },
    [preferences.reduceMotion, resolveTheme, resolvedTheme]
  );

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        updatePreferences,
        setThemeWithAnimation,
        resetPreferences,
        resolvedTheme,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return ctx;
}
