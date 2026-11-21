import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApexOptions } from 'apexcharts';
import {
  ArrowLeft,
  Bell,
  ExternalLink,
  FileText,
  GitCompare,
  Maximize2,
  MoreHorizontal,
  Star,
  X,
} from 'lucide-react';
import type { AssetChartPoint, CoinMarket } from '../../types/crypto';
import {
  fetchAssetChart,
  fetchAssetOhlc,
} from '../../services/coingecko';
import { readAnyCache } from '../../lib/cache';
import { downloadChartPng, downloadChartSvg, downloadCsvRows } from '../../lib/analytics';
import { useCoinProfile } from '../../hooks/useCoinDescription';
import { usePreferences } from '../../hooks/usePreferences';
import { AssetNewsTab } from './AssetNewsTab';
import { AssetHistoryDashboard } from './AssetHistoryDashboard';
import { AssetAboutTab } from './AssetAboutTab';
import { scrapeCoinNews } from '../../services/assetNews';
import { PageHeader, HeaderSegmented } from '../shell/PageHeader';
import {
  formatCompactNumber,
  formatCurrencyUSD,
  formatDateShort,
  formatDateTimeFull,
  formatPercent,
  formatPrice,
  formatTime,
} from '../../lib/formatters';
import { ApexChartWrapper } from '../analytics/ApexChartWrapper';

interface AssetViewProps {
  coin: CoinMarket;
  allCoins: CoinMarket[];
  fetchedAt?: number;
  favorite: boolean;
  onToggleFavorite: (coinId: string) => void;
  onCreateAlert: (coinId: string) => void;
  onCompareAsset: (coinId: string) => void;
  onOpenReportWithContext?: (
    coinIds: string[],
    days: '7' | '30' | '90' | '365',
    note?: string
  ) => void;
  onBack: () => void;
}

type AssetTab = 'overview' | 'history' | 'news' | 'about';
type ChartRange = '1' | '7' | '30' | '365' | 'max';
type OhlcRange = '7' | '14' | '30' | '90';
type ChartUnitMode = 'price' | 'return';

const CHART_RANGES: { id: ChartRange; label: string }[] = [
  { id: '1', label: '24h' },
  { id: '7', label: '7D' },
  { id: '30', label: '30D' },
  { id: '365', label: '1A' },
  { id: 'max', label: 'Tudo' },
];

function mapRangeToReportDays(range: ChartRange): '7' | '30' | '90' | '365' {
  if (range === '1' || range === '7') return '7';
  if (range === '30') return '30';
  return '365';
}

function getSignatureColor(coin: CoinMarket): string {
  const sym = coin.symbol.toLowerCase();
  if (sym === 'btc' || coin.id === 'bitcoin') return '#F7931A';
  if (sym === 'eth' || coin.id === 'ethereum') return '#627EEA';
  if (sym === 'sol' || coin.id === 'solana') return '#14F195';
  return '#82B4FF';
}

export function AssetView({
  coin,
  allCoins,
  fetchedAt,
  favorite,
  onToggleFavorite,
  onCreateAlert,
  onCompareAsset,
  onOpenReportWithContext,
  onBack,
}: AssetViewProps) {
  const { preferences } = usePreferences();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AssetTab>('overview');
  const [range, setRange] = useState<ChartRange>('7');
  const [unitMode, setUnitMode] = useState<ChartUnitMode>('price');
  const [compareCoinId, setCompareCoinId] = useState<string | null>(null);
  const [comparePickerOpen, setComparePickerOpen] = useState(false);
  const [compareSearch, setCompareSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [ohlcRange, setOhlcRange] = useState<OhlcRange>('30');
  const [showSma7, setShowSma7] = useState(false);
  const [showSma21, setShowSma21] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [selectedSlice, setSelectedSlice] = useState<{ startTs: number; endTs: number } | null>(
    null
  );

  const chartBoxRef = useRef<HTMLDivElement>(null);

  const fmtOpts = useMemo(
    () => ({
      locale: preferences.numberLocale,
      decimalMode: preferences.decimalMode,
    }),
    [preferences.numberLocale, preferences.decimalMode]
  );

  const isBtc = coin.symbol.toLowerCase() === 'btc' || coin.id === 'bitcoin';
  const primaryColor = getSignatureColor(coin);

  const defaultCompareCoin = useMemo(() => {
    const targetId = isBtc ? 'ethereum' : 'bitcoin';
    return (
      allCoins.find((c) => c.id === targetId && c.id !== coin.id) ??
      allCoins.find((c) => c.id !== coin.id) ??
      null
    );
  }, [allCoins, coin.id, isBtc]);

  const compareCoin = useMemo(
    () => (compareCoinId ? allCoins.find((c) => c.id === compareCoinId) ?? null : null),
    [allCoins, compareCoinId]
  );

  // AAA synchronous cache hydration for primary asset
  const primaryCacheKey = `chart-full:${coin.id}:${range}`;
  const cachedPrimary = readAnyCache<{ prices: AssetChartPoint[] }>(primaryCacheKey);

  const {
    data: chartPoints,
    isLoading: isChartLoading,
    isError: isChartError,
  } = useQuery({
    queryKey: ['asset-chart', coin.id, range],
    queryFn: () => fetchAssetChart(coin.id, range),
    initialData: cachedPrimary?.data?.prices,
    initialDataUpdatedAt: cachedPrimary?.savedAt,
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: true,
  });

  // JIT query for comparison asset (only when user activates Compare)
  const compareCacheKey = compareCoin ? `chart-full:${compareCoin.id}:${range}` : '';
  const cachedCompare = compareCoin
    ? readAnyCache<{ prices: AssetChartPoint[] }>(compareCacheKey)
    : undefined;

  const { data: comparePoints, isFetching: isCompareFetching } = useQuery({
    queryKey: ['asset-chart', compareCoin?.id ?? 'none', range],
    queryFn: () => fetchAssetChart(compareCoin!.id, range),
    initialData: cachedCompare?.data?.prices,
    initialDataUpdatedAt: cachedCompare?.savedAt,
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: tab === 'overview' && Boolean(compareCoin),
  });

  const {
    data: ohlcCandles,
    isLoading: isOhlcLoading,
    isError: isOhlcError,
  } = useQuery({
    queryKey: ['asset-ohlc', coin.id, ohlcRange],
    queryFn: () => fetchAssetOhlc(coin.id, ohlcRange),
    staleTime: 15 * 60_000,
    retry: 1,
    enabled: true,
  });

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useCoinProfile(coin.id, true);

  // Background JIT scraping for the News tab as soon as the asset is selected
  useQuery({
    queryKey: ['asset-news-scrape', coin.id, coin.symbol],
    queryFn: () => scrapeCoinNews(coin.name, coin.symbol),
    staleTime: 5 * 60_000,
    gcTime: 20 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Clear asset-specific queries from cache when leaving the coin
  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: ['asset-news-scrape', coin.id, coin.symbol] });
      queryClient.removeQueries({ queryKey: ['asset-ohlc', coin.id] });
      queryClient.removeQueries({ queryKey: ['asset-chart', coin.id] });
      queryClient.removeQueries({ queryKey: ['coin-profile', coin.id] });
    };
  }, [coin.id, coin.symbol, queryClient]);

  // Effective unit mode: force 'return' when comparing two assets
  const effectiveUnitMode: ChartUnitMode = compareCoin ? 'return' : unitMode;

  // Period return from first to last sample
  const periodReturnPct = useMemo(() => {
    if (!chartPoints || chartPoints.length < 2) return null;
    const first = chartPoints[0].price;
    const last = chartPoints[chartPoints.length - 1].price;
    if (first <= 0) return null;
    return ((last - first) / first) * 100;
  }, [chartPoints]);

  // Snap selected slice to real samples
  const snappedSlice = useMemo(() => {
    if (!selectedSlice || !chartPoints || chartPoints.length < 2) return null;
    const minTs = Math.min(selectedSlice.startTs, selectedSlice.endTs);
    const maxTs = Math.max(selectedSlice.startTs, selectedSlice.endTs);
    const inRange = chartPoints.filter((pt) => pt.timestamp >= minTs && pt.timestamp <= maxTs);
    const slicePts =
      inRange.length >= 2
        ? inRange
        : chartPoints.slice(
          Math.max(
            0,
            chartPoints.findIndex((p) => p.timestamp >= minTs)
          )
        );
    if (slicePts.length < 2) return null;
    const startPt = slicePts[0];
    const endPt = slicePts[slicePts.length - 1];
    const changePct =
      startPt.price > 0 ? ((endPt.price - startPt.price) / startPt.price) * 100 : 0;
    return {
      startPt,
      endPt,
      changePct,
      points: slicePts,
    };
  }, [chartPoints, selectedSlice]);

  // Base timestamp for 0% normalization: start of selected slice (if comparing in slice) or start of range
  const returnBaseTimestamp = snappedSlice?.startPt.timestamp ?? chartPoints?.[0]?.timestamp ?? 0;

  const chartSeries = useMemo(() => {
    if (!chartPoints || chartPoints.length === 0) return [];

    const buildSeriesData = (pts: AssetChartPoint[], isReturn: boolean): [number, number][] => {
      if (!isReturn) {
        return pts.map((pt) => [pt.timestamp, Number(pt.price.toFixed(4))]);
      }
      const basePt = pts.find((pt) => pt.timestamp >= returnBaseTimestamp) ?? pts[0];
      const basePrice = basePt?.price || 1;
      return pts.map((pt) => [
        pt.timestamp,
        Number((((pt.price - basePrice) / basePrice) * 100).toFixed(2)),
      ]);
    };

    const result: { name: string; color: string; data: [number, number][] }[] = [
      {
        name: coin.symbol.toUpperCase(),
        color: primaryColor,
        data: buildSeriesData(chartPoints, effectiveUnitMode === 'return'),
      },
    ];

    if (compareCoin && comparePoints && comparePoints.length > 0) {
      result.push({
        name: compareCoin.symbol.toUpperCase(),
        color: '#34D399',
        data: buildSeriesData(comparePoints, true),
      });
    } else if (effectiveUnitMode === 'price') {
      const calcSma = (pts: AssetChartPoint[], period: number): [number, number][] =>
        pts
          .map((pt, idx) => {
            if (idx < period - 1) return null;
            let sum = 0;
            for (let j = idx - period + 1; j <= idx; j++) sum += pts[j].price;
            return [pt.timestamp, Number((sum / period).toFixed(4))] as [number, number];
          })
          .filter((x): x is [number, number] => x !== null);

      if (showSma7) {
        result.push({ name: 'MM 7', color: '#38BDF8', data: calcSma(chartPoints, 7) });
      }
      if (showSma21) {
        result.push({ name: 'MM 21', color: '#A78BFA', data: calcSma(chartPoints, 21) });
      }
      if (showBollinger) {
        const period = 20;
        const upper: [number, number][] = [];
        const lower: [number, number][] = [];
        for (let i = period - 1; i < chartPoints.length; i++) {
          let sum = 0;
          for (let j = i - period + 1; j <= i; j++) sum += chartPoints[j].price;
          const mean = sum / period;
          let sq = 0;
          for (let j = i - period + 1; j <= i; j++) {
            const diff = chartPoints[j].price - mean;
            sq += diff * diff;
          }
          const std = Math.sqrt(sq / period);
          upper.push([chartPoints[i].timestamp, Number((mean + 2 * std).toFixed(4))]);
          lower.push([chartPoints[i].timestamp, Number((mean - 2 * std).toFixed(4))]);
        }
        result.push({ name: 'Banda Sup (20)', color: '#94A3B8', data: upper });
        result.push({ name: 'Banda Inf (20)', color: '#64748B', data: lower });
      }
    }

    return result;
  }, [
    chartPoints,
    coin.symbol,
    compareCoin,
    comparePoints,
    effectiveUnitMode,
    primaryColor,
    returnBaseTimestamp,
    showBollinger,
    showSma21,
    showSma7,
  ]);

  const chartOptions = useMemo<ApexOptions>(() => {
    const primaryData = chartSeries[0]?.data ?? [];
    const lastPt = primaryData[primaryData.length - 1];

    const pointAnnotations: NonNullable<ApexOptions['annotations']>['points'] = [];
    if (lastPt) {
      pointAnnotations.push({
        x: lastPt[0],
        y: lastPt[1],
        marker: {
          size: 5,
          fillColor: primaryColor,
          strokeColor: '#0F141B',
          strokeWidth: 2,
        },
        label: {
          borderColor: primaryColor,
          offsetY: 0,
          offsetX: -8,
          style: {
            color: '#0F141B',
            background: primaryColor,
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
          },
          text:
            effectiveUnitMode === 'return'
              ? `${coin.symbol.toUpperCase()} ${formatPercent(lastPt[1], preferences.numberLocale)}`
              : formatPrice(lastPt[1], fmtOpts),
        },
      });
    }

    if (compareCoin && chartSeries[1]?.data.length) {
      const lastCmp = chartSeries[1].data[chartSeries[1].data.length - 1];
      pointAnnotations.push({
        x: lastCmp[0],
        y: lastCmp[1],
        marker: {
          size: 4,
          fillColor: '#34D399',
          strokeColor: '#0F141B',
          strokeWidth: 2,
        },
        label: {
          borderColor: '#34D399',
          offsetY: 16,
          offsetX: -8,
          style: {
            color: '#0F141B',
            background: '#34D399',
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
          },
          text: `${compareCoin.symbol.toUpperCase()} ${formatPercent(lastCmp[1], preferences.numberLocale)}`,
        },
      });
    }

    const xaxisAnnotations: NonNullable<ApexOptions['annotations']>['xaxis'] = snappedSlice
      ? [
        {
          x: snappedSlice.startPt.timestamp,
          x2: snappedSlice.endPt.timestamp,
          fillColor: '#38BDF8',
          opacity: 0.14,
          borderColor: '#38BDF8',
          label: {
            text: 'Trecho selecionado',
            style: {
              color: '#0F141B',
              background: '#38BDF8',
              fontSize: '10px',
              fontWeight: 600,
            },
          },
        },
      ]
      : [];

    return {
      chart: {
        id: `asset-main-${coin.id}`,
        selection: {
          enabled: true,
          type: 'x',
          fill: {
            color: '#38BDF8',
            opacity: 0.16,
          },
          stroke: {
            width: 1,
            dashArray: 3,
            color: '#38BDF8',
            opacity: 0.7,
          },
        },
        events: {
          selection: (_ctx, opts) => {
            const xaxis = opts?.xaxis;
            if (xaxis && Number.isFinite(xaxis.min) && Number.isFinite(xaxis.max)) {
              setSelectedSlice({ startTs: xaxis.min, endTs: xaxis.max });
            }
          },
        },
      },
      stroke: {
        curve: 'smooth',
        width: [2.25, 1.85],
      },
      annotations: {
        points: pointAnnotations,
        xaxis: xaxisAnnotations,
      },
      xaxis: {
        type: 'datetime',
        tickAmount: range === '7' ? 6 : undefined,
        labels: {
          datetimeUTC: false,
          formatter: (_val: string, ts?: number) => {
            if (!ts) return '';
            return range === '1'
              ? formatTime(ts, preferences.timezone).slice(0, 5)
              : formatDateShort(ts, preferences.timezone);
          },
        },
      },
      yaxis: {
        opposite: false,
        labels: {
          formatter: (val: number) =>
            effectiveUnitMode === 'return'
              ? `${val > 0 ? '+' : ''}${val.toFixed(1)}%`
              : formatPrice(val, fmtOpts),
        },
      },
      tooltip: {
        shared: true,
        x: {
          formatter: (ts: number) => formatDateTimeFull(Number(ts), preferences.timezone),
        },
        y: {
          formatter: (val: number) =>
            effectiveUnitMode === 'return'
              ? formatPercent(Number(val ?? 0), preferences.numberLocale)
              : formatCurrencyUSD(Number(val ?? 0), fmtOpts),
        },
      },
      legend: {
        show: Boolean(compareCoin),
        position: 'top',
        horizontalAlign: 'left',
      },
    };
  }, [
    chartSeries,
    coin.id,
    coin.symbol,
    compareCoin,
    effectiveUnitMode,
    fmtOpts,
    preferences.numberLocale,
    preferences.timezone,
    primaryColor,
    range,
    snappedSlice,
  ]);

  // 24h trading range calculation
  const rangeSpan = Math.max(coin.high24h - coin.low24h, 0);
  const aboveLow = Math.max(coin.currentPrice - coin.low24h, 0);
  const rangePct =
    rangeSpan > 0 ? Math.min(100, Math.max(0, (aboveLow / rangeSpan) * 100)) : 50;

  const isPositive = coin.priceChange24h > 0;
  const isNegative = coin.priceChange24h < 0;

  const exportSeriesCsv = () => {
    if (!chartPoints || chartPoints.length === 0) return;
    downloadCsvRows(
      `${coin.symbol.toLowerCase()}-${range}d.csv`,
      ['data_hora', 'preco_usd'],
      chartPoints.map((pt) => [
        formatDateTimeFull(pt.timestamp, preferences.timezone),
        pt.price,
      ])
    );
  };

  const exportHistoryCsv = () => {
    if (!ohlcCandles || ohlcCandles.length === 0) return;
    downloadCsvRows(
      `${coin.symbol.toLowerCase()}-historico-${ohlcRange}d.csv`,
      ['data_hora', 'abertura_usd', 'maxima_usd', 'minima_usd', 'fechamento_usd'],
      ohlcCandles.map((c) => [
        formatDateTimeFull(c.timestamp, preferences.timezone),
        c.open,
        c.high,
        c.low,
        c.close,
      ])
    );
  };

  const handleOpenReport = (fromSlice: boolean) => {
    if (!onOpenReportWithContext) return;
    const ids = compareCoin ? [coin.id, compareCoin.id] : [coin.id];
    const reportDays = mapRangeToReportDays(range);
    const note =
      fromSlice && snappedSlice
        ? `Recorte ${formatDateTimeFull(snappedSlice.startPt.timestamp, preferences.timezone)} a ${formatDateTimeFull(snappedSlice.endPt.timestamp, preferences.timezone)} (${formatPercent(snappedSlice.changePct, preferences.numberLocale)})`
        : undefined;
    onOpenReportWithContext(ids, reportDays, note);
  };

  return (
    <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
      <PageHeader
        leading={
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-foreground shadow-card transition-colors hover:bg-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Monitor</span>
            </button>
            <span>/</span>
            <span className="font-medium text-foreground">{coin.name}</span>
          </nav>
        }
      />
      <div className="mx-auto w-full max-w-page space-y-5">
        {/* Asset Header: Identity + Actions on Asset */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-start gap-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-card p-1 shadow-card"
              style={{ borderColor: isBtc ? '#F7931A' : undefined }}
            >
              <img
                src={coin.image}
                alt={`${coin.name} logo`}
                width={34}
                height={34}
                className="h-8 w-8 rounded-full"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold leading-none tracking-tight text-foreground">{coin.name}</h1>
                <span
                  className="rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase"
                  style={{
                    color: primaryColor,
                    backgroundColor: `${primaryColor}1A`,
                  }}
                >
                  {coin.symbol}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  #{coin.marketCapRank} por capitalização
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-baseline gap-3 tabular-nums">
                <span className="text-2xl font-semibold tracking-tight text-foreground">
                  {formatCurrencyUSD(coin.currentPrice, fmtOpts)}
                </span>
                <span
                  className={`text-sm font-semibold ${isPositive
                      ? 'text-positive'
                      : isNegative
                        ? 'text-negative'
                        : 'text-muted-foreground'
                    }`}
                >
                  {formatPercent(coin.priceChange24h, preferences.numberLocale)} em 24h
                </span>
              </div>

              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                Última cotação {fetchedAt ? formatTime(fetchedAt, preferences.timezone) : '--:--:--'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(coin.id)}
              aria-pressed={favorite}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium shadow-card transition-colors ${favorite
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-card text-foreground hover:bg-muted'
                }`}
            >
              <Star className={`h-3.5 w-3.5 ${favorite ? 'fill-current' : ''}`} aria-hidden="true" />
              <span>{favorite ? 'Favoritado' : 'Favoritar'}</span>
            </button>
            <button
              type="button"
              onClick={() => onCreateAlert(coin.id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground shadow-card hover:bg-muted"
            >
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              <span>+ Criar alerta</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-border text-xs">
          {(
            [
              { id: 'overview', label: 'Visão geral' },
              { id: 'history', label: 'Histórico' },
              { id: 'news', label: 'Notícias' },
              { id: 'about', label: 'Sobre o ativo' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-3.5 py-2 font-medium transition-colors ${tab === t.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' ? (
          <div className="space-y-4">
            {/* Full-Width Primary Chart Card */}
            <div className="rounded-md border border-border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Evolução do preço</h2>
                    {periodReturnPct !== null ? (
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${periodReturnPct >= 0
                            ? 'bg-positive/10 text-positive'
                            : 'bg-negative/10 text-negative'
                          }`}
                      >
                        {formatPercent(periodReturnPct, preferences.numberLocale)} em{' '}
                        {CHART_RANGES.find((r) => r.id === range)?.label}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {coin.name} em USD ({preferences.timezone}) · Arraste sobre o gráfico para
                    selecionar um trecho
                  </p>
                </div>

                {/* Chart Actions */}
                <div className="relative flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setComparePickerOpen((p) => !p)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium shadow-sm transition-all ${
                      compareCoin
                        ? 'border-accent/60 bg-accent/15 text-accent'
                        : 'border-border/80 bg-background/70 text-foreground hover:border-accent/45 hover:bg-muted/80'
                      }`}
                  >
                    <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {compareCoin
                        ? `Comparando: ${compareCoin.symbol.toUpperCase()}`
                        : 'Comparar +'}
                    </span>
                  </button>

                  {compareCoin ? (
                    <button
                      type="button"
                      onClick={() => setCompareCoinId(null)}
                      title="Remover comparação"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background/70 text-muted-foreground shadow-sm transition-all hover:border-negative/50 hover:text-negative"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setFullscreenOpen(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-3 text-xs font-medium text-foreground shadow-sm transition-all hover:border-accent/45 hover:bg-muted/80"
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tela cheia</span>
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      aria-label="Mais opções de exportação"
                      onClick={() => setMenuOpen((p) => !p)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background/70 text-muted-foreground shadow-sm transition-all hover:border-accent/45 hover:bg-muted/80 hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {menuOpen ? (
                      <div className="absolute right-0 top-9 z-20 w-48 rounded-lg border border-border/90 bg-card/95 p-1.5 text-xs shadow-xl backdrop-blur-md">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            downloadChartPng(
                              chartBoxRef.current,
                              `${coin.name} · Evolução`,
                              CHART_RANGES.find((r) => r.id === range)?.label ?? '',
                              `${coin.symbol.toLowerCase()}-${range}d.png`
                            );
                          }}
                          className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-foreground transition-colors hover:bg-muted"
                        >
                          Exportar PNG
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            downloadChartSvg(
                              chartBoxRef.current,
                              `${coin.name} · Evolução`,
                              CHART_RANGES.find((r) => r.id === range)?.label ?? '',
                              `${coin.symbol.toLowerCase()}-${range}d.svg`
                            );
                          }}
                          className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-foreground transition-colors hover:bg-muted"
                        >
                          Exportar SVG
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            exportSeriesCsv();
                          }}
                          className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-foreground transition-colors hover:bg-muted"
                        >
                          Exportar CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onCompareAsset(coin.id);
                          }}
                          className="mt-1 flex w-full items-center rounded-md border-t border-border/70 px-2.5 pt-2 pb-1.5 text-left font-medium text-accent transition-colors hover:bg-muted"
                        >
                          Abrir no Comparador
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Compare Picker Popover */}
                  {comparePickerOpen ? (
                    <div className="absolute right-0 top-9 z-20 w-64 rounded-lg border border-border/90 bg-card/95 p-2.5 text-xs shadow-xl backdrop-blur-md">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Comparar no gráfico (retorno %)
                      </p>
                      <input
                        type="text"
                        value={compareSearch}
                        onChange={(e) => setCompareSearch(e.target.value)}
                        placeholder="Filtrar moeda ou ticker..."
                        className="mb-2 h-7 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
                      />
                      <div className="max-h-48 space-y-0.5 overflow-y-auto">
                        {allCoins
                          .filter((c) => {
                            if (c.id === coin.id) return false;
                            const q = compareSearch.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              c.name.toLowerCase().includes(q) ||
                              c.symbol.toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 60)
                          .map((candidate) => (
                            <button
                              key={candidate.id}
                              type="button"
                              onClick={() => {
                                setCompareCoinId(candidate.id);
                                setComparePickerOpen(false);
                                setCompareSearch('');
                              }}
                              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-muted ${
                                compareCoinId === candidate.id ? 'bg-accent/15 text-accent' : ''
                              }`}
                            >
                              <span className="truncate font-medium">{candidate.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {candidate.symbol.toUpperCase()}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Range + Price/Return Controls */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-border/60 pt-3">
                <HeaderSegmented
                  value={range}
                  onChange={(next) => {
                    setRange(next as ChartRange);
                    setSelectedSlice(null);
                  }}
                  mono
                  options={CHART_RANGES}
                />

                <div className="flex flex-wrap items-center gap-2">
                  {!compareCoin && effectiveUnitMode === 'price' ? (
                    <div className="inline-flex h-8 items-center gap-1 rounded-lg border border-border/80 bg-background/70 p-1 text-[11px] shadow-sm">
                      <button
                        type="button"
                        onClick={() => setShowSma7((v) => !v)}
                        className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 font-mono font-medium transition-all ${
                          showSma7
                            ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                          }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden="true" />
                        <span>MM 7</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSma21((v) => !v)}
                        className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 font-mono font-medium transition-all ${
                          showSma21
                            ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                          }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400" aria-hidden="true" />
                        <span>MM 21</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBollinger((v) => !v)}
                        className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 font-mono font-medium transition-all ${
                          showBollinger
                            ? 'bg-slate-500/25 text-foreground ring-1 ring-slate-400/40'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                          }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                        <span>Bollinger</span>
                      </button>
                    </div>
                  ) : null}

                  <div className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border/80 bg-background/70 p-1 text-[11px] shadow-sm">
                    <button
                      type="button"
                      disabled={Boolean(compareCoin)}
                      onClick={() => setUnitMode('price')}
                      className={`h-6 rounded-md px-3 font-medium transition-all disabled:opacity-50 ${
                        effectiveUnitMode === 'price'
                          ? 'bg-card text-foreground shadow-card ring-1 ring-border/70'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Preço
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnitMode('return')}
                      className={`h-6 rounded-md px-3 font-medium transition-all ${
                        effectiveUnitMode === 'return'
                          ? 'bg-card text-foreground shadow-card ring-1 ring-border/70'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Retorno
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Chart Canvas (340px) */}
              <div ref={chartBoxRef} className="mt-3 h-[340px] w-full">
                {isChartLoading ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Carregando série histórica...
                  </div>
                ) : isChartError || !chartPoints || chartPoints.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Não foi possível carregar o gráfico para este período.
                  </div>
                ) : (
                  <ApexChartWrapper type="line" series={chartSeries} options={chartOptions} />
                )}
              </div>

              {isCompareFetching ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Sincronizando série de comparação...
                </p>
              ) : null}
            </div>

            {/* Interactive Selected Slice Analysis Panel */}
            {snappedSlice ? (
              <div className="rounded-md border border-sky-500/40 bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                      Trecho selecionado
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-foreground">
                      {formatDateTimeFull(snappedSlice.startPt.timestamp, preferences.timezone)} a{' '}
                      {formatDateTimeFull(snappedSlice.endPt.timestamp, preferences.timezone)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSlice(null)}
                    className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                    <span>Limpar seleção</span>
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 border-y border-border py-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Preço inicial</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrencyUSD(snappedSlice.startPt.price, fmtOpts)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Preço final</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrencyUSD(snappedSlice.endPt.price, fmtOpts)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Variação no trecho</p>
                    <p
                      className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${snappedSlice.changePct >= 0 ? 'text-positive' : 'text-negative'
                        }`}
                    >
                      {formatPercent(snappedSlice.changePct, preferences.numberLocale)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {defaultCompareCoin ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCompareCoinId(defaultCompareCoin.id);
                        setUnitMode('return');
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <GitCompare className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                      <span>
                        Comparar com {defaultCompareCoin.symbol.toUpperCase()} neste trecho
                      </span>
                    </button>
                  ) : null}

                  {onOpenReportWithContext ? (
                    <button
                      type="button"
                      onClick={() => handleOpenReport(true)}
                      className="inline-flex h-8 items-center gap-1.5 rounded border border-accent/40 bg-accent/15 px-3 text-xs font-medium text-accent hover:bg-accent/25"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Adicionar ao Caderno LCT</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Bottom 2-Column Row: Trading Range (24h) + Market Data */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              {/* 24h Trading Range Card */}
              <div className="flex flex-col justify-between rounded-md border border-border bg-card p-4 shadow-card">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Faixa de negociação
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Últimas 24 horas</p>

                  <div className="mt-6">
                    {/* Floating Current Marker */}
                    <div className="relative h-7">
                      <div
                        className="absolute -translate-x-1/2 whitespace-nowrap text-center font-mono text-[11px] font-semibold text-foreground"
                        style={{ left: `${Math.min(92, Math.max(8, rangePct))}%` }}
                      >
                        <span
                          className="rounded px-1.5 py-0.5"
                          style={{
                            backgroundColor: `${primaryColor}22`,
                            color: primaryColor,
                          }}
                        >
                          {coin.symbol.toUpperCase()} {formatPrice(coin.currentPrice, fmtOpts)}
                        </span>
                      </div>
                    </div>

                    {/* Track Bar */}
                    <div className="relative mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${rangePct}%`,
                          backgroundColor: primaryColor,
                        }}
                      />
                      <div
                        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow"
                        style={{
                          left: `${rangePct}%`,
                          backgroundColor: primaryColor,
                        }}
                      />
                    </div>

                    {/* Min / Max Labels */}
                    <div className="mt-2.5 flex items-start justify-between tabular-nums">
                      <div>
                        <p className="font-mono text-xs font-semibold text-foreground">
                          {formatCurrencyUSD(coin.low24h, fmtOpts)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Mínima</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xs font-semibold text-foreground">
                          {formatCurrencyUSD(coin.high24h, fmtOpts)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Máxima</p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground tabular-nums">
                  <span className="font-semibold text-foreground">
                    {formatCurrencyUSD(aboveLow, fmtOpts)}
                  </span>{' '}
                  acima da mínima do dia · nos primeiros{' '}
                  <span className="font-semibold text-foreground">{Math.round(rangePct)}%</span> da
                  faixa de 24h
                </p>
              </div>

              {/* Market Data Card */}
              <div className="flex flex-col justify-between rounded-md border border-border bg-card p-4 shadow-card">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dados de mercado
                  </h2>
                  <dl className="mt-3 divide-y divide-border text-xs">
                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-muted-foreground">Capitalização</dt>
                      <dd className="font-mono font-medium tabular-nums text-foreground">
                        US$ {formatCompactNumber(coin.marketCap, preferences.numberLocale)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-muted-foreground">Volume em 24h</dt>
                      <dd className="font-mono font-medium tabular-nums text-foreground">
                        US$ {formatCompactNumber(coin.totalVolume, preferences.numberLocale)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-muted-foreground">Ranking por capitalização</dt>
                      <dd className="font-mono font-medium tabular-nums text-foreground">
                        #{coin.marketCapRank}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-muted-foreground">Fonte</dt>
                      <dd className="flex items-center gap-2">
                        <span className="font-medium text-foreground">CoinGecko</span>
                        <a
                          href={`https://www.coingecko.com/en/coins/${encodeURIComponent(coin.id)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-muted"
                        >
                          <span>Ver na fonte</span>
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* Caderno LCT Action Strip */}
            {onOpenReportWithContext ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 shadow-card">
                <div>
                  <p className="text-xs font-semibold text-foreground">Caderno LCT</p>
                  <p className="text-[11px] text-muted-foreground">
                    Exporte este período e os dados do ativo para um relatório PDF pronto para
                    reunião.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenReport(false)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <FileText className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  <span>Adicionar este gráfico ao relatório</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : tab === 'history' ? (
          <AssetHistoryDashboard
            coin={coin}
            ohlcCandles={ohlcCandles}
            isOhlcLoading={isOhlcLoading}
            isOhlcError={isOhlcError}
            ohlcRange={ohlcRange}
            onOhlcRangeChange={setOhlcRange}
            onExportCsv={exportHistoryCsv}
          />
        ) : tab === 'news' ? (
          <AssetNewsTab coin={coin} />
        ) : (
          <AssetAboutTab
            coin={coin}
            rangePct={rangePct}
            profile={profile}
            isLoading={isProfileLoading}
            isError={isProfileError}
          />
        )}
      </div>

      {/* Fullscreen Chart Modal */}
      {fullscreenOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Gráfico em tela cheia · ${coin.name}`}
        >
          <div className="flex h-[85vh] w-full max-w-6xl flex-col rounded-md border border-border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2.5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {coin.name} ({coin.symbol.toUpperCase()}) · Evolução do preço
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {CHART_RANGES.find((r) => r.id === range)?.label} ·{' '}
                  {effectiveUnitMode === 'return' ? 'Retorno percentual (%)' : 'Preço em USD'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFullscreenOpen(false)}
                className="inline-flex h-8 items-center gap-1 rounded border border-border bg-background px-2.5 text-xs text-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Fechar</span>
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ApexChartWrapper type="line" series={chartSeries} options={chartOptions} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
