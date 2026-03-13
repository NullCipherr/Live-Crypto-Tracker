import { useQuery } from '@tanstack/react-query';
import { fetchCoinDescription } from '../services/coingecko';

export function useCoinDescription(coinId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['coin-description', coinId],
    queryFn: () => fetchCoinDescription(coinId),
    enabled,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
}
