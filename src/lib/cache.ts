const CACHE_PREFIX = 'lct-cache:';

interface CacheEnvelope<T> {
  savedAt: number;
  data: T;
}

export function readTimedCache<T>(key: string, maxAgeMs: number): { data: T; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) return null;
    return { data: parsed.data, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function readAnyCache<T>(key: string): { data: T; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    return { data: parsed.data, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function writeTimedCache<T>(key: string, data: T, savedAt = Date.now()): void {
  const payload = JSON.stringify({ savedAt, data } satisfies CacheEnvelope<T>);
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, payload);
  } catch {
    // Evict old cache entries on quota exceeded and retry once
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) keysToRemove.push(k);
      }
      for (const k of keysToRemove.slice(0, Math.ceil(keysToRemove.length / 2))) {
        localStorage.removeItem(k);
      }
      localStorage.setItem(`${CACHE_PREFIX}${key}`, payload);
    } catch {
      // Ignore if storage is completely unavailable
    }
  }
}
