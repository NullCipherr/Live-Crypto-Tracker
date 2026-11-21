import { useQuery } from '@tanstack/react-query';
import { fetchCoinDescription, fetchCoinProfile } from '../services/coingecko';

export function useCoinDescription(coinId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['coin-description', coinId],
    queryFn: () => fetchCoinDescription(coinId),
    enabled,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
}

export function useCoinProfile(coinId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['coin-profile', coinId],
    queryFn: () => fetchCoinProfile(coinId),
    enabled,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
}
