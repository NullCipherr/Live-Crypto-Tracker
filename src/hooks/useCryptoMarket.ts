import { useQuery } from '@tanstack/react-query';
import { fetchMarketCoins } from '../services/coingecko';

export function useCryptoMarket() {
  return useQuery({
    queryKey: ['crypto-market'],
    queryFn: () => fetchMarketCoins(20),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 2,
  });
}
