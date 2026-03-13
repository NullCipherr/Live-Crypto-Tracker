import axios from 'axios';
import type { CoinMarket, MarketResponse, TrendStatus } from '../types/crypto';

interface CoinGeckoMarketItem {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  market_cap_rank: number;
  high_24h: number;
  low_24h: number;
  sparkline_in_7d?: {
    price?: number[];
  };
}

interface CoinGeckoCoinResponse {
  description?: {
    en?: string;
  };
}

const api = axios.create({
  baseURL: 'https://api.coingecko.com/api/v3',
  timeout: 12000,
});

function getTrendStatus(change: number): TrendStatus {
  if (change > 0.35) return 'up';
  if (change < -0.35) return 'down';
  return 'neutral';
}

function mapMarketCoin(item: CoinGeckoMarketItem): CoinMarket {
  return {
    id: item.id,
    symbol: item.symbol,
    name: item.name,
    image: item.image,
    currentPrice: item.current_price,
    priceChange24h: item.price_change_percentage_24h ?? 0,
    marketCap: item.market_cap,
    totalVolume: item.total_volume,
    marketCapRank: item.market_cap_rank,
    high24h: item.high_24h,
    low24h: item.low_24h,
    sparkline7d: item.sparkline_in_7d?.price ?? [],
    trend: getTrendStatus(item.price_change_percentage_24h ?? 0),
  };
}

export async function fetchMarketCoins(limit = 20): Promise<MarketResponse> {
  const start = performance.now();
  const response = await api.get<CoinGeckoMarketItem[]>('/coins/markets', {
    params: {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: limit,
      page: 1,
      sparkline: true,
      price_change_percentage: '24h',
    },
  });

  return {
    coins: response.data.map(mapMarketCoin),
    latencyMs: Math.round(performance.now() - start),
    fetchedAt: Date.now(),
  };
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchCoinDescription(coinId: string): Promise<string> {
  const response = await api.get<CoinGeckoCoinResponse>(`/coins/${coinId}`, {
    params: {
      localization: false,
      tickers: false,
      market_data: false,
      community_data: false,
      developer_data: false,
      sparkline: false,
    },
  });

  const description = response.data.description?.en;
  if (!description) return '';

  const plain = stripHtml(description);
  if (plain.length <= 240) return plain;
  return `${plain.slice(0, 237)}...`;
}
