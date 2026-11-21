import { useCallback, useEffect, useState } from 'react';
import type { CustomList } from '../types/crypto';

const LISTS_STORAGE_KEY = 'lct-custom-lists-v1';

function readCustomLists(): CustomList[] {
  try {
    const raw = localStorage.getItem(LISTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomList[];
    return Array.isArray(parsed)
      ? parsed.filter((l) => l && typeof l.id === 'string' && typeof l.name === 'string' && Array.isArray(l.coinIds))
      : [];
  } catch {
    return [];
  }
}

export function useCustomLists() {
  const [customLists, setCustomLists] = useState<CustomList[]>(() => readCustomLists());

  useEffect(() => {
    try {
      localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(customLists));
    } catch {
      // Ignore storage errors
    }
  }, [customLists]);

  const createList = useCallback((name: string, coinIds: string[] = []): CustomList => {
    const newList: CustomList = {
      id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || 'Nova lista',
      coinIds,
    };
    setCustomLists((prev) => [...prev, newList]);
    return newList;
  }, []);

  const updateList = useCallback((id: string, patch: Partial<Omit<CustomList, 'id'>>) => {
    setCustomLists((prev) =>
      prev.map((list) => (list.id === id ? { ...list, ...patch } : list))
    );
  }, []);

  const deleteList = useCallback((id: string) => {
    setCustomLists((prev) => prev.filter((list) => list.id !== id));
  }, []);

  const moveCoinInList = useCallback((listId: string, index: number, delta: -1 | 1) => {
    setCustomLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;
        const target = index + delta;
        if (target < 0 || target >= list.coinIds.length) return list;
        const nextIds = [...list.coinIds];
        const [item] = nextIds.splice(index, 1);
        nextIds.splice(target, 0, item);
        return { ...list, coinIds: nextIds };
      })
    );
  }, []);

  return {
    customLists,
    createList,
    updateList,
    deleteList,
    moveCoinInList,
  };
}
