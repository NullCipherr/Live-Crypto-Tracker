import axios, { AxiosError } from 'axios';
import type {
  AssetChartPoint,
  AssetOhlcPoint,
  CoinMarket,
  MarketResponse,
  RequestLogEntry,
  ServiceName,
  TrendStatus,
} from '../types/crypto';
import { readAnyCache, readTimedCache, writeTimedCache } from '../lib/cache';

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
    pt?: string;
  };
  categories?: string[];
  genesis_date?: string | null;
  hashing_algorithm?: string | null;
  sentiment_votes_up_percentage?: number | null;
  links?: {
    homepage?: string[];
    blockchain_site?: string[];
    repos_url?: { github?: string[] };
    subreddit_url?: string | null;
  };
  market_data?: {
    ath?: { usd?: number };
    ath_change_percentage?: { usd?: number };
    ath_date?: { usd?: string };
    atl?: { usd?: number };
    atl_change_percentage?: { usd?: number };
    atl_date?: { usd?: string };
    circulating_supply?: number | null;
    total_supply?: number | null;
    max_supply?: number | null;
    fully_diluted_valuation?: { usd?: number };
  };
}

export interface CoinProfile {
  descriptionPt: string;
  isTranslated: boolean;
  categories: string[];
  genesisDate: string | null;
  hashingAlgorithm: string | null;
  sentimentUpPct: number | null;
  homepage: string | null;
  explorer: string | null;
  github: string | null;
  subreddit: string | null;
  athUsd: number | null;
  athChangePct: number | null;
  athDate: string | null;
  atlUsd: number | null;
  atlChangePct: number | null;
  atlDate: string | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  fdvUsd: number | null;
}

interface CoinGeckoMarketChartResponse {
  prices?: [number, number][];
  market_caps?: [number, number][];
  total_volumes?: [number, number][];
}

const api = axios.create({
  baseURL: 'https://api.coingecko.com/api/v3',
  timeout: 12000,
});

const CHART_CACHE_TTL_MS = 15 * 60_000; // 15 minutes
const DESC_CACHE_TTL_MS = 24 * 60 * 60_000; // 24 hours
const RATE_LIMIT_COOLDOWN_MS = 60_000; // 60 seconds cooldown after HTTP 429

let rateLimitUntil = 0;
const inFlightRequests = new Map<string, Promise<unknown>>();

function dedupeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

const MAX_LOG_ENTRIES = 30;
let requestLogs: RequestLogEntry[] = [];
const listeners = new Set<() => void>();
const marketListeners = new Set<(res: MarketResponse) => void>();

export function subscribeMarketSnapshot(cb: (res: MarketResponse) => void): () => void {
  marketListeners.add(cb);
  return () => marketListeners.delete(cb);
}

function recordLog(entry: Omit<RequestLogEntry, 'id'>) {
  requestLogs = [
    { ...entry, id: `${entry.timestamp}-${Math.random().toString(36).slice(2, 7)}` },
    ...requestLogs,
  ].slice(0, MAX_LOG_ENTRIES);
  listeners.forEach((cb) => cb());
}

export function getRequestLogs(): RequestLogEntry[] {
  return requestLogs;
}

export function subscribeRequestLogs(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function logAxiosError(service: ServiceName, start: number, err: unknown) {
  const durationMs = Math.round(performance.now() - start);
  const axiosErr = err as AxiosError;
  const status = axiosErr.response?.status ?? 'ERR';
  if (status === 429) {
    rateLimitUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  }
  const note =
    status === 429
      ? 'Limite atingido (pausa de 60s ativada)'
      : axiosErr.code === 'ECONNABORTED'
        ? 'Tempo limite excedido'
        : axiosErr.message || 'Falha de rede';
  recordLog({
    timestamp: Date.now(),
    service,
    status,
    ok: false,
    durationMs,
    note,
  });
}

function getTrendStatus(change: number): TrendStatus {
  if (change > 0.35) return 'up';
  if (change < -0.35) return 'down';
  return 'neutral';
}

function mapMarketCoin(item: CoinGeckoMarketItem): CoinMarket {
  const priceChange = Number.isFinite(item.price_change_percentage_24h)
    ? item.price_change_percentage_24h
    : 0;

  return {
    id: item.id,
    symbol: item.symbol ?? '',
    name: item.name ?? item.id,
    image: item.image ?? '',
    currentPrice: Number.isFinite(item.current_price) ? item.current_price : 0,
    priceChange24h: priceChange,
    marketCap: Number.isFinite(item.market_cap) ? item.market_cap : 0,
    totalVolume: Number.isFinite(item.total_volume) ? item.total_volume : 0,
    marketCapRank: Number.isFinite(item.market_cap_rank) ? item.market_cap_rank : 0,
    high24h: Number.isFinite(item.high_24h) ? item.high_24h : 0,
    low24h: Number.isFinite(item.low_24h) ? item.low_24h : 0,
    sparkline7d: Array.isArray(item.sparkline_in_7d?.price)
      ? item.sparkline_in_7d.price.filter((point) => Number.isFinite(point))
      : [],
    trend: getTrendStatus(priceChange),
  };
}

export async function fetchMarketCoins(limit = 250): Promise<MarketResponse> {
  const cacheKey = `market-top${limit}`;
  return dedupeRequest(`market-${limit}`, async () => {
    if (Date.now() < rateLimitUntil) {
      const stale = readAnyCache<MarketResponse>(cacheKey);
      if (stale) return stale.data;
      throw new Error('CoinGecko em pausa por limite de requisições.');
    }

    const start = performance.now();
    try {
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

      const latencyMs = Math.round(performance.now() - start);
      const coins = response.data.map(mapMarketCoin);
      const fetchedAt = Date.now();
      recordLog({
        timestamp: fetchedAt,
        service: 'Cotações',
        status: response.status,
        ok: true,
        durationMs: latencyMs,
        note: `${coins.length} recebidos`,
      });

      const result: MarketResponse = {
        coins,
        latencyMs,
        fetchedAt,
      };
      writeTimedCache(cacheKey, result, fetchedAt);
      marketListeners.forEach((cb) => cb(result));
      return result;
    } catch (err) {
      logAxiosError('Cotações', start, err);
      throw err;
    }
  });
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchCoinDescription(coinId: string): Promise<string> {
  const cacheKey = `desc:${coinId}`;
  const cached = readTimedCache<string>(cacheKey, DESC_CACHE_TTL_MS);
  if (cached) return cached.data;

  return dedupeRequest(cacheKey, async () => {
    if (Date.now() < rateLimitUntil) {
      const stale = readAnyCache<string>(cacheKey);
      if (stale) return stale.data;
      throw new Error('CoinGecko em pausa por limite de requisições.');
    }

    const start = performance.now();
    try {
      const response = await api.get<CoinGeckoCoinResponse>(`/coins/${encodeURIComponent(coinId)}`, {
        params: {
          localization: false,
          tickers: false,
          market_data: false,
          community_data: false,
          developer_data: false,
          sparkline: false,
        },
      });

      const durationMs = Math.round(performance.now() - start);
      recordLog({
        timestamp: Date.now(),
        service: 'Descrição',
        status: response.status,
        ok: true,
        durationMs,
        note: coinId,
      });

      const description = response.data.description?.en;
      const clean = description ? stripHtml(description) : '';
      writeTimedCache(cacheKey, clean);
      return clean;
    } catch (err) {
      logAxiosError('Descrição', start, err);
      throw err;
    }
  });
}

async function translateToPtBr(text: string): Promise<string | null> {
  if (!text) return null;
  // Split into sentence-aligned chunks under 450 chars for MyMemory API
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if ((current + s).length > 430 && current.length > 0) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  const limited = chunks.slice(0, 6);
  const translated = await Promise.all(
    limited.map(async (chunk) => {
      try {
        const res = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|pt-BR`,
          { signal: AbortSignal.timeout(5500) }
        );
        if (!res.ok) return null;
        const json = (await res.json()) as {
          responseStatus?: number;
          responseData?: { translatedText?: string };
        };
        if (json.responseStatus !== 200) return null;
        return json.responseData?.translatedText ?? null;
      } catch {
        return null;
      }
    })
  );

  if (translated.some((t) => !t)) return null;
  return translated.join(' ');
}

export async function fetchCoinProfile(coinId: string): Promise<CoinProfile> {
  const cacheKey = `profile:${coinId}`;
  const cached = readTimedCache<CoinProfile>(cacheKey, DESC_CACHE_TTL_MS);
  if (cached) return cached.data;

  return dedupeRequest(cacheKey, async () => {
    if (Date.now() < rateLimitUntil) {
      const stale = readAnyCache<CoinProfile>(cacheKey);
      if (stale) return stale.data;
      throw new Error('CoinGecko em pausa por limite de requisições.');
    }

    const start = performance.now();
    try {
      const response = await api.get<CoinGeckoCoinResponse>(`/coins/${encodeURIComponent(coinId)}`, {
        params: {
          localization: true,
          tickers: false,
          market_data: true,
          community_data: false,
          developer_data: false,
          sparkline: false,
        },
      });

      const durationMs = Math.round(performance.now() - start);
      recordLog({
        timestamp: Date.now(),
        service: 'Descrição',
        status: response.status,
        ok: true,
        durationMs,
        note: coinId,
      });

      const d = response.data;
      const ptRaw = d.description?.pt ? stripHtml(d.description.pt) : '';
      const enRaw = d.description?.en ? stripHtml(d.description.en) : '';

      let descriptionPt = ptRaw;
      let isTranslated = false;

      if (!descriptionPt && enRaw) {
        const translated = await translateToPtBr(enRaw);
        if (translated) {
          descriptionPt = translated;
          isTranslated = true;
        } else {
          descriptionPt = enRaw;
        }
      }

      const firstValid = (arr?: string[]) =>
        arr?.find((u) => typeof u === 'string' && u.startsWith('http')) ?? null;

      const md = d.market_data;
      const profile: CoinProfile = {
        descriptionPt,
        isTranslated,
        categories: (d.categories ?? []).filter(Boolean).slice(0, 6),
        genesisDate: d.genesis_date ?? null,
        hashingAlgorithm: d.hashing_algorithm ?? null,
        sentimentUpPct:
          typeof d.sentiment_votes_up_percentage === 'number'
            ? d.sentiment_votes_up_percentage
            : null,
        homepage: firstValid(d.links?.homepage),
        explorer: firstValid(d.links?.blockchain_site),
        github: firstValid(d.links?.repos_url?.github),
        subreddit: d.links?.subreddit_url || null,
        athUsd: md?.ath?.usd ?? null,
        athChangePct: md?.ath_change_percentage?.usd ?? null,
        athDate: md?.ath_date?.usd ?? null,
        atlUsd: md?.atl?.usd ?? null,
        atlChangePct: md?.atl_change_percentage?.usd ?? null,
        atlDate: md?.atl_date?.usd ?? null,
        circulatingSupply: md?.circulating_supply ?? null,
        totalSupply: md?.total_supply ?? null,
        maxSupply: md?.max_supply ?? null,
        fdvUsd: md?.fully_diluted_valuation?.usd ?? null,
      };

      writeTimedCache(cacheKey, profile);
      return profile;
    } catch (err) {
      logAxiosError('Descrição', start, err);
      throw err;
    }
  });
}

export interface AssetFullChartData {
  prices: AssetChartPoint[];
  marketCaps: { timestamp: number; marketCap: number }[];
  volumes: { timestamp: number; volume: number }[];
}

export async function fetchAssetFullChart(
  coinId: string,
  days: '1' | '7' | '30' | '90' | '365' | 'max'
): Promise<AssetFullChartData> {
  const cacheKey = `chart-full:${coinId}:${days}`;
  const cached = readTimedCache<AssetFullChartData>(cacheKey, CHART_CACHE_TTL_MS);
  if (cached) return cached.data;

  return dedupeRequest(cacheKey, async () => {
    if (Date.now() < rateLimitUntil) {
      const stale = readAnyCache<AssetFullChartData>(cacheKey);
      if (stale) return stale.data;
      throw new Error('CoinGecko em pausa por limite de requisições.');
    }

    const start = performance.now();
    try {
      const response = await api.get<CoinGeckoMarketChartResponse>(
        `/coins/${encodeURIComponent(coinId)}/market_chart`,
        {
          params: {
            vs_currency: 'usd',
            days,
          },
        }
      );

      const durationMs = Math.round(performance.now() - start);
      const prices = (response.data.prices ?? [])
        .filter(([ts, price]) => Number.isFinite(ts) && Number.isFinite(price))
        .map(([timestamp, price]) => ({ timestamp, price }));

      const marketCaps = (response.data.market_caps ?? [])
        .filter(([ts, cap]) => Number.isFinite(ts) && Number.isFinite(cap))
        .map(([timestamp, marketCap]) => ({ timestamp, marketCap }));

      const volumes = (response.data.total_volumes ?? [])
        .filter(([ts, vol]) => Number.isFinite(ts) && Number.isFinite(vol))
        .map(([timestamp, volume]) => ({ timestamp, volume }));

      recordLog({
        timestamp: Date.now(),
        service: 'Histórico',
        status: response.status,
        ok: true,
        durationMs,
        note: `${coinId} (${days}d · ${prices.length} pts)`,
      });

      const data: AssetFullChartData = { prices, marketCaps, volumes };
      writeTimedCache(cacheKey, data);
      return data;
    } catch (err) {
      logAxiosError('Histórico', start, err);
      const stale = readAnyCache<AssetFullChartData>(cacheKey);
      if (stale) return stale.data;
      throw err;
    }
  });
}

export async function fetchAssetChart(
  coinId: string,
  days: '1' | '7' | '30' | '90' | '365' | 'max'
): Promise<AssetChartPoint[]> {
  const full = await fetchAssetFullChart(coinId, days);
  return full.prices;
}

export async function fetchAssetOhlc(
  coinId: string,
  days: '1' | '7' | '14' | '30' | '90'
): Promise<AssetOhlcPoint[]> {
  const cacheKey = `ohlc:${coinId}:${days}`;
  const cached = readTimedCache<AssetOhlcPoint[]>(cacheKey, CHART_CACHE_TTL_MS);
  if (cached) return cached.data;

  return dedupeRequest(cacheKey, async () => {
    if (Date.now() < rateLimitUntil) {
      const stale = readAnyCache<AssetOhlcPoint[]>(cacheKey);
      if (stale) return stale.data;
      throw new Error('CoinGecko em pausa por limite de requisições.');
    }

    const start = performance.now();
    try {
      const response = await api.get<[number, number, number, number, number][]>(
        `/coins/${encodeURIComponent(coinId)}/ohlc`,
        {
          params: {
            vs_currency: 'usd',
            days,
          },
        }
      );

      const durationMs = Math.round(performance.now() - start);
      const candles = (response.data ?? [])
        .filter((row) => Array.isArray(row) && row.length >= 5 && row.every(Number.isFinite))
        .map(([timestamp, open, high, low, close]) => ({
          timestamp,
          open,
          high,
          low,
          close,
        }));

      recordLog({
        timestamp: Date.now(),
        service: 'Histórico',
        status: response.status,
        ok: true,
        durationMs,
        note: `${coinId} OHLC (${days}d · ${candles.length} candles)`,
      });

      writeTimedCache(cacheKey, candles);
      return candles;
    } catch (err) {
      logAxiosError('Histórico', start, err);
      const stale = readAnyCache<AssetOhlcPoint[]>(cacheKey);
      if (stale) return stale.data;
      throw err;
    }
  });
}
