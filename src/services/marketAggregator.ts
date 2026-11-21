import axios from 'axios';
import type { CoinMarket, MarketResponse } from '../types/crypto';
import { readAnyCache, readTimedCache, writeTimedCache } from '../lib/cache';
import { fetchMarketCoins } from './coingecko';

const EXPANSION_CACHE_KEY = 'market-expansion-v2';
const EXPANSION_CACHE_TTL_MS = 10 * 60_000;
const UNIFIED_CACHE_KEY = 'market-unified-1000';

interface CoinCapAsset {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  marketCapUsd: string | null;
  volumeUsd24Hr: string | null;
  priceUsd: string | null;
  changePercent24Hr: string | null;
}

interface CoinGeckoExtraItem {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  price_change_percentage_24h: number | null;
  market_cap: number | null;
  total_volume: number | null;
  market_cap_rank: number | null;
  high_24h: number | null;
  low_24h: number | null;
}

let inFlightExpansion: Promise<CoinMarket[]> | null = null;

function mapCoinCapAsset(item: CoinCapAsset): CoinMarket {
  const price = Number(item.priceUsd ?? 0);
  const change24h = Number(item.changePercent24Hr ?? 0);
  const marketCap = Number(item.marketCapUsd ?? 0);
  const volume = Number(item.volumeUsd24Hr ?? 0);
  const rank = Number(item.rank ?? 9999);
  const sym = item.symbol.toLowerCase();
  const trend = change24h > 0.25 ? 'up' : change24h < -0.25 ? 'down' : 'neutral';

  return {
    id: item.id,
    symbol: sym,
    name: item.name,
    image: `https://assets.coincap.io/assets/icons/${encodeURIComponent(sym)}@2x.png`,
    currentPrice: Number.isFinite(price) ? price : 0,
    priceChange24h: Number.isFinite(change24h) ? change24h : 0,
    marketCap: Number.isFinite(marketCap) ? marketCap : 0,
    totalVolume: Number.isFinite(volume) ? volume : 0,
    marketCapRank: Number.isFinite(rank) ? rank : 9999,
    high24h: price * (change24h >= 0 ? 1.02 : 1 + Math.abs(change24h) / 100),
    low24h: price * (change24h <= 0 ? 0.98 : 1 - Math.abs(change24h) / 100),
    sparkline7d: [],
    trend,
  };
}

function mapGeckoExtra(item: CoinGeckoExtraItem): CoinMarket {
  const price = item.current_price ?? 0;
  const change24h = item.price_change_percentage_24h ?? 0;
  const trend = change24h > 0.25 ? 'up' : change24h < -0.25 ? 'down' : 'neutral';

  return {
    id: item.id,
    symbol: item.symbol.toLowerCase(),
    name: item.name,
    image: item.image,
    currentPrice: price,
    priceChange24h: change24h,
    marketCap: item.market_cap ?? 0,
    totalVolume: item.total_volume ?? 0,
    marketCapRank: item.market_cap_rank ?? 9999,
    high24h: item.high_24h ?? price,
    low24h: item.low_24h ?? price,
    sparkline7d: [],
    trend,
  };
}

async function fetchCoinGeckoPages(pages: number[]): Promise<CoinMarket[]> {
  const results = await Promise.allSettled(
    pages.map((page) =>
      axios.get<CoinGeckoExtraItem[]>('https://api.coingecko.com/api/v3/coins/markets', {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 250,
          page,
          sparkline: false,
          price_change_percentage: '24h',
        },
        timeout: 10000,
      })
    )
  );

  const collected: CoinMarket[] = [];
  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value.data)) {
      collected.push(...res.value.data.map(mapGeckoExtra));
    }
  }
  return collected;
}

export async function fetchExpansionCoins(): Promise<CoinMarket[]> {
  const cached = readTimedCache<CoinMarket[]>(EXPANSION_CACHE_KEY, EXPANSION_CACHE_TTL_MS);
  if (cached && cached.data.length > 0) return cached.data;

  if (inFlightExpansion) return inFlightExpansion;

  inFlightExpansion = (async () => {
    try {
      // 1) Tenta CoinCap (1.000 ativos em 1 única requisição leve)
      const capRes = await axios.get<{ data: CoinCapAsset[] }>(
        'https://api.coincap.io/v2/assets',
        {
          params: { limit: 1000 },
          timeout: 10000,
        }
      );
      const capCoins = (capRes.data?.data ?? [])
        .filter((a) => Number(a.priceUsd ?? 0) > 0)
        .map(mapCoinCapAsset);

      if (capCoins.length >= 300) {
        writeTimedCache(EXPANSION_CACHE_KEY, capCoins);
        return capCoins;
      }
    } catch {
      // Fallback para páginas 2..4 da CoinGecko (sem sparkline, leve)
    }

    try {
      const geckoExtra = await fetchCoinGeckoPages([2, 3, 4]);
      if (geckoExtra.length > 0) {
        writeTimedCache(EXPANSION_CACHE_KEY, geckoExtra);
        return geckoExtra;
      }
    } catch {
      // Ignora erro e tenta cache antigo
    } finally {
      inFlightExpansion = null;
    }

    const stale = readAnyCache<CoinMarket[]>(EXPANSION_CACHE_KEY);
    return stale?.data ?? [];
  })();

  return inFlightExpansion;
}

export async function fetchUnifiedMarketCoins(): Promise<MarketResponse> {
  const [geckoRes, expansionRes] = await Promise.allSettled([
    fetchMarketCoins(250),
    fetchExpansionCoins(),
  ]);

  const expansion = expansionRes.status === 'fulfilled' ? expansionRes.value : [];

  if (geckoRes.status === 'fulfilled') {
    const primary = geckoRes.value;
    const seenIds = new Set(primary.coins.map((c) => c.id.toLowerCase()));
    const seenSymbols = new Set(primary.coins.map((c) => c.symbol.toLowerCase()));

    const extra: CoinMarket[] = [];
    for (const coin of expansion) {
      if (primary.coins.length + extra.length >= 1000) break;
      if (seenIds.has(coin.id.toLowerCase()) || seenSymbols.has(coin.symbol.toLowerCase())) {
        continue;
      }
      seenIds.add(coin.id.toLowerCase());
      seenSymbols.add(coin.symbol.toLowerCase());
      extra.push(coin);
    }

    const result: MarketResponse = {
      coins: [...primary.coins, ...extra],
      latencyMs: primary.latencyMs,
      fetchedAt: primary.fetchedAt,
    };
    writeTimedCache(UNIFIED_CACHE_KEY, result, result.fetchedAt);
    return result;
  }

  // Failover: CoinGecko falhou — usa expansão preservando sparklines/imagens do cache anterior
  if (expansion.length > 0) {
    const prev = readAnyCache<MarketResponse>(UNIFIED_CACHE_KEY)?.data;
    const prevBySymbol = new Map<string, CoinMarket>();
    if (prev) {
      for (const c of prev.coins) {
        prevBySymbol.set(c.symbol.toLowerCase(), c);
      }
    }

    const failoverCoins = expansion.slice(0, 1000).map((coin) => {
      const cached = prevBySymbol.get(coin.symbol.toLowerCase());
      return cached
        ? {
            ...coin,
            id: cached.id,
            image: cached.image || coin.image,
            sparkline7d: cached.sparkline7d,
          }
        : coin;
    });

    const result: MarketResponse = {
      coins: failoverCoins,
      latencyMs: 0,
      fetchedAt: Date.now(),
    };
    writeTimedCache(UNIFIED_CACHE_KEY, result, result.fetchedAt);
    return result;
  }

  const stale = readAnyCache<MarketResponse>(UNIFIED_CACHE_KEY);
  if (stale) return stale.data;
  throw geckoRes.reason;
}
