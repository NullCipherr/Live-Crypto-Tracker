import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  ExternalLink,
  Newspaper,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ApexOptions } from 'apexcharts';
import type { CoinMarket, NavRoute } from '../../types/crypto';
import { getMarketStats, isStablecoin } from '../../lib/market';
import { formatCompactNumber, formatPercent, formatPrice } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { PageHeader, HeaderSegmented } from '../shell/PageHeader';
import { CustomSelect } from '../ui/CustomSelect';
import { ChartCardHeader } from '../analytics/ChartCard';
import { ApexChartWrapper } from '../analytics/ApexChartWrapper';

interface HomeViewProps {
  coins: CoinMarket[];
  watchlistSet: Set<string>;
  onToggleFavorite: (coinId: string) => void;
  onOpenAsset: (coinId: string) => void;
  onNavigate: (route: NavRoute) => void;
}

const PRESET_USD = [100, 500, 1000, 5000] as const;

interface NewsTickerItem {
  id: string;
  source: string;
  title: string;
  url?: string;
  coinId?: string;
  tag?: string;
  positive?: boolean;
}

async function fetchCryptoNews(): Promise<NewsTickerItem[]> {
  const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
  if (!res.ok) throw new Error('Falha ao carregar notícias');
  const json = (await res.json()) as {
    Data?: {
      id: string;
      title: string;
      url: string;
      source_info?: { name?: string };
      source?: string;
    }[];
  };
  return (json.Data ?? []).slice(0, 35).map((item) => ({
    id: String(item.id),
    source: item.source_info?.name ?? item.source ?? 'Crypto News',
    title: item.title,
    url: item.url,
  }));
}

export function HomeView({
  coins,
  watchlistSet,
  onToggleFavorite,
  onOpenAsset,
  onNavigate,
}: HomeViewProps) {
  const { preferences } = usePreferences();
  const [flowMode, setFlowMode] = useState<'btc' | 'eth' | 'top5'>('btc');
  const [assetTab, setAssetTab] = useState<'all' | 'favorites' | 'gainers' | 'stables'>('all');
  const [tableSort, setTableSort] = useState<{
    field: 'marketCap' | 'price' | 'change24h' | 'volume';
    dir: 'asc' | 'desc';
  }>({ field: 'marketCap', dir: 'desc' });
  const [insightIdx, setInsightIdx] = useState(0);
  const [tickerPaused, setTickerPaused] = useState(false);
  const [fromId, setFromId] = useState<string>('bitcoin');
  const [toId, setToId] = useState<string>('ethereum');
  const [amountInput, setAmountInput] = useState<string>('0.05');

  const { data: externalNews } = useQuery({
    queryKey: ['home-crypto-news'],
    queryFn: fetchCryptoNews,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const shouldReduceMotion =
    preferences.reduceMotion === 'reduce' ||
    (preferences.reduceMotion === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const stats = useMemo(() => getMarketStats(coins), [coins]);
  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const btcCoin = useMemo(
    () => coins.find((c) => c.id === 'bitcoin' || c.symbol.toLowerCase() === 'btc') ?? coins[0] ?? null,
    [coins]
  );

  const ethCoin = useMemo(
    () => coins.find((c) => c.id === 'ethereum' || c.symbol.toLowerCase() === 'eth') ?? coins[1] ?? null,
    [coins]
  );

  const btcDominance = useMemo(() => {
    if (!btcCoin || stats.totalMarketCap <= 0) return 0;
    return (btcCoin.marketCap / stats.totalMarketCap) * 100;
  }, [btcCoin, stats.totalMarketCap]);

  const turnoverPct = useMemo(() => {
    if (stats.totalMarketCap <= 0) return 0;
    return (stats.totalVolume / stats.totalMarketCap) * 100;
  }, [stats.totalMarketCap, stats.totalVolume]);

  const breadthPct = useMemo(() => {
    if (stats.totalCoins <= 0) return 0;
    return (stats.positiveCount / stats.totalCoins) * 100;
  }, [stats.positiveCount, stats.totalCoins]);

  const topGainer = useMemo(() => {
    const nonStables = coins.filter((c) => !isStablecoin(c));
    if (nonStables.length === 0) return coins[0] ?? null;
    return [...nonStables].sort((a, b) => b.priceChange24h - a.priceChange24h)[0] ?? null;
  }, [coins]);

  const topLoser = useMemo(() => {
    const nonStables = coins.filter((c) => !isStablecoin(c));
    if (nonStables.length === 0) return null;
    return [...nonStables].sort((a, b) => a.priceChange24h - b.priceChange24h)[0] ?? null;
  }, [coins]);

  const topVolumeLeader = useMemo(() => {
    const nonStables = coins.filter((c) => !isStablecoin(c));
    if (nonStables.length === 0) return null;
    return [...nonStables].sort((a, b) => b.totalVolume - a.totalVolume)[0] ?? null;
  }, [coins]);

  const insights = useMemo(() => {
    const items: { id: string; coin: CoinMarket; text: string; badge: string; positive: boolean }[] = [];
    if (topGainer) {
      items.push({
        id: 'gainer',
        coin: topGainer,
        badge: formatPercent(topGainer.priceChange24h, preferences.numberLocale),
        positive: topGainer.priceChange24h >= 0,
        text: `Líder em 24h: ${topGainer.name} (${topGainer.symbol.toUpperCase()})`,
      });
    }
    if (topLoser) {
      items.push({
        id: 'loser',
        coin: topLoser,
        badge: formatPercent(topLoser.priceChange24h, preferences.numberLocale),
        positive: topLoser.priceChange24h >= 0,
        text: `Maior recuo em 24h: ${topLoser.name} (${topLoser.symbol.toUpperCase()})`,
      });
    }
    if (topVolumeLeader) {
      items.push({
        id: 'volume',
        coin: topVolumeLeader,
        badge: `US$ ${formatCompactNumber(topVolumeLeader.totalVolume, preferences.numberLocale)}`,
        positive: true,
        text: `Maior liquidez 24h: ${topVolumeLeader.name} (${topVolumeLeader.symbol.toUpperCase()})`,
      });
    }
    return items;
  }, [preferences.numberLocale, topGainer, topLoser, topVolumeLeader]);

  const activeInsight = insights.length > 0 ? insights[insightIdx % insights.length] : null;

  const tickerItems = useMemo<NewsTickerItem[]>(() => {
    const marketBulletins: NewsTickerItem[] = [];
    if (btcCoin) {
      marketBulletins.push({
        id: 'bulletin-btc',
        source: 'BTC',
        title: `Bitcoin negocia a US$ ${formatPrice(btcCoin.currentPrice, { locale: preferences.numberLocale, decimalMode: preferences.decimalMode })} com dominância de ${btcDominance.toFixed(1)}%`,
        coinId: btcCoin.id,
        tag: formatPercent(btcCoin.priceChange24h, preferences.numberLocale),
        positive: btcCoin.priceChange24h >= 0,
      });
    }
    if (topGainer) {
      marketBulletins.push({
        id: 'bulletin-gainer',
        source: 'Destaque',
        title: `${topGainer.name} (${topGainer.symbol.toUpperCase()}) lidera ganhos nas últimas 24h`,
        coinId: topGainer.id,
        tag: formatPercent(topGainer.priceChange24h, preferences.numberLocale),
        positive: true,
      });
    }
    if (topVolumeLeader) {
      marketBulletins.push({
        id: 'bulletin-vol',
        source: 'Liquidez',
        title: `${topVolumeLeader.name} movimenta US$ ${formatCompactNumber(topVolumeLeader.totalVolume, preferences.numberLocale)} em 24h`,
        coinId: topVolumeLeader.id,
        tag: topVolumeLeader.symbol.toUpperCase(),
        positive: true,
      });
    }
    if (topLoser) {
      marketBulletins.push({
        id: 'bulletin-loser',
        source: 'Pressão',
        title: `${topLoser.name} (${topLoser.symbol.toUpperCase()}) registra maior recuo diário`,
        coinId: topLoser.id,
        tag: formatPercent(topLoser.priceChange24h, preferences.numberLocale),
        positive: false,
      });
    }

    if (externalNews && externalNews.length > 0) {
      return [...marketBulletins, ...externalNews];
    }
    return marketBulletins;
  }, [
    btcCoin,
    btcDominance,
    externalNews,
    preferences.decimalMode,
    preferences.numberLocale,
    topGainer,
    topLoser,
    topVolumeLeader,
  ]);

  // Quick Converter state resolution
  const swapChoices = useMemo(() => coins.slice(0, 25), [coins]);
  const fromCoin = useMemo(
    () => swapChoices.find((c) => c.id === fromId) ?? swapChoices[0] ?? null,
    [fromId, swapChoices]
  );
  const toCoin = useMemo(
    () =>
      swapChoices.find((c) => c.id === toId) ??
      swapChoices[1] ??
      swapChoices[0] ??
      null,
    [swapChoices, toId]
  );

  const parsedAmount = Math.max(0, Number(amountInput.replace(',', '.')) || 0);
  const fromUsdValue = fromCoin ? parsedAmount * fromCoin.currentPrice : 0;
  const convertedAmount =
    fromCoin && toCoin && toCoin.currentPrice > 0
      ? fromUsdValue / toCoin.currentPrice
      : 0;
  const exchangeRate =
    fromCoin && toCoin && toCoin.currentPrice > 0
      ? fromCoin.currentPrice / toCoin.currentPrice
      : 0;

  // Cash Flow / Market Trend 7d Series
  const flowSeries = useMemo(() => {
    if (flowMode === 'btc' && btcCoin?.sparkline7d.length) {
      const pts = btcCoin.sparkline7d.slice(-72);
      return [
        {
          name: `${btcCoin.symbol.toUpperCase()} (USD)`,
          data: pts.map((v) => Number(v.toFixed(2))),
        },
      ];
    }

    if (flowMode === 'eth' && ethCoin?.sparkline7d.length) {
      const pts = ethCoin.sparkline7d.slice(-72);
      return [
        {
          name: `${ethCoin.symbol.toUpperCase()} (USD)`,
          data: pts.map((v) => Number(v.toFixed(2))),
        },
      ];
    }

    const top5 = coins.slice(0, 5).filter((c) => c.sparkline7d.length >= 2);
    if (top5.length === 0) return [];
    const len = Math.min(...top5.map((c) => c.sparkline7d.length), 72);
    const totalW = top5.reduce((s, c) => s + c.marketCap, 0) || 1;
    const indexCurve: number[] = [];

    for (let i = 0; i < len; i++) {
      let weighted = 0;
      for (const c of top5) {
        const slice = c.sparkline7d.slice(-len);
        const base = slice[0] || 1;
        const rel = ((slice[i] - base) / base) * 100;
        weighted += rel * (c.marketCap / totalW);
      }
      indexCurve.push(Number(weighted.toFixed(2)));
    }

    return [{ name: 'Índice Top 5 (%)', data: indexCurve }];
  }, [btcCoin, coins, ethCoin, flowMode]);

  // Assets Table filter & sort
  const tableCoins = useMemo(() => {
    let list = [...coins];
    if (assetTab === 'favorites') {
      list = list.filter((c) => watchlistSet.has(c.id));
    } else if (assetTab === 'gainers') {
      list = list.filter((c) => !isStablecoin(c) && c.priceChange24h > 0);
    } else if (assetTab === 'stables') {
      list = list.filter((c) => isStablecoin(c));
    }

    list.sort((a, b) => {
      const mul = tableSort.dir === 'desc' ? -1 : 1;
      if (tableSort.field === 'price') return (a.currentPrice - b.currentPrice) * mul;
      if (tableSort.field === 'change24h') return (a.priceChange24h - b.priceChange24h) * mul;
      if (tableSort.field === 'volume') return (a.totalVolume - b.totalVolume) * mul;
      return (a.marketCap - b.marketCap) * mul;
    });

    return list.slice(0, 8);
  }, [assetTab, coins, tableSort, watchlistSet]);

  const toggleSort = (field: 'marketCap' | 'price' | 'change24h' | 'volume') => {
    setTableSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { field, dir: 'desc' }
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Home"
        subtitle="Visão executiva do mercado em tempo real"
      />

      <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
        <div className="mx-auto w-full max-w-page space-y-5">
          {/* 1. Interactive 4-KPI Strip */}
          <section
            aria-label="Resumo do mercado"
            className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-card sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x"
          >
            <button
              type="button"
              onClick={() => onNavigate('heatmap')}
              className="group flex flex-col justify-between p-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Capitalização total
                </p>
                <ArrowUpRight
                  className="h-3.5 w-3.5 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  US$ {formatCompactNumber(stats.totalMarketCap, preferences.numberLocale)}
                </span>
                <span
                  className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    stats.avgChange24h >= 0
                      ? 'bg-positive/12 text-positive'
                      : 'bg-negative/12 text-negative'
                  }`}
                >
                  {formatPercent(stats.avgChange24h, preferences.numberLocale)}
                  {stats.avgChange24h >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                  )}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10.5px] text-muted-foreground">
                <span>Abrir Mapa de mercado</span>
                <span className="font-mono text-foreground/80">{stats.totalCoins} ativos</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('pulse')}
              className="group flex flex-col justify-between p-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-muted-foreground">Volume 24h</p>
                <ArrowUpRight
                  className="h-3.5 w-3.5 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  US$ {formatCompactNumber(stats.totalVolume, preferences.numberLocale)}
                </span>
                <span className="rounded-md bg-accent/12 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-accent">
                  {turnoverPct.toFixed(1)}% giro
                </span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, Math.max(8, turnoverPct * 4))}%` }}
                />
              </div>
            </button>

            <button
              type="button"
              onClick={() => btcCoin && onOpenAsset(btcCoin.id)}
              className="group flex flex-col justify-between p-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-muted-foreground">Dominância BTC</p>
                <ArrowUpRight
                  className="h-3.5 w-3.5 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {btcDominance.toFixed(1).replace('.', ',')}%
                </span>
                {btcCoin ? (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                      btcCoin.priceChange24h >= 0
                        ? 'bg-positive/12 text-positive'
                        : 'bg-negative/12 text-negative'
                    }`}
                  >
                    {formatPercent(btcCoin.priceChange24h, preferences.numberLocale)}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${Math.min(100, Math.max(5, btcDominance))}%` }}
                />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAssetTab((prev) => (prev === 'gainers' ? 'all' : 'gainers'))}
              className="group flex flex-col justify-between p-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-muted-foreground">Amplitude (24h)</p>
                <span className="font-mono text-[10px] text-accent">
                  {assetTab === 'gainers' ? 'Filtro: Em alta' : 'Filtrar em alta'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {stats.positiveCount}{' '}
                  <span className="text-base font-medium text-muted-foreground">
                    / {stats.totalCoins}
                  </span>
                </span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-foreground">
                  {breadthPct.toFixed(0)}% em alta
                </span>
              </div>
              <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-negative/65">
                <div
                  className="h-full bg-positive transition-all"
                  style={{ width: `${Math.min(100, Math.max(2, breadthPct))}%` }}
                />
              </div>
            </button>
          </section>

          {/* 2. Animated Live News Ticker Banner */}
          {tickerItems.length > 0 ? (
            <section
              aria-label="Notícias do mercado"
              className="ticker-group flex h-10 items-center overflow-hidden rounded-lg border border-border bg-nav/90 shadow-card"
            >
              <div className="flex h-full shrink-0 items-center gap-2 border-r border-border bg-card/90 px-3 text-[11px] font-semibold uppercase tracking-wider text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" aria-hidden="true" />
                <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Notícias</span>
              </div>

              <div className="relative min-w-0 flex-1 overflow-hidden">
                <div
                  className={
                    shouldReduceMotion
                      ? 'flex items-center gap-6 overflow-x-auto px-4'
                      : 'animate-ticker-marquee flex items-center'
                  }
                  style={
                    !shouldReduceMotion && tickerPaused
                      ? { animationPlayState: 'paused' }
                      : undefined
                  }
                >
                  {(shouldReduceMotion ? tickerItems : [...tickerItems, ...tickerItems]).map(
                    (item, idx) => {
                      const content = (
                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs">
                          <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent border border-border/70">
                            {item.source}
                          </span>
                          <span className="text-foreground/90 group-hover:text-foreground">
                            {item.title}
                          </span>
                          {item.tag ? (
                            <span
                              className={`font-mono text-[11px] font-semibold ${
                                item.positive ? 'text-positive' : 'text-negative'
                              }`}
                            >
                              {item.tag}
                            </span>
                          ) : null}
                          {item.url ? (
                            <ExternalLink
                              className="h-3 w-3 text-muted-foreground/70 group-hover:text-accent"
                              aria-hidden="true"
                            />
                          ) : null}
                        </span>
                      );

                      return (
                        <div
                          key={`${item.id}-${idx}`}
                          className="flex shrink-0 items-center gap-5 px-4"
                        >
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center transition-opacity hover:opacity-90"
                            >
                              {content}
                            </a>
                          ) : item.coinId ? (
                            <button
                              type="button"
                              onClick={() => onOpenAsset(item.coinId!)}
                              className="group inline-flex items-center transition-opacity hover:opacity-90"
                            >
                              {content}
                            </button>
                          ) : (
                            content
                          )}
                          <span className="text-border" aria-hidden="true">
                            •
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {!shouldReduceMotion ? (
                <button
                  type="button"
                  onClick={() => setTickerPaused((p) => !p)}
                  aria-label={tickerPaused ? 'Retomar notícias' : 'Pausar notícias'}
                  title={tickerPaused ? 'Retomar' : 'Pausar'}
                  className="flex h-full w-9 shrink-0 items-center justify-center border-l border-border bg-card/60 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  {tickerPaused ? (
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              ) : null}
            </section>
          ) : null}

          {/* 3. Cipher AI Insights Banner */}
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-nav px-4 py-3 shadow-card">
            <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cipher Insights</span>
              </span>
              <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
              {activeInsight ? (
                <button
                  type="button"
                  onClick={() => onOpenAsset(activeInsight.coin.id)}
                  className="flex min-w-0 items-center gap-2 text-left text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="truncate">{activeInsight.text}</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                      activeInsight.positive
                        ? 'bg-positive/12 text-positive'
                        : 'bg-negative/12 text-negative'
                    }`}
                  >
                    {activeInsight.badge}
                  </span>
                </button>
              ) : (
                <p className="truncate text-muted-foreground">
                  Explore correlações, amplitude e desempenho detalhado com o assistente Cipher.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {insights.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setInsightIdx((i) => (i + 1) % insights.length)}
                  title="Próximo insight"
                  aria-label="Próximo insight"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-card/85 text-muted-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onNavigate('research')}
                className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border/80 bg-card/85 px-3 text-xs font-medium text-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card"
              >
                <span>Abrir Cipher</span>
                <ArrowRight
                  className="h-3.5 w-3.5 text-accent transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            </div>
          </section>

          {/* 3. Main Asymmetric Bento Grid */}
          <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* Left Column: Quick Converter + Highlighted Asset */}
            <div className="flex flex-col gap-5">
              {/* Quick Converter Widget */}
              <section className="rounded-lg border border-border bg-card p-4 shadow-card">
                <div className="mb-3 grid grid-cols-4 gap-1 rounded-lg border border-border/80 bg-nav p-1 text-[11px]">
                  {PRESET_USD.map((usdVal) => {
                    const active =
                      fromCoin &&
                      fromCoin.currentPrice > 0 &&
                      Math.abs(fromUsdValue - usdVal) < usdVal * 0.02;
                    return (
                      <button
                        key={usdVal}
                        type="button"
                        onClick={() => {
                          if (!fromCoin || fromCoin.currentPrice <= 0) return;
                          const qty = usdVal / fromCoin.currentPrice;
                          setAmountInput(qty >= 1 ? qty.toFixed(2) : qty.toFixed(4));
                        }}
                        className={`rounded-md py-1 font-mono font-medium transition-colors ${
                          active
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ${usdVal >= 1000 ? `${usdVal / 1000}k` : usdVal}
                      </button>
                    );
                  })}
                </div>

                <div className="relative space-y-2">
                  {/* From Box */}
                  <div className="rounded-lg border border-border/80 bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <CustomSelect
                        ariaLabel="Ativo de origem"
                        value={fromCoin?.id ?? ''}
                        onChange={setFromId}
                        menuWidth={240}
                        className="h-8 max-w-[165px] font-semibold"
                        options={swapChoices.map((c) => ({
                          value: c.id,
                          label: `${c.symbol.toUpperCase()} · ${c.name}`,
                          iconUrl: c.image,
                        }))}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label="Quantidade de origem"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        className="w-28 bg-transparent text-right font-mono text-sm font-semibold tabular-nums text-foreground outline-none"
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Origem</span>
                      <span className="font-mono tabular-nums">
                        US$ {formatCompactNumber(fromUsdValue, preferences.numberLocale)}
                      </span>
                    </div>
                  </div>

                  {/* Swap Toggle */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (!fromCoin || !toCoin) return;
                        setFromId(toCoin.id);
                        setToId(fromCoin.id);
                      }}
                      aria-label="Inverter moedas"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-card transition-transform hover:scale-105"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  {/* To Box */}
                  <div className="rounded-lg border border-border/80 bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <CustomSelect
                        ariaLabel="Ativo de destino"
                        value={toCoin?.id ?? ''}
                        onChange={setToId}
                        menuWidth={240}
                        className="h-8 max-w-[165px] font-semibold"
                        options={swapChoices.map((c) => ({
                          value: c.id,
                          label: `${c.symbol.toUpperCase()} · ${c.name}`,
                          iconUrl: c.image,
                        }))}
                      />
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {convertedAmount >= 1
                          ? convertedAmount.toFixed(3)
                          : convertedAmount.toFixed(5)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Destino estimado</span>
                      <span className="font-mono tabular-nums">
                        {toCoin ? toCoin.symbol.toUpperCase() : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {fromCoin && toCoin ? (
                  <p className="mt-3 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
                    1 {fromCoin.symbol.toUpperCase()} ={' '}
                    {exchangeRate >= 1 ? exchangeRate.toFixed(3) : exchangeRate.toFixed(5)}{' '}
                    {toCoin.symbol.toUpperCase()}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => onNavigate('converter')}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-xs font-semibold text-accent-foreground shadow-card transition-opacity hover:opacity-90"
                >
                  <span>Conversor completo</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </section>

              {/* Top Gainer & Top Loser Highlighted Asset Cards */}
              {topGainer || topLoser ? (
                <div className="flex flex-1 flex-col gap-4">
                  {[
                    topGainer
                      ? {
                          coin: topGainer,
                          label: 'Maior alta em 24h',
                          positive: true,
                        }
                      : null,
                    topLoser
                      ? {
                          coin: topLoser,
                          label: 'Maior baixa em 24h',
                          positive: false,
                        }
                      : null,
                  ]
                    .filter((item): item is { coin: CoinMarket; label: string; positive: boolean } =>
                      Boolean(item)
                    )
                    .map(({ coin: item, label, positive }) => (
                      <section
                        key={label}
                        className="flex flex-1 flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-card"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {label}
                            </span>
                            {positive ? (
                              <TrendingUp className="h-3.5 w-3.5 text-positive" aria-hidden="true" />
                            ) : (
                              <TrendingDown
                                className="h-3.5 w-3.5 text-negative"
                                aria-hidden="true"
                              />
                            )}
                          </div>

                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <img
                                src={item.image}
                                alt=""
                                width={30}
                                height={30}
                                className="h-7.5 w-7.5 shrink-0 rounded-full bg-muted object-cover"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {item.name}
                                </p>
                                <p className="font-mono text-[11px] text-muted-foreground">
                                  {item.symbol.toUpperCase()}
                                  {item.marketCapRank ? ` · #${item.marketCapRank}` : ''}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                                positive
                                  ? 'bg-positive/15 text-positive'
                                  : 'bg-negative/15 text-negative'
                              }`}
                            >
                              {formatPercent(item.priceChange24h, preferences.numberLocale)}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/60 pt-2.5">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Preço atual
                              </p>
                              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-foreground">
                                US$ {formatPrice(item.currentPrice, fmtOpts)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Volume 24h
                              </p>
                              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-foreground">
                                US$ {formatCompactNumber(item.totalVolume, preferences.numberLocale)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                          <button
                            type="button"
                            onClick={() => onOpenAsset(item.id)}
                            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                          >
                            <span>Inspecionar ativo</span>
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate('heatmap')}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            Mapa →
                          </button>
                        </div>
                      </section>
                    ))}
                </div>
              ) : null}
            </div>

            {/* Right Column: 7d Trend Chart + Accounts/Market Assets Table */}
            <div className="flex min-w-0 flex-col gap-5">
              {/* Trend Chart */}
              <section className="rounded-lg border border-border bg-card p-5 shadow-card">
                <ChartCardHeader
                  title={
                    flowMode === 'btc'
                      ? 'Tendência BTC (7 dias)'
                      : flowMode === 'eth'
                        ? 'Tendência ETH (7 dias)'
                        : 'Índice ponderado Top 5 (7 dias)'
                  }
                  subtitle="Curva horária dos últimos 7 dias com dados reais de mercado"
                  right={
                    <div className="flex items-center gap-2">
                      <HeaderSegmented
                        value={flowMode}
                        onChange={setFlowMode}
                        tone="surface"
                        options={[
                          { id: 'btc', label: 'BTC' },
                          { id: 'eth', label: 'ETH' },
                          { id: 'top5', label: 'Top 5' },
                        ]}
                      />
                      <button
                        type="button"
                        onClick={() => onNavigate('analytics')}
                        className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card/85 px-2.5 text-xs font-medium text-muted-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card hover:text-foreground"
                      >
                        <span>Analytics</span>
                        <ArrowRight className="h-3 w-3 group-hover:text-accent" aria-hidden="true" />
                      </button>
                    </div>
                  }
                />

                <div className="h-64 w-full">
                  <ApexChartWrapper
                    type="area"
                    series={flowSeries}
                    options={
                      {
                        colors: [
                          flowMode === 'btc'
                            ? '#34D399'
                            : flowMode === 'eth'
                              ? '#818CF8'
                              : '#82B4FF',
                        ],
                        stroke: { curve: 'smooth', width: 2 },
                        fill: {
                          type: 'gradient',
                          gradient: {
                            shadeIntensity: 1,
                            opacityFrom: 0.28,
                            opacityTo: 0.02,
                            stops: [0, 100],
                          },
                        },
                        xaxis: { type: 'numeric', labels: { show: false } },
                        yaxis: {
                          labels: {
                            formatter: (v: number) =>
                              flowMode === 'top5'
                                ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
                                : `$${formatCompactNumber(v, preferences.numberLocale)}`,
                          },
                        },
                      } satisfies ApexOptions
                    }
                  />
                </div>
              </section>

              {/* Market Assets Table */}
              <section className="flex-1 rounded-lg border border-border bg-card p-5 shadow-card">
                <ChartCardHeader
                  title="Principais ativos"
                  subtitle="Clique em qualquer ativo para abrir a visão detalhada"
                  right={
                    <div className="flex flex-wrap items-center gap-2">
                      <HeaderSegmented
                        value={assetTab}
                        onChange={setAssetTab}
                        tone="surface"
                        options={[
                          { id: 'all', label: 'Todos' },
                          { id: 'favorites', label: 'Favoritos' },
                          { id: 'gainers', label: 'Em alta' },
                          { id: 'stables', label: 'Estáveis' },
                        ]}
                      />
                      <button
                        type="button"
                        onClick={() => onNavigate('monitor')}
                        className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card/85 px-2.5 text-xs font-medium text-muted-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card hover:text-foreground"
                      >
                        <span>Ver todos</span>
                        <ArrowRight className="h-3 w-3 group-hover:text-accent" aria-hidden="true" />
                      </button>
                    </div>
                  }
                />

                {tableCoins.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                    Nenhum ativo encontrado neste filtro.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="border-b border-border text-[11px] font-medium text-muted-foreground">
                        <tr>
                          <th className="w-7 py-2 pr-1">
                            <span className="sr-only">Favorito</span>
                          </th>
                          <th className="py-2 pr-3">Ativo</th>
                          <th className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => toggleSort('price')}
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              <span>Preço</span>
                              {tableSort.field === 'price' ? (
                                tableSort.dir === 'desc' ? (
                                  <ArrowDown className="h-3 w-3 text-accent" />
                                ) : (
                                  <ArrowUp className="h-3 w-3 text-accent" />
                                )
                              ) : null}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => toggleSort('change24h')}
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              <span>24h (%)</span>
                              {tableSort.field === 'change24h' ? (
                                tableSort.dir === 'desc' ? (
                                  <ArrowDown className="h-3 w-3 text-accent" />
                                ) : (
                                  <ArrowUp className="h-3 w-3 text-accent" />
                                )
                              ) : null}
                            </button>
                          </th>
                          <th className="hidden px-3 py-2 text-right sm:table-cell">
                            <button
                              type="button"
                              onClick={() => toggleSort('volume')}
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              <span>Vol. 24h</span>
                              {tableSort.field === 'volume' ? (
                                tableSort.dir === 'desc' ? (
                                  <ArrowDown className="h-3 w-3 text-accent" />
                                ) : (
                                  <ArrowUp className="h-3 w-3 text-accent" />
                                )
                              ) : null}
                            </button>
                          </th>
                          <th className="py-2 pl-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleSort('marketCap')}
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              <span>Cap. USD</span>
                              {tableSort.field === 'marketCap' ? (
                                tableSort.dir === 'desc' ? (
                                  <ArrowDown className="h-3 w-3 text-accent" />
                                ) : (
                                  <ArrowUp className="h-3 w-3 text-accent" />
                                )
                              ) : null}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70 tabular-nums">
                        {tableCoins.map((coin) => {
                          const isPos = coin.priceChange24h >= 0;
                          const isFav = watchlistSet.has(coin.id);
                          return (
                            <tr
                              key={coin.id}
                              onClick={() => onOpenAsset(coin.id)}
                              className="cursor-pointer transition-colors hover:bg-muted/40"
                            >
                              <td
                                className="py-2.5 pr-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleFavorite(coin.id);
                                }}
                              >
                                <button
                                  type="button"
                                  aria-label={isFav ? `Remover ${coin.name} dos favoritos` : `Favoritar ${coin.name}`}
                                  aria-pressed={isFav}
                                  className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors ${
                                    isFav ? 'text-accent' : 'text-muted-foreground/45 hover:text-foreground'
                                  }`}
                                >
                                  <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-current' : ''}`} aria-hidden="true" />
                                </button>
                              </td>
                              <td className="py-2.5 pr-3">
                                <div className="flex items-center gap-2.5">
                                  <img
                                    src={coin.image}
                                    alt=""
                                    width={22}
                                    height={22}
                                    loading="lazy"
                                    className="h-5.5 w-5.5 shrink-0 rounded-full bg-muted object-cover"
                                  />
                                  <span className="font-medium text-foreground">{coin.name}</span>
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {coin.symbol.toUpperCase()}
                                  </span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-foreground">
                                US$ {formatPrice(coin.currentPrice, fmtOpts)}
                              </td>
                              <td
                                className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums ${
                                  isPos ? 'text-positive' : 'text-negative'
                                }`}
                              >
                                {formatPercent(coin.priceChange24h, preferences.numberLocale)}
                              </td>
                              <td className="hidden whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                                US$ {formatCompactNumber(coin.totalVolume, preferences.numberLocale)}
                              </td>
                              <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular-nums text-foreground">
                                US$ {formatCompactNumber(coin.marketCap, preferences.numberLocale)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
