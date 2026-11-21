import type { CoinMarket, MarketStats, MonitorFilters, TableSort } from '../types/crypto';

const STABLECOIN_SYMBOLS = new Set([
  'usdt',
  'usdc',
  'dai',
  'fdusd',
  'tusd',
  'usde',
  'usdd',
  'pyusd',
  'busd',
  'frax',
  'usds',
  'susde',
]);

export function isStablecoin(coin: CoinMarket): boolean {
  return STABLECOIN_SYMBOLS.has(coin.symbol.toLowerCase());
}

export function getMarketStats(coins: CoinMarket[]): MarketStats {
  const totalCoins = coins.length;
  const totalMarketCap = coins.reduce((sum, coin) => sum + coin.marketCap, 0);
  const totalVolume = coins.reduce((sum, coin) => sum + coin.totalVolume, 0);
  const avgChange24h =
    totalCoins > 0
      ? coins.reduce((sum, coin) => sum + coin.priceChange24h, 0) / totalCoins
      : 0;
  const positiveCount = coins.filter((coin) => coin.priceChange24h > 0).length;
  const negativeCount = coins.filter((coin) => coin.priceChange24h < 0).length;

  return {
    totalCoins,
    avgChange24h,
    totalMarketCap,
    totalVolume,
    positiveCount,
    negativeCount,
  };
}

export function getTopGainer(coins: CoinMarket[]): CoinMarket | null {
  if (coins.length === 0) return null;
  return [...coins].sort((a, b) => b.priceChange24h - a.priceChange24h)[0] ?? null;
}

export function getTopLoser(coins: CoinMarket[]): CoinMarket | null {
  if (coins.length === 0) return null;
  return [...coins].sort((a, b) => a.priceChange24h - b.priceChange24h)[0] ?? null;
}

export function getTopVolumeCoin(coins: CoinMarket[]): CoinMarket | null {
  if (coins.length === 0) return null;
  return [...coins].sort((a, b) => b.totalVolume - a.totalVolume)[0] ?? null;
}

export function applyMonitorFilters(
  coins: CoinMarket[],
  filters: MonitorFilters,
  watchlistSet: Set<string>,
  searchQuery = ''
): CoinMarket[] {
  const query = searchQuery.trim().toLowerCase();
  const minCap = Number(filters.minMarketCap) || 0;
  const minVol = Number(filters.minVolume) || 0;

  return coins.filter((coin) => {
    if (filters.universe === 'favorites' && !watchlistSet.has(coin.id)) return false;
    if (filters.direction === 'up' && coin.priceChange24h <= 0) return false;
    if (filters.direction === 'down' && coin.priceChange24h >= 0) return false;
    if (minCap > 0 && coin.marketCap < minCap) return false;
    if (minVol > 0 && coin.totalVolume < minVol) return false;
    if (filters.excludeStablecoins && isStablecoin(coin)) return false;
    if (
      query &&
      !coin.name.toLowerCase().includes(query) &&
      !coin.symbol.toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  });
}

export function applyTableSort(coins: CoinMarket[], sort: TableSort): CoinMarket[] {
  const sorted = [...coins];
  const dir = sort.direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sort.field) {
      case 'rank':
        return (a.marketCapRank - b.marketCapRank) * dir;
      case 'name':
        return a.name.localeCompare(b.name) * dir;
      case 'price':
        return (a.currentPrice - b.currentPrice) * dir;
      case 'change24h':
        return (a.priceChange24h - b.priceChange24h) * dir;
      case 'volume':
        return (a.totalVolume - b.totalVolume) * dir;
      case 'marketCap':
      default:
        return (a.marketCap - b.marketCap) * dir;
    }
  });

  return sorted;
}
