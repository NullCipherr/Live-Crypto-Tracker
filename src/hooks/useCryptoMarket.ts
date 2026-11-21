import { useQuery } from '@tanstack/react-query';
import { fetchUnifiedMarketCoins } from '../services/marketAggregator';
import { readAnyCache } from '../lib/cache';
import type { MarketResponse } from '../types/crypto';
import { usePreferences } from './usePreferences';

export function useCryptoMarket() {
  const { preferences } = usePreferences();
  const intervalMs = preferences.refreshIntervalSec * 1000;
  const cached =
    readAnyCache<MarketResponse>('market-unified-1000') ??
    readAnyCache<MarketResponse>('market-top250');

  const hasExpandedCache = (cached?.data?.coins?.length ?? 0) > 250;

  return useQuery({
    queryKey: ['crypto-market'],
    queryFn: fetchUnifiedMarketCoins,
    initialData: cached?.data,
    initialDataUpdatedAt: hasExpandedCache ? cached?.savedAt : 0,
    staleTime: intervalMs,
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    refetchOnWindowFocus: preferences.refetchOnFocus,
    refetchOnReconnect: true,
    retry: 1,
  });
}
