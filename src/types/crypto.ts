export type TrendStatus = 'up' | 'down' | 'neutral';

export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChange24h: number;
  marketCap: number;
  totalVolume: number;
  marketCapRank: number;
  high24h: number;
  low24h: number;
  sparkline7d: number[];
  trend: TrendStatus;
}

export interface MarketResponse {
  coins: CoinMarket[];
  latencyMs: number;
  fetchedAt: number;
}

export interface MarketStats {
  totalCoins: number;
  avgChange24h: number;
  totalMarketCap: number;
  totalVolume: number;
  positiveCount: number;
  negativeCount: number;
}

export type SortOption =
  | 'market-cap-desc'
  | 'market-cap-asc'
  | 'top-gainers'
  | 'top-losers'
  | 'alphabetical';
