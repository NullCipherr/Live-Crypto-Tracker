import { useCallback, useEffect, useState } from 'react';
import type { SavedScreenerSearch } from '../types/crypto';

const SCREENER_STORAGE_KEY = 'lct-screener-searches-v1';

const DEFAULT_SAVED_SEARCHES: SavedScreenerSearch[] = [
  {
    id: 'preset-drops-volume',
    name: 'Quedas com volume',
    matchMode: 'all',
    conditions: [
      { id: 'c1', field: 'change24h', operator: 'lt', value: '-3' },
      { id: 'c2', field: 'volume', operator: 'gte', value: '1000000000' },
    ],
  },
  {
    id: 'preset-large-caps',
    name: 'Grandes capitalizações',
    matchMode: 'all',
    conditions: [{ id: 'c3', field: 'marketCap', operator: 'gte', value: '10000000000' }],
  },
];

function readSavedSearches(): SavedScreenerSearch[] {
  try {
    const raw = localStorage.getItem(SCREENER_STORAGE_KEY);
    if (!raw) return DEFAULT_SAVED_SEARCHES;
    const parsed = JSON.parse(raw) as SavedScreenerSearch[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SAVED_SEARCHES;
  } catch {
    return DEFAULT_SAVED_SEARCHES;
  }
}

export function useScreenerSearches() {
  const [savedSearches, setSavedSearches] = useState<SavedScreenerSearch[]>(() =>
    readSavedSearches()
  );

  useEffect(() => {
    try {
      localStorage.setItem(SCREENER_STORAGE_KEY, JSON.stringify(savedSearches));
    } catch {
      // Ignore storage errors
    }
  }, [savedSearches]);

  const saveSearch = useCallback(
    (search: Omit<SavedScreenerSearch, 'id'>) => {
      const entry: SavedScreenerSearch = {
        ...search,
        id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      setSavedSearches((prev) => [entry, ...prev]);
      return entry;
    },
    []
  );

  const deleteSearch = useCallback((id: string) => {
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    savedSearches,
    saveSearch,
    deleteSearch,
  };
}
