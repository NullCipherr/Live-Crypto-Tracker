import { useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { FileText, Tv } from 'lucide-react';
import type { ApexOptions } from 'apexcharts';
import type { CoinMarket, CustomList } from '../../types/crypto';
import { fetchAssetFullChart, type AssetFullChartData } from '../../services/coingecko';
import { readAnyCache } from '../../lib/cache';
import { ApexChartWrapper } from '../analytics/ApexChartWrapper';
import {
  PageHeader,
  HeaderButton,
  HeaderSegmented,
  HeaderSelect,
} from '../shell/PageHeader';
import {
  Interactive3DRiskPrism,
  Isometric3DReturnTowers,
  Perspective3DReturnRibbon,
} from '../analytics/Animated3DCharts';
import {
  bucketByDay,
  computeBestDay,
  computeDailyReturns,
  computeDrawdownSeries,
  computeMaxDrawdown,
  computePearsonCorrelation,
  computeRollingCorrelation,
  computeVolatility,
  downloadChartPng,
  downloadChartSvg,
  downloadCsvRows,
} from '../../lib/analytics';
import {
  formatCurrencyUSD,
  formatDateShort,
  formatPercent,
} from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { ChartToolbar } from '../analytics/ChartToolbar';
import { ChartCardHeader } from '../analytics/ChartCard';
import { MarketCompositionCard } from '../analytics/MarketCompositionCard';
import { FullscreenChartModal } from '../analytics/FullscreenChartModal';
import { DataInspectorModal, type DataInspectorPayload } from '../analytics/DataInspectorModal';
import {
  MarketBreadthTimelineCard,
  type DailyBreadthRow,
} from '../analytics/MarketBreadthTimelineCard';
import { WaterfallContributionCard } from '../analytics/WaterfallContributionCard';
import { ReturnCalendarCard, type CalendarDayInfo } from '../analytics/ReturnCalendarCard';
import { ReturnsBoxplotCard } from '../analytics/ReturnsBoxplotCard';

interface AnalyticsViewProps {
  coins: CoinMarket[];
  watchlist: string[];
  customLists: CustomList[];
  initialDays?: PeriodDays;
  onInspectCoin: (coinId: string) => void;
  onOpenReportWithContext?: (coinIds: string[], days: PeriodDays, note?: string) => void;
  onOpenTvMode?: () => void;
}

type AnalyticsTab = 'overview' | 'performance' | 'risk';
type PeriodDays = '7' | '30' | '90' | '365';

const SERIES_COLORS = ['#82B4FF', '#34D399', '#FBBF24', '#F472B6', '#A78BFA', '#38BDF8'];

const PERIOD_LABELS: Record<PeriodDays, string> = {
  '7': 'Últimos 7 dias (1S)',
  '30': 'Últimos 30 dias (1M)',
  '90': 'Últimos 90 dias (3M)',
  '365': 'Último 1 ano (1A)',
};

export function AnalyticsView({
  coins,
  watchlist,
  customLists,
  initialDays = '30',
  onInspectCoin,
  onOpenReportWithContext,
  onOpenTvMode,
}: AnalyticsViewProps) {
  const { preferences } = usePreferences();
  const [tab, setTab] = useState<AnalyticsTab>('overview');
  const [universeId, setUniverseId] = useState<string>(() =>
    watchlist.length >= 2 ? 'favorites' : 'top10'
  );
  const [days, setDays] = useState<PeriodDays>(initialDays);
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<string[] | null>(null);
  const [drawdownCoinId, setDrawdownCoinId] = useState<string | null>(null);
  const [onlySelectedStats, setOnlySelectedStats] = useState(true);
  const [showPerfData, setShowPerfData] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [selectedPair, setSelectedPair] = useState<[string, string] | null>(null);
  const [pairEvolutionMode, setPairEvolutionMode] = useState(false);
  const [inspectorPayload, setInspectorPayload] = useState<DataInspectorPayload | null>(null);

  const perfChartRef = useRef<HTMLDivElement>(null);
  const scatterChartRef = useRef<HTMLDivElement>(null);

  const universeCoins = useMemo(() => {
    if (universeId === 'favorites') {
      const set = new Set(watchlist);
      const favs = coins.filter((c) => set.has(c.id));
      return favs.length > 0 ? favs.slice(0, 8) : coins.slice(0, 6);
    }
    if (universeId === 'top6') return coins.slice(0, 6);
    if (universeId === 'top10') return coins.slice(0, 10);
    if (universeId === 'top11_20') return coins.slice(10, 20);
    if (universeId === 'top21_30') return coins.slice(20, 30);
    const list = customLists.find((l) => l.id === universeId);
    if (list) {
      const set = new Set(list.coinIds);
      const matched = coins.filter((c) => set.has(c.id));
      return matched.length > 0 ? matched.slice(0, 8) : coins.slice(0, 6);
    }
    return coins.slice(0, 6);
  }, [coins, customLists, universeId, watchlist]);

  const activeSeriesIds = useMemo(() => {
    if (selectedSeriesIds) {
      const valid = selectedSeriesIds.filter((id) => universeCoins.some((c) => c.id === id));
      if (valid.length > 0) return valid;
    }
    return universeCoins.slice(0, 3).map((c) => c.id);
  }, [selectedSeriesIds, universeCoins]);

  const toggleSeries = (id: string) => {
    const current = activeSeriesIds;
    if (current.includes(id)) {
      if (current.length <= 1) return;
      setSelectedSeriesIds(current.filter((item) => item !== id));
    } else {
      setSelectedSeriesIds([...current, id]);
    }
  };

  const queries = useQueries({
    queries: universeCoins.map((coin) => {
      const cacheKey = `chart-full:${coin.id}:${days}`;
      const cached = readAnyCache<AssetFullChartData>(cacheKey);
      return {
        queryKey: ['analytics-full', coin.id, days],
        queryFn: () => fetchAssetFullChart(coin.id, days),
        initialData: cached?.data,
        initialDataUpdatedAt: cached?.savedAt,
        staleTime: 15 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading && !q.data);
  const isFetchingAny = queries.some((q) => q.isFetching);
  const readyCount = queries.filter((q) => Boolean(q.data)).length;

  const analyticsData = useMemo(() => {
    const perCoin = universeCoins.map((coin, idx) => {
      const raw = queries[idx]?.data;
      const daily = raw ? bucketByDay(raw.prices) : [];
      const returns = computeDailyReturns(daily);
      const volatility = computeVolatility(returns);
      const maxDrawdown = computeMaxDrawdown(daily);
      const drawdownSeries = computeDrawdownSeries(daily);
      const bestDay = computeBestDay(returns);
      const startPrice = daily[0]?.price ?? coin.currentPrice;
      const endPrice = daily[daily.length - 1]?.price ?? coin.currentPrice;
      const initialCap = raw?.marketCaps?.[0]?.marketCap ?? coin.marketCap;
      const periodReturn = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;

      return {
        coin,
        daily,
        returns,
        volatility,
        maxDrawdown,
        drawdownSeries,
        bestDay,
        startPrice,
        endPrice,
        initialCap,
        periodReturn,
      };
    });

    const loaded = perCoin.filter((p) => p.daily.length > 1);
    const dayKeys = loaded.length > 0 ? loaded[0].daily.map((d) => d.dayKey) : [];

    const perfRows = dayKeys.map((dayKey, i) => {
      const row: Record<string, number | string> = {
        dayKey,
        timestamp: loaded[0].daily[i].timestamp,
      };
      for (const item of loaded) {
        const pt = item.daily.find((d) => d.dayKey === dayKey);
        const base = item.startPrice || 1;
        if (pt) {
          row[item.coin.id] = Number((((pt.price - base) / base) * 100).toFixed(2));
        }
      }
      return row;
    });

    // Daily Breadth + Calendar Day Info
    const breadthRows: DailyBreadthRow[] = [];
    const calendarDays: CalendarDayInfo[] = [];

    for (let i = 1; i < dayKeys.length; i++) {
      const dayKey = dayKeys[i];
      const ts = loaded[0].daily[i].timestamp;
      const upTickers: string[] = [];
      const flatTickers: string[] = [];
      const downTickers: string[] = [];
      let sumRet = 0;
      let cntRet = 0;

      for (const item of loaded) {
        const ret = item.returns.get(dayKey);
        if (ret !== undefined) {
          sumRet += ret;
          cntRet++;
          if (ret > 0.25) upTickers.push(item.coin.symbol.toUpperCase());
          else if (ret < -0.25) downTickers.push(item.coin.symbol.toUpperCase());
          else flatTickers.push(item.coin.symbol.toUpperCase());
        }
      }

      breadthRows.push({ dayKey, timestamp: ts, upTickers, flatTickers, downTickers });
      calendarDays.push({
        dayKey,
        timestamp: ts,
        returnPct: cntRet > 0 ? Number((sumRet / cntRet).toFixed(2)) : 0,
        upCount: upTickers.length,
        totalCount: cntRet,
      });
    }

    const scatterRows = loaded.map((item) => ({
      id: item.coin.id,
      symbol: item.coin.symbol.toUpperCase(),
      volatility: Number(item.volatility.toFixed(2)),
      periodReturn: Number(item.periodReturn.toFixed(2)),
    }));

    return { perCoin, loaded, perfRows, breadthRows, calendarDays, scatterRows };
  }, [queries, universeCoins]);

  // Top KPI Strip (Portfolio return, assets up, max drawdown, BTC dominance)
  const totalInitialCap = analyticsData.loaded.reduce((s, p) => s + Math.max(p.initialCap, 0), 0);
  const portfolioReturn =
    totalInitialCap > 0
      ? analyticsData.loaded.reduce(
          (s, p) => s + (p.initialCap / totalInitialCap) * p.periodReturn,
          0
        )
      : 0;
  const upCount = analyticsData.loaded.filter((p) => p.periodReturn > 0).length;
  const worstAssetDrawdown = analyticsData.loaded.reduce(
    (min, p) => (p.maxDrawdown < min ? p.maxDrawdown : min),
    0
  );
  const totalCap = universeCoins.reduce((s, c) => s + c.marketCap, 0);
  const btcCap = universeCoins.find((c) => c.symbol.toLowerCase() === 'btc')?.marketCap ?? 0;
  const btcDom = totalCap > 0 ? (btcCap / totalCap) * 100 : 0;

  const activeDrawdownCoin =
    analyticsData.loaded.find((p) => p.coin.id === drawdownCoinId) ?? analyticsData.loaded[0];

  const coveredLabel =
    analyticsData.perfRows.length > 1
      ? `${formatDateShort(Number(analyticsData.perfRows[0].timestamp), preferences.timezone)} – ${formatDateShort(Number(analyticsData.perfRows[analyticsData.perfRows.length - 1].timestamp), preferences.timezone)}`
      : PERIOD_LABELS[days];

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const activePair = useMemo(() => {
    if (selectedPair) return selectedPair;
    if (universeCoins.length >= 2)
      return [universeCoins[0].id, universeCoins[1].id] as [string, string];
    return null;
  }, [selectedPair, universeCoins]);

  const activePairStats = useMemo(() => {
    if (!activePair) return null;
    const a = analyticsData.perCoin.find((p) => p.coin.id === activePair[0]);
    const b = analyticsData.perCoin.find((p) => p.coin.id === activePair[1]);
    if (!a || !b) return null;
    const { r, count } = computePearsonCorrelation(a.returns, b.returns);
    const rolling = computeRollingCorrelation(a.daily, a.returns, b.returns, 14);
    return { a: a.coin, b: b.coin, r, count, rolling };
  }, [activePair, analyticsData.perCoin]);

  const exportPerfCsv = () => {
    const activeCoins = activeSeriesIds
      .map((id) => universeCoins.find((c) => c.id === id))
      .filter((c): c is CoinMarket => Boolean(c));
    downloadCsvRows(
      `analytics-desempenho-${days}d.csv`,
      ['data', ...activeCoins.map((c) => `${c.symbol.toUpperCase()}_retorno_pct`)],
      analyticsData.perfRows.map((row) => [
        String(row.dayKey),
        ...activeCoins.map((c) => Number(row[c.id] ?? 0)),
      ])
    );
  };

  const statsTableItems = (
    onlySelectedStats
      ? analyticsData.loaded.filter((p) => activeSeriesIds.includes(p.coin.id))
      : analyticsData.loaded
  ).sort((a, b) => b.periodReturn - a.periodReturn);

  const sortedPerf = [...analyticsData.loaded].sort((a, b) => b.periodReturn - a.periodReturn);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header & Global Universe/Period Filters */}
      <PageHeader
        title="Analytics"
        titleAddon={
          <HeaderSegmented
            value={tab}
            onChange={setTab}
            tone="surface"
            options={[
              { id: 'overview', label: 'Visão geral' },
              { id: 'performance', label: 'Desempenho' },
              { id: 'risk', label: 'Risco' },
            ]}
          />
        }
        actions={
          <>
            <span
              title="Estratégia JIT com cache persistente de 15 minutos"
              className="hidden items-center gap-1.5 px-1.5 text-[11px] font-medium text-muted-foreground xl:inline-flex"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isFetchingAny ? 'animate-pulse bg-amber-400' : 'bg-positive'
                }`}
              />
              {isFetchingAny
                ? `Sincronizando (${readyCount}/${universeCoins.length})`
                : `${readyCount}/${universeCoins.length} em cache`}
            </span>

            <HeaderSelect
              aria-label="Universo do Analytics"
              value={universeId}
              onChange={(e) => {
                setUniverseId(e.target.value);
                setSelectedSeriesIds(null);
              }}
            >
              {watchlist.length > 0 ? (
                <option value="favorites">Favoritos ({watchlist.length} ativos)</option>
              ) : null}
              <option value="top6">Top 6 por capitalização</option>
              <option value="top10">Top 10 por capitalização</option>
              <option value="top11_20">Top 11–20 por capitalização</option>
              <option value="top21_30">Top 21–30 por capitalização</option>
              {customLists.map((l) => (
                <option key={l.id} value={l.id}>
                  Lista: {l.name} ({l.coinIds.length})
                </option>
              ))}
            </HeaderSelect>

            <HeaderSegmented
              value={days}
              onChange={setDays}
              mono
              options={[
                { id: '7', label: '1S' },
                { id: '30', label: '1M' },
                { id: '90', label: '3M' },
                { id: '365', label: '1A' },
              ]}
            />

            {onOpenTvMode || onOpenReportWithContext ? (
              <span className="hidden h-5 w-px bg-border sm:inline-block" aria-hidden="true" />
            ) : null}

            {onOpenTvMode ? (
              <HeaderButton
                onClick={onOpenTvMode}
                title="Modo TV (rotação em tela cheia)"
              >
                <Tv className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                <span>Modo TV</span>
              </HeaderButton>
            ) : null}

            {onOpenReportWithContext ? (
              <HeaderButton
                variant="primary"
                onClick={() => onOpenReportWithContext(universeCoins.map((c) => c.id), days)}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Gerar relatório</span>
              </HeaderButton>
            ) : null}
          </>
        }
      />

      {/* Main Content */}
      <div className="flex-1 space-y-6 overflow-y-auto p-5 lg:p-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-md border border-border bg-card px-3.5 py-3 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Retorno da carteira
            </p>
            <p
              className={`mt-1 text-lg font-semibold tabular-nums ${
                portfolioReturn >= 0 ? 'text-positive' : 'text-negative'
              }`}
            >
              {formatPercent(portfolioReturn, preferences.numberLocale)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Ponderado pela capitalização inicial
            </p>
          </div>
          <div className="rounded-md border border-border bg-card px-3.5 py-3 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ativos em alta
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {upCount} de {analyticsData.loaded.length}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-positive transition-all"
                style={{
                  width: `${
                    analyticsData.loaded.length > 0
                      ? Math.round((upCount / analyticsData.loaded.length) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
          <div className="rounded-md border border-border bg-card px-3.5 py-3 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Maior drawdown no recorte
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-negative">
              {formatPercent(worstAssetDrawdown, preferences.numberLocale)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Pior recuo desde o pico no período
            </p>
          </div>
          <div
            className="rounded-md border border-border bg-card px-3.5 py-3 shadow-card"
            title={`Participação do BTC sobre os ${universeCoins.length} ativos selecionados`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Dominância BTC
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {btcDom > 0 ? `${btcDom.toFixed(1).replace('.', ',')}% do universo` : '--'}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, btcDom))}%` }}
              />
            </div>
          </div>
        </div>

        {tab === 'overview' ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              {/* Shared Time-Axis Return + Drawdown Card */}
              <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                <ChartCardHeader
                  title="Desempenho relativo e queda desde o pico"
                  subtitle={`Eixo de tempo compartilhado · ${PERIOD_LABELS[days]}`}
                  right={
                    <ChartToolbar
                    showData={showPerfData}
                    onToggleData={() => setShowPerfData((p) => !p)}
                    onInspectData={() =>
                      setInspectorPayload({
                        title: 'Desempenho relativo e drawdown',
                        source: 'CoinGecko API v3 (/coins/{id}/market_chart)',
                        unit: 'Retorno (%) e Queda desde o pico (%)',
                        timezone: preferences.timezone,
                        requestedPeriod: PERIOD_LABELS[days],
                        coveredPeriod: coveredLabel,
                        observationCount: analyticsData.perfRows.length,
                        excludedCount: 0,
                        formula:
                          'Retorno(t) = (P(t)/P(0) − 1)×100 · Drawdown(t) = (P(t)/Pico_acumulado(t) − 1)×100.',
                      })
                    }
                    onExportPng={() =>
                      downloadChartPng(
                        perfChartRef.current,
                        'Desempenho relativo',
                        PERIOD_LABELS[days],
                        `desempenho-${days}d.png`
                      )
                    }
                    onExportSvg={() =>
                      downloadChartSvg(
                        perfChartRef.current,
                        'Desempenho relativo',
                        PERIOD_LABELS[days],
                        `desempenho-${days}d.svg`
                      )
                    }
                    onExportCsv={exportPerfCsv}
                    onFullscreen={() => setFullscreenOpen(true)}
                  />
                  }
                />

                <div className="my-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                  {universeCoins.map((coin) => {
                    const activeIdx = activeSeriesIds.indexOf(coin.id);
                    const checked = activeIdx !== -1;
                    const seriesColor = checked
                      ? SERIES_COLORS[activeIdx % SERIES_COLORS.length]
                      : undefined;
                    return (
                      <label
                        key={coin.id}
                        className={`inline-flex h-7 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[11px] font-medium shadow-card transition-all focus-within:ring-2 focus-within:ring-accent ${
                          checked
                            ? 'border-accent/60 bg-accent/15 text-foreground'
                            : 'border-border/80 bg-card/85 text-muted-foreground hover:border-accent/50 hover:bg-card hover:text-foreground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSeries(coin.id)}
                          className="sr-only"
                        />
                        <span
                          className="h-2 w-2 shrink-0 rounded-full transition-colors"
                          style={{
                            backgroundColor: seriesColor ?? 'hsl(var(--muted-foreground) / 0.4)',
                          }}
                          aria-hidden="true"
                        />
                        <span className="font-mono font-semibold">
                          {coin.symbol.toUpperCase()}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {showPerfData ? (
                  <div className="max-h-72 overflow-auto rounded border border-border bg-background">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 border-b border-border bg-nav text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-2.5 py-1.5">Data</th>
                          {activeSeriesIds.map((id) => {
                            const c = universeCoins.find((item) => item.id === id);
                            return (
                              <th key={id} className="px-2.5 py-1.5 text-right font-mono">
                                {c?.symbol.toUpperCase()}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border tabular-nums">
                        {analyticsData.perfRows.map((row) => (
                          <tr key={String(row.dayKey)}>
                            <td className="px-2.5 py-1.5 font-mono text-muted-foreground">
                              {formatDateShort(Number(row.timestamp), preferences.timezone)}
                            </td>
                            {activeSeriesIds.map((id) => (
                              <td key={id} className="px-2.5 py-1.5 text-right text-foreground">
                                {formatPercent(Number(row[id] ?? 0), preferences.numberLocale)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div ref={perfChartRef} className="space-y-3">
                    <div className="h-52 w-full">
                      {isLoading ? (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Carregando séries...
                        </div>
                      ) : (
                        <ApexChartWrapper
                          type="line"
                          series={activeSeriesIds
                            .map((id, idx) => {
                              const c = universeCoins.find((item) => item.id === id);
                              if (!c) return null;
                              return {
                                name: c.symbol.toUpperCase(),
                                color: SERIES_COLORS[idx % SERIES_COLORS.length],
                                data: analyticsData.perfRows
                                  .filter((r) => typeof r[id] === 'number')
                                  .map((r) => [Number(r.timestamp), Number(r[id])] as [number, number]),
                              };
                            })
                            .filter((s): s is NonNullable<typeof s> => s !== null)}
                          options={
                            {
                              chart: {
                                id: 'overview-perf',
                                group: 'overview-sync',
                              },
                              stroke: { curve: 'smooth', width: 2 },
                              legend: { show: false },
                              xaxis: {
                                type: 'datetime',
                                labels: { show: false },
                                axisBorder: { show: false },
                                axisTicks: { show: false },
                              },
                              yaxis: {
                                labels: {
                                  formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
                                },
                              },
                              tooltip: {
                                x: {
                                  formatter: (ts: number) =>
                                    formatDateShort(Number(ts), preferences.timezone),
                                },
                                y: {
                                  formatter: (val: number) =>
                                    formatPercent(Number(val ?? 0), preferences.numberLocale),
                                },
                              },
                            } satisfies ApexOptions
                          }
                        />
                      )}
                    </div>

                    {/* Shared-axis Drawdown */}
                    <div className="border-t border-border pt-2">
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Queda desde o pico</span>
                        <select
                          aria-label="Ativo do drawdown"
                          value={activeDrawdownCoin?.coin.id ?? ''}
                          onChange={(e) => setDrawdownCoinId(e.target.value)}
                          className="h-7 rounded-lg border border-border/80 bg-card/85 pl-2.5 pr-8 font-mono text-[11px] font-medium text-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card"
                        >
                          {analyticsData.loaded.map((p) => (
                            <option key={p.coin.id} value={p.coin.id}>
                              {p.coin.symbol.toUpperCase()} (máx. {formatPercent(p.maxDrawdown, preferences.numberLocale)})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="h-28 w-full">
                        <ApexChartWrapper
                          type="area"
                          series={[
                            {
                              name: 'Drawdown',
                              color: '#F43F5E',
                              data: (activeDrawdownCoin?.drawdownSeries ?? []).map((pt) => [
                                pt.timestamp,
                                Number(pt.drawdownPct.toFixed(2)),
                              ]),
                            },
                          ]}
                          options={
                            {
                              chart: {
                                id: 'overview-drawdown',
                                group: 'overview-sync',
                              },
                              stroke: { curve: 'smooth', width: 1.75 },
                              fill: {
                                type: 'gradient',
                                gradient: {
                                  shadeIntensity: 1,
                                  opacityFrom: 0.28,
                                  opacityTo: 0.04,
                                  stops: [0, 100],
                                },
                              },
                              xaxis: {
                                type: 'datetime',
                                labels: {
                                  datetimeUTC: false,
                                  formatter: (_val: string, ts?: number) =>
                                    ts ? formatDateShort(ts, preferences.timezone) : '',
                                },
                              },
                              yaxis: {
                                labels: {
                                  formatter: (v: number) => `${v.toFixed(1)}%`,
                                },
                              },
                              tooltip: {
                                x: {
                                  formatter: (ts: number) =>
                                    formatDateShort(Number(ts), preferences.timezone),
                                },
                                y: {
                                  formatter: (val: number) =>
                                    formatPercent(Number(val ?? 0), preferences.numberLocale),
                                },
                              },
                            } satisfies ApexOptions
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2D / 3D Market Composition */}
              <MarketCompositionCard coins={universeCoins} onInspectCoin={onInspectCoin} />
            </div>

            {/* Full-width Market Breadth Timeline */}
            <MarketBreadthTimelineCard
              rows={analyticsData.breadthRows}
              periodLabel={PERIOD_LABELS[days]}
              onInspectData={setInspectorPayload}
            />

            {/* 3D Animated Chart #1 */}
            <Isometric3DReturnTowers
              items={analyticsData.loaded.map((p) => ({
                coin: p.coin,
                periodReturn: p.periodReturn,
                volatility: p.volatility,
                maxDrawdown: p.maxDrawdown,
              }))}
              onInspectCoin={onInspectCoin}
            />
          </>
        ) : tab === 'performance' ? (
          /* 2. Aba Desempenho · Aprimorada com KPIs, Retorno por ativo, 3D Ribbon, Cascata e Calendário */
          <div className="space-y-6">
            {analyticsData.loaded.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-3.5 shadow-card">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Melhor desempenho
                  </p>
                  <p className="mt-1 font-mono text-base font-semibold text-positive">
                    {sortedPerf[0]?.coin.symbol.toUpperCase()}{' '}
                    {formatPercent(sortedPerf[0]?.periodReturn ?? 0, preferences.numberLocale)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3.5 shadow-card">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Pior desempenho
                  </p>
                  <p className="mt-1 font-mono text-base font-semibold text-negative">
                    {sortedPerf[sortedPerf.length - 1]?.coin.symbol.toUpperCase()}{' '}
                    {formatPercent(
                      sortedPerf[sortedPerf.length - 1]?.periodReturn ?? 0,
                      preferences.numberLocale
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3.5 shadow-card">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Retorno médio simples
                  </p>
                  <p
                    className={`mt-1 font-mono text-base font-semibold ${
                      analyticsData.loaded.reduce((s, p) => s + p.periodReturn, 0) /
                        analyticsData.loaded.length >=
                      0
                        ? 'text-positive'
                        : 'text-negative'
                    }`}
                  >
                    {formatPercent(
                      analyticsData.loaded.reduce((s, p) => s + p.periodReturn, 0) /
                        analyticsData.loaded.length,
                      preferences.numberLocale
                    )}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-card">
                <ChartCardHeader
                  title={`Ranking de retorno acumulado (${PERIOD_LABELS[days]})`}
                  subtitle="Comparação direta entre todos os ativos do universo selecionado"
                />
                <div className="h-80">
                  <ApexChartWrapper
                    type="bar"
                    series={[
                      {
                        name: 'Retorno (%)',
                        data: sortedPerf.map((p) => Number(p.periodReturn.toFixed(2))),
                      },
                    ]}
                    options={{
                      colors: sortedPerf.map((p) =>
                        p.periodReturn >= 0 ? '#34D399' : '#F43F5E'
                      ),
                      legend: { show: false },
                      plotOptions: {
                        bar: {
                          distributed: true,
                          borderRadius: 4,
                          columnWidth: '52%',
                        },
                      },
                      annotations: {
                        yaxis: [
                          {
                            y: 0,
                            borderColor: '#64748B',
                            strokeDashArray: 3,
                          },
                        ],
                      },
                      xaxis: { categories: sortedPerf.map((p) => p.coin.symbol.toUpperCase()) },
                      yaxis: {
                        labels: {
                          formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
                        },
                      },
                    }}
                  />
                </div>
              </div>

              {/* 3D Animated Chart #2 */}
              <Perspective3DReturnRibbon
                items={analyticsData.loaded.map((p) => ({
                  coin: p.coin,
                  periodReturn: p.periodReturn,
                  volatility: p.volatility,
                  maxDrawdown: p.maxDrawdown,
                  series: p.daily.map((d) =>
                    p.startPrice > 0 ? ((d.price - p.startPrice) / p.startPrice) * 100 : 0
                  ),
                }))}
              />
            </div>

            <WaterfallContributionCard
              items={analyticsData.loaded.map((p) => ({
                coin: p.coin,
                initialCap: p.initialCap,
                periodReturn: p.periodReturn,
              }))}
              periodLabel={PERIOD_LABELS[days]}
              coveredLabel={coveredLabel}
              onInspectData={setInspectorPayload}
            />

            <ReturnCalendarCard days={analyticsData.calendarDays} />

            {/* Period Statistics Table */}
            <div className="overflow-hidden rounded-md border border-border bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-border bg-nav px-4 py-2 text-xs">
                <h2 className="font-semibold text-foreground">Estatísticas do período</h2>
                <button
                  type="button"
                  onClick={() => setOnlySelectedStats((p) => !p)}
                  className="text-[11px] text-accent hover:underline"
                >
                  Apenas selecionados: {onlySelectedStats ? 'sim' : 'não'}
                </button>
              </div>
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-border bg-background text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Ativo</th>
                    <th className="px-3 py-2 text-right">Preço inicial USD</th>
                    <th className="px-3 py-2 text-right">Preço final USD</th>
                    <th className="px-3 py-2 text-right">Retorno</th>
                    <th className="px-3 py-2 text-right">Queda máxima*</th>
                    <th className="px-3 py-2 text-right">Melhor dia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {statsTableItems.map((item) => (
                    <tr key={item.coin.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono font-semibold text-accent">
                        {item.coin.symbol.toUpperCase()}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {formatCurrencyUSD(item.startPrice, fmtOpts)}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {formatCurrencyUSD(item.endPrice, fmtOpts)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          item.periodReturn >= 0 ? 'text-positive' : 'text-negative'
                        }`}
                      >
                        {formatPercent(item.periodReturn, preferences.numberLocale)}
                      </td>
                      <td className="px-3 py-2 text-right text-negative">
                        {formatPercent(item.maxDrawdown, preferences.numberLocale)}
                      </td>
                      <td className="px-3 py-2 text-right text-positive">
                        {formatPercent(item.bestDay, preferences.numberLocale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border bg-nav px-3 py-1.5 text-[10px] text-muted-foreground">
                * Maior queda de um pico até um fundo posterior, dentro do período exibido.
              </p>
            </div>
          </div>
        ) : (
          /* 3. Aba Risco · Boxplot, Dispersão e Correlação com Evolução do Par */
          <div className="space-y-4">
            <ReturnsBoxplotCard
              items={analyticsData.loaded.map((p) => ({
                coin: p.coin,
                daily: p.daily,
                returns: p.returns,
              }))}
              periodLabel={PERIOD_LABELS[days]}
              onInspectCoin={onInspectCoin}
              onInspectData={setInspectorPayload}
              onAddToReport={
                onOpenReportWithContext
                  ? (note) =>
                      onOpenReportWithContext(
                        universeCoins.map((c) => c.id),
                        days,
                        note
                      )
                  : undefined
              }
            />

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Risk vs Return Scatter */}
              <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                <ChartCardHeader
                  title="Risco × retorno"
                  subtitle="Volatilidade diária (%) vs. retorno acumulado (%)"
                />
                <div ref={scatterChartRef} className="h-60 w-full">
                  <ApexChartWrapper
                    type="scatter"
                    series={analyticsData.scatterRows.map((row, idx) => ({
                      name: row.symbol,
                      color: SERIES_COLORS[idx % SERIES_COLORS.length],
                      data: [[Number(row.volatility.toFixed(2)), Number(row.periodReturn.toFixed(2))]],
                    }))}
                    options={
                      {
                        markers: { size: 7, hover: { size: 9 } },
                        xaxis: {
                          type: 'numeric',
                          tickAmount: 5,
                          labels: {
                            formatter: (val: string) => `${Number(val).toFixed(1)}%`,
                          },
                        },
                        yaxis: {
                          labels: {
                            formatter: (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`,
                          },
                        },
                        tooltip: {
                          shared: false,
                          intersect: true,
                          custom: ({ seriesIndex }) => {
                            const row = analyticsData.scatterRows[seriesIndex];
                            if (!row) return '';
                            return `<div class="px-2.5 py-1.5 text-xs"><div class="font-semibold">${row.symbol}</div><div>Volatilidade: ${row.volatility.toFixed(2)}%</div><div>Retorno: ${row.periodReturn > 0 ? '+' : ''}${row.periodReturn.toFixed(2)}%</div></div>`;
                          },
                        },
                      } satisfies ApexOptions
                    }
                  />
                </div>
              </div>

              {/* Correlation Matrix or Rolling Pair Evolution */}
              <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                {pairEvolutionMode && activePairStats ? (
                  <div className="flex h-full flex-col justify-between">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPairEvolutionMode(false)}
                          className="h-6 rounded border border-border bg-background px-2 text-[11px] text-foreground hover:bg-muted"
                        >
                          Voltar à matriz
                        </button>
                        <span className="font-mono text-xs font-semibold text-accent">
                          {activePairStats.a.symbol.toUpperCase()} /{' '}
                          {activePairStats.b.symbol.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Janela móvel 14d</span>
                    </div>

                    <div className="h-52 w-full">
                      <ApexChartWrapper
                        type="line"
                        series={[
                          {
                            name: 'Correlação',
                            color: '#82B4FF',
                            data: activePairStats.rolling.map((pt) => [
                              pt.timestamp,
                              Number(pt.r.toFixed(3)),
                            ]),
                          },
                        ]}
                        options={
                          {
                            stroke: { curve: 'smooth', width: 2 },
                            legend: { show: false },
                            xaxis: {
                              type: 'datetime',
                              labels: {
                                datetimeUTC: false,
                                formatter: (_val: string, ts?: number) =>
                                  ts ? formatDateShort(ts, preferences.timezone) : '',
                              },
                            },
                            yaxis: {
                              min: -1,
                              max: 1,
                              tickAmount: 4,
                              labels: {
                                formatter: (v: number) => v.toFixed(2),
                              },
                            },
                            tooltip: {
                              x: {
                                formatter: (ts: number) =>
                                  formatDateShort(Number(ts), preferences.timezone),
                              },
                            },
                          } satisfies ApexOptions
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <ChartCardHeader
                      title="Correlação dos retornos"
                      subtitle="Pearson (−1,00 a +1,00) · clique em uma célula"
                      right={
                        activePairStats ? (
                          <button
                            type="button"
                            onClick={() =>
                              setInspectorPayload({
                                title: `Correlação ${activePairStats.a.symbol.toUpperCase()} × ${activePairStats.b.symbol.toUpperCase()}`,
                                source: 'CoinGecko API v3 (/coins/{id}/market_chart)',
                                unit: 'Coeficiente de Pearson (r)',
                                timezone: preferences.timezone,
                                requestedPeriod: PERIOD_LABELS[days],
                                coveredPeriod: `${activePairStats.count} retornos em comum`,
                                observationCount: activePairStats.count,
                                excludedCount: Math.max(
                                  0,
                                  analyticsData.perfRows.length - 1 - activePairStats.count
                                ),
                                formula: 'r = Σ((x − x̄)(y − ȳ)) / √(Σ(x − x̄)² · Σ(y − ȳ)²)',
                              })
                            }
                            className="group inline-flex h-7 items-center rounded-lg border border-border/80 bg-card/85 px-2.5 text-[11px] font-medium text-muted-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card hover:text-foreground"
                          >
                            Inspecionar dados
                          </button>
                        ) : null
                      }
                    />

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-center font-mono text-[11px]">
                        <thead>
                          <tr>
                            <th className="p-1 text-left text-muted-foreground" />
                            {analyticsData.loaded.map((col) => (
                              <th key={col.coin.id} className="p-1 text-muted-foreground">
                                {col.coin.symbol.toUpperCase()}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsData.loaded.map((rowItem) => (
                            <tr key={rowItem.coin.id}>
                              <th className="p-1 text-left text-muted-foreground">
                                {rowItem.coin.symbol.toUpperCase()}
                              </th>
                              {analyticsData.loaded.map((colItem) => {
                                const { r } = computePearsonCorrelation(
                                  rowItem.returns,
                                  colItem.returns
                                );
                                const isSelected =
                                  activePair &&
                                  ((activePair[0] === rowItem.coin.id &&
                                    activePair[1] === colItem.coin.id) ||
                                    (activePair[1] === rowItem.coin.id &&
                                      activePair[0] === colItem.coin.id));
                                return (
                                  <td key={colItem.coin.id} className="p-0.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedPair([rowItem.coin.id, colItem.coin.id])
                                      }
                                      className={`w-full rounded px-1.5 py-1 tabular-nums ${
                                        isSelected
                                          ? 'border border-accent bg-accent/20 text-foreground'
                                          : 'border border-border/50 bg-background text-foreground/90 hover:bg-muted'
                                      }`}
                                    >
                                      {r === null ? '—' : r.toFixed(2).replace('.', ',')}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {activePairStats ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-xs">
                        <span className="font-mono text-foreground">
                          {activePairStats.a.symbol.toUpperCase()} /{' '}
                          {activePairStats.b.symbol.toUpperCase()}:{' '}
                          <strong className="text-accent">
                            {activePairStats.r === null
                              ? '—'
                              : activePairStats.r.toFixed(2).replace('.', ',')}
                          </strong>{' '}
                          <span className="text-[11px] text-muted-foreground">
                            ({activePairStats.count} obs.)
                          </span>
                        </span>
                        {activePairStats.a.id !== activePairStats.b.id ? (
                          <button
                            type="button"
                            onClick={() => setPairEvolutionMode(true)}
                            className="h-7 rounded border border-border bg-background px-2.5 text-[11px] font-medium text-accent hover:bg-muted"
                          >
                            Ver evolução do par
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            {/* 3D Animated Chart #3 */}
            <Interactive3DRiskPrism
              items={analyticsData.loaded.map((p) => ({
                coin: p.coin,
                periodReturn: p.periodReturn,
                volatility: p.volatility,
                maxDrawdown: p.maxDrawdown,
              }))}
              onInspectCoin={onInspectCoin}
            />
          </div>
        )}
      </div>

      {fullscreenOpen ? (
        <FullscreenChartModal
          title="Desempenho relativo"
          periodLabel={PERIOD_LABELS[days]}
          coins={universeCoins}
          selectedIds={activeSeriesIds}
          seriesColors={SERIES_COLORS}
          chartRows={analyticsData.perfRows}
          onToggleCoin={toggleSeries}
          onClose={() => setFullscreenOpen(false)}
        />
      ) : null}

      {inspectorPayload ? (
        <DataInspectorModal
          payload={inspectorPayload}
          onClose={() => setInspectorPayload(null)}
        />
      ) : null}
    </div>
  );
}
