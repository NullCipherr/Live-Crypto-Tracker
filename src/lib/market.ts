import type { CoinMarket, MarketStats, SortOption } from '../types/crypto';

export function getMarketStats(coins: CoinMarket[]): MarketStats {
  const totalCoins = coins.length;
  const totalMarketCap = coins.reduce((sum, coin) => sum + coin.marketCap, 0);
  const totalVolume = coins.reduce((sum, coin) => sum + coin.totalVolume, 0);
  const avgChange24h =
    totalCoins > 0
      ? coins.reduce((sum, coin) => sum + coin.priceChange24h, 0) / totalCoins
      : 0;
  const positiveCount = coins.filter((coin) => coin.priceChange24h >= 0).length;
  const negativeCount = totalCoins - positiveCount;

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

export function getMomentumCoin(coins: CoinMarket[]): CoinMarket | null {
  if (coins.length === 0) return null;

  return [...coins].sort((a, b) => {
    const aStart = a.sparkline7d[0] ?? a.currentPrice;
    const aEnd = a.sparkline7d[a.sparkline7d.length - 1] ?? a.currentPrice;
    const bStart = b.sparkline7d[0] ?? b.currentPrice;
    const bEnd = b.sparkline7d[b.sparkline7d.length - 1] ?? b.currentPrice;
    const aMomentum = Math.abs(((aEnd - aStart) / aStart) * 100);
    const bMomentum = Math.abs(((bEnd - bStart) / bStart) * 100);
    return bMomentum - aMomentum;
  })[0] ?? null;
}

export function getSentiment(avgChange24h: number): 'Bullish' | 'Neutral' | 'Bearish' {
  if (avgChange24h > 0.4) return 'Bullish';
  if (avgChange24h < -0.4) return 'Bearish';
  return 'Neutral';
}

export function applySort(coins: CoinMarket[], sort: SortOption): CoinMarket[] {
  const sorted = [...coins];

  switch (sort) {
    case 'market-cap-asc':
      return sorted.sort((a, b) => a.marketCap - b.marketCap);
    case 'top-gainers':
      return sorted.sort((a, b) => b.priceChange24h - a.priceChange24h);
    case 'top-losers':
      return sorted.sort((a, b) => a.priceChange24h - b.priceChange24h);
    case 'alphabetical':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'market-cap-desc':
    default:
      return sorted.sort((a, b) => b.marketCap - a.marketCap);
  }
}
