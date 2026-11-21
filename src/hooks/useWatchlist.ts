import { useCallback, useEffect, useMemo, useState } from 'react';

const WATCHLIST_STORAGE_KEY = 'crypto-watchlist-v2';

function readWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>(() => readWatchlist());

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
    } catch {
      // Ignore storage quota or private-mode errors
    }
  }, [watchlist]);

  const watchlistSet = useMemo(() => new Set(watchlist), [watchlist]);

  const toggleWatchlist = useCallback((coinId: string) => {
    setWatchlist((previous) =>
      previous.includes(coinId)
        ? previous.filter((item) => item !== coinId)
        : [...previous, coinId]
    );
  }, []);

  return {
    watchlist,
    watchlistSet,
    toggleWatchlist,
    isFavorite: (coinId: string) => watchlistSet.has(coinId),
  };
}
