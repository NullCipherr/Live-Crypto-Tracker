import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  ArrowUpDown,
  Award,
  Download,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CoinMarket } from '../../types/crypto';
import { fetchAssetChart } from '../../services/coingecko';
import { usePreferences } from '../../hooks/usePreferences';
import { downloadCsvRows } from '../../lib/analytics';
import { PageHeader, HeaderSegmented } from '../shell/PageHeader';
import {
  formatCompactNumber,
  formatCurrencyUSD,
  formatDateShort,
  formatDateTimeFull,
  formatPercent,
} from '../../lib/formatters';

interface ComparatorViewProps {
  coins: CoinMarket[];
  initialSelectedIds?: string[];
}

type ChartCompareMode = 'return' | 'invest1k';

const SERIES_STYLES = [
  { color: '#82B4FF', dash: undefined },
  { color: '#34D399', dash: '5 3' },
  { color: '#FBBF24', dash: '2 2' },
  { color: '#F472B6', dash: '8 3 2 3' },
];

function computePearsonCorrelation(a: number[], b: number[]): number | null {
  const len = Math.min(a.length, b.length);
  if (len < 3) return null;

  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < len; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / len;
  const meanB = sumB / len;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < len; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  if (den === 0) return null;
  return Math.max(-1, Math.min(1, num / den));
}

export function ComparatorView({ coins, initialSelectedIds }: ComparatorViewProps) {
  const { preferences } = usePreferences();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      return initialSelectedIds.slice(0, 4);
    }
    return coins.slice(0, 2).map((c) => c.id);
  });
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const [chartMode, setChartMode] = useState<ChartCompareMode>('return');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const selectedCoins = useMemo(
    () =>
      selectedIds
        .map((id) => coins.find((c) => c.id === id))
        .filter((c): c is CoinMarket => Boolean(c)),
    [coins, selectedIds]
  );

  const queries = useQueries({
    queries: selectedCoins.map((coin) => ({
      queryKey: ['asset-chart', coin.id, days],
      queryFn: () => fetchAssetChart(coin.id, days),
      staleTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);

  const {
    chartRows,
    summaryRows,
    correlationMatrix,
    commonStartTs,
    commonEndTs,
  } = useMemo(() => {
    const validSeries = queries
      .map((q, idx) => ({
        coin: selectedCoins[idx],
        points: q.data ?? [],
      }))
      .filter((s) => s.coin && s.points.length > 1);

    if (validSeries.length === 0) {
      return {
        chartRows: [],
        summaryRows: [],
        correlationMatrix: [] as { rowCoin: CoinMarket; values: (number | null)[] }[],
        commonStartTs: null,
        commonEndTs: null,
      };
    }

    const startTs = Math.max(...validSeries.map((s) => s.points[0].timestamp));
    const endTs = Math.min(...validSeries.map((s) => s.points[s.points.length - 1].timestamp));

    const baseSeries = validSeries[0].points.filter(
      (p) => p.timestamp >= startTs && p.timestamp <= endTs
    );

    if (baseSeries.length === 0) {
      return {
        chartRows: [],
        summaryRows: [],
        correlationMatrix: [],
        commonStartTs: null,
        commonEndTs: null,
      };
    }

    const findNearest = (pts: { timestamp: number; price: number }[], ts: number) => {
      let best = pts[0];
      let bestDiff = Math.abs(pts[0].timestamp - ts);
      for (const p of pts) {
        const diff = Math.abs(p.timestamp - ts);
        if (diff < bestDiff) {
          best = p;
          bestDiff = diff;
        }
      }
      return best.price;
    };

    const startPrices = validSeries.map((s) => findNearest(s.points, startTs));
    const endPrices = validSeries.map((s) => findNearest(s.points, endTs));

    // Aligned price arrays per series for return, drawdown, volatility & correlation
    const alignedPricesPerSeries = validSeries.map((s) =>
      baseSeries.map((pt) => findNearest(s.points, pt.timestamp))
    );

    const rows = baseSeries.map((pt, ptIdx) => {
      const row: Record<string, number> = { timestamp: pt.timestamp };
      validSeries.forEach((s, idx) => {
        const base = startPrices[idx] || 1;
        const val = alignedPricesPerSeries[idx][ptIdx];
        if (chartMode === 'invest1k') {
          row[s.coin.id] = Number(((val / base) * 1000).toFixed(2));
        } else {
          row[s.coin.id] = Number((((val - base) / base) * 100).toFixed(2));
        }
      });
      return row;
    });

    const stepReturnsPerSeries = alignedPricesPerSeries.map((prices) => {
      const rets: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        const prev = prices[i - 1];
        rets.push(prev > 0 ? (prices[i] - prev) / prev : 0);
      }
      return rets;
    });

    const summaries = validSeries.map((s, idx) => {
      const startPrice = startPrices[idx];
      const endPrice = endPrices[idx];
      const retPct = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
      const invest1kValue = startPrice > 0 ? (endPrice / startPrice) * 1000 : 1000;

      // Max drawdown (%)
      let peak = alignedPricesPerSeries[idx][0] || 0;
      let maxDrawdown = 0;
      for (const p of alignedPricesPerSeries[idx]) {
        if (p > peak) peak = p;
        if (peak > 0) {
          const dd = ((p - peak) / peak) * 100;
          if (dd < maxDrawdown) maxDrawdown = dd;
        }
      }

      // Period volatility (%)
      const rets = stepReturnsPerSeries[idx];
      const meanRet = rets.length > 0 ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
      const variance =
        rets.length > 1
          ? rets.reduce((acc, r) => acc + (r - meanRet) ** 2, 0) / (rets.length - 1)
          : 0;
      const periodVolPct = Math.sqrt(variance) * Math.sqrt(Math.max(1, rets.length)) * 100;
      const riskRatio = periodVolPct > 0 ? retPct / periodVolPct : 0;

      return {
        coin: s.coin,
        startPrice,
        endPrice,
        retPct,
        invest1kValue,
        maxDrawdown,
        periodVolPct,
        riskRatio,
      };
    });

    const corrMatrix = validSeries.map((rowSeries, rIdx) => ({
      rowCoin: rowSeries.coin,
      values: validSeries.map((_, cIdx) => {
        if (rIdx === cIdx) return 1;
        return computePearsonCorrelation(
          stepReturnsPerSeries[rIdx],
          stepReturnsPerSeries[cIdx]
        );
      }),
    }));

    return {
      chartRows: rows,
      summaryRows: summaries,
      correlationMatrix: corrMatrix,
      commonStartTs: startTs,
      commonEndTs: endTs,
    };
  }, [queries, selectedCoins, chartMode]);

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const leaderSummary = useMemo(() => {
    if (summaryRows.length === 0) return null;
    return [...summaryRows].sort((a, b) => b.retPct - a.retPct)[0];
  }, [summaryRows]);

  const laggardSummary = useMemo(() => {
    if (summaryRows.length === 0) return null;
    return [...summaryRows].sort((a, b) => a.retPct - b.retPct)[0];
  }, [summaryRows]);

  const lowestVolSummary = useMemo(() => {
    if (summaryRows.length === 0) return null;
    return [...summaryRows].sort((a, b) => a.periodVolPct - b.periodVolPct)[0];
  }, [summaryRows]);

  const spreadPct =
    leaderSummary && laggardSummary && summaryRows.length > 1
      ? leaderSummary.retPct - laggardSummary.retPct
      : null;

  const availableToAdd = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return coins
      .filter((c) => !selectedIds.includes(c.id))
      .filter((c) => {
        if (!q) return true;
        return c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q);
      });
  }, [coins, selectedIds, pickerSearch]);

  const applyPreset = (targetIds: string[]) => {
    const valid = targetIds.filter((id) => coins.some((c) => c.id === id)).slice(0, 4);
    if (valid.length > 0) setSelectedIds(valid);
  };

  const handleExportCsv = () => {
    if (chartRows.length === 0 || selectedCoins.length === 0) return;
    const headers = [
      'data_hora',
      ...selectedCoins.map((c) => `${c.symbol.toUpperCase()}_${chartMode === 'invest1k' ? 'usd_1k' : 'ret_pct'}`),
    ];
    const rows = chartRows.map((r) => [
      formatDateTimeFull(r.timestamp, preferences.timezone),
      ...selectedCoins.map((c) => r[c.id] ?? ''),
    ]);
    downloadCsvRows(`comparador-${days}d-${chartMode}.csv`, headers, rows);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Comparador"
        subtitle="Desempenho relativo, simulação de aporte, risco e correlação entre até 4 ativos."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HeaderSegmented
              value={chartMode}
              onChange={(v) => setChartMode(v as ChartCompareMode)}
              tone="surface"
              options={[
                { id: 'return', label: 'Retorno %' },
                { id: 'invest1k', label: 'Aporte US$ 1k' },
              ]}
            />
            <HeaderSegmented
              value={days}
              onChange={setDays}
              mono
              options={[
                { id: '7', label: '7d' },
                { id: '30', label: '30d' },
                { id: '90', label: '90d' },
              ]}
            />
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={chartRows.length === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card/85 px-3 text-xs font-medium text-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>CSV</span>
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
        <div className="mx-auto w-full max-w-page space-y-5">
          {/* Selected Assets Chips + Quick Presets */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {selectedCoins.map((coin, idx) => (
                <span
                  key={coin.id}
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 shadow-card"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: SERIES_STYLES[idx % SERIES_STYLES.length].color }}
                    aria-hidden="true"
                  />
                  <span className="font-mono font-semibold text-foreground">
                    {coin.symbol.toUpperCase()}
                  </span>
                  <button
                    type="button"
                    disabled={selectedCoins.length <= 1}
                    onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== coin.id))}
                    aria-label={`Remover ${coin.name}`}
                    className="text-muted-foreground hover:text-negative disabled:opacity-30"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}

              {selectedCoins.length < 4 && coins.length > selectedCoins.length ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPickerOpen((prev) => !prev)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-border bg-background/80 px-3 text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Adicionar</span>
                  </button>
                  {pickerOpen ? (
                    <div className="absolute left-0 top-9 z-20 w-64 rounded-lg border border-border/90 bg-card/95 p-2 shadow-xl backdrop-blur-md">
                      <div className="relative mb-2">
                        <Search
                          className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <input
                          type="text"
                          value={pickerSearch}
                          onChange={(e) => setPickerSearch(e.target.value)}
                          placeholder="Buscar moeda ou ticker..."
                          className="h-7 w-full rounded-md border border-border bg-background pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div className="max-h-52 space-y-0.5 overflow-y-auto">
                        {availableToAdd.slice(0, 60).map((coin) => (
                          <button
                            key={coin.id}
                            type="button"
                            onClick={() => {
                              setSelectedIds((prev) => [...prev, coin.id].slice(0, 4));
                              setPickerOpen(false);
                              setPickerSearch('');
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                          >
                            <span className="truncate text-foreground">{coin.name}</span>
                            <span className="font-mono text-[10px] font-semibold text-accent">
                              {coin.symbol.toUpperCase()}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="mr-1 inline-flex items-center gap-1 text-muted-foreground">
                <Sparkles className="h-3 w-3 text-accent" aria-hidden="true" />
                Presets:
              </span>
              <button
                type="button"
                onClick={() => applyPreset(['bitcoin', 'ethereum'])}
                className="rounded-md border border-border/80 bg-card/70 px-2 py-1 text-foreground transition-colors hover:border-accent/50 hover:text-accent"
              >
                BTC vs ETH
              </button>
              <button
                type="button"
                onClick={() => applyPreset(['bitcoin', 'ethereum', 'solana'])}
                className="rounded-md border border-border/80 bg-card/70 px-2 py-1 text-foreground transition-colors hover:border-accent/50 hover:text-accent"
              >
                Top 3 L1
              </button>
              <button
                type="button"
                onClick={() => applyPreset(coins.slice(0, 4).map((c) => c.id))}
                className="rounded-md border border-border/80 bg-card/70 px-2 py-1 text-foreground transition-colors hover:border-accent/50 hover:text-accent"
              >
                Top 4 Cap
              </button>
            </div>
          </div>

          {/* Highlight KPIs Strip */}
          {summaryRows.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/80 bg-card p-3.5 shadow-card">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="uppercase tracking-wider">Líder no período ({days}d)</span>
                  <Award className="h-3.5 w-3.5 text-positive" aria-hidden="true" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {leaderSummary?.coin.name} ({leaderSummary?.coin.symbol.toUpperCase()})
                  </span>
                  <span
                    className={`font-mono text-sm font-semibold tabular-nums ${
                      (leaderSummary?.retPct ?? 0) >= 0 ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {leaderSummary
                      ? formatPercent(leaderSummary.retPct, preferences.numberLocale)
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-card p-3.5 shadow-card">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="uppercase tracking-wider">Menor volatilidade</span>
                  <ShieldAlert className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {lowestVolSummary?.coin.name} ({lowestVolSummary?.coin.symbol.toUpperCase()})
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {lowestVolSummary ? `${lowestVolSummary.periodVolPct.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-card p-3.5 shadow-card">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="uppercase tracking-wider">Spread (1º vs último)</span>
                  <ArrowUpDown className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">
                    {leaderSummary && laggardSummary && summaryRows.length > 1
                      ? `${leaderSummary.coin.symbol.toUpperCase()} vs ${laggardSummary.coin.symbol.toUpperCase()}`
                      : 'Adicione 2+ ativos'}
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-accent">
                    {spreadPct !== null ? `${spreadPct.toFixed(2)} p.p.` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Relative Return / Simulator Chart */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {chartMode === 'invest1k'
                  ? 'Evolução de um aporte hipotético de US$ 1.000,00 no início do período'
                  : 'Retorno relativo desde o início do período (%)'}
              </span>
              {commonStartTs && commonEndTs ? (
                <span className="font-mono text-[11px] tabular-nums">
                  {formatDateShort(commonStartTs, preferences.timezone)} —{' '}
                  {formatDateShort(commonEndTs, preferences.timezone)}
                </span>
              ) : null}
            </div>

            <div className="h-72 w-full">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Carregando séries para comparação...
                </div>
              ) : chartRows.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Selecione ao menos um ativo com histórico disponível.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <ReferenceLine
                      y={chartMode === 'invest1k' ? 1000 : 0}
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity={0.45}
                      strokeDasharray="4 4"
                    />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(ts: number) => formatDateShort(ts, preferences.timezone)}
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 11 }}
                      minTickGap={36}
                    />
                    <YAxis
                      tickFormatter={(v: number) =>
                        chartMode === 'invest1k'
                          ? `$${Math.round(v)}`
                          : `${v > 0 ? '+' : ''}${v}%`
                      }
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 11 }}
                      width={58}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                        fontSize: '12px',
                      }}
                      labelFormatter={(ts) => formatDateTimeFull(Number(ts), preferences.timezone)}
                      formatter={(value, name) => [
                        chartMode === 'invest1k'
                          ? formatCurrencyUSD(Number(value ?? 0), fmtOpts)
                          : formatPercent(Number(value ?? 0), preferences.numberLocale),
                        String(name),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {selectedCoins.map((coin, idx) => {
                      const style = SERIES_STYLES[idx % SERIES_STYLES.length];
                      return (
                        <Line
                          key={coin.id}
                          type="monotone"
                          dataKey={coin.id}
                          name={coin.symbol.toUpperCase()}
                          stroke={style.color}
                          strokeDasharray={style.dash}
                          strokeWidth={1.9}
                          dot={false}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Comparison Metrics Table */}
          {summaryRows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-border bg-nav text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-2.5">Métrica comparativa ({days}d)</th>
                    {summaryRows.map((row) => (
                      <th key={row.coin.id} className="px-3.5 py-2.5 text-right font-mono">
                        {row.coin.symbol.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  <tr>
                    <td className="px-3.5 py-2 text-muted-foreground">Retorno no período</td>
                    {summaryRows.map((row) => (
                      <td
                        key={row.coin.id}
                        className={`px-3.5 py-2 text-right font-semibold ${
                          row.retPct > 0
                            ? 'text-positive'
                            : row.retPct < 0
                              ? 'text-negative'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {formatPercent(row.retPct, preferences.numberLocale)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2 text-muted-foreground">
                      Simulação US$ 1.000 hoje
                    </td>
                    {summaryRows.map((row) => (
                      <td
                        key={row.coin.id}
                        className="px-3.5 py-2 text-right font-mono font-medium text-foreground"
                      >
                        {formatCurrencyUSD(row.invest1kValue, fmtOpts)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2 text-muted-foreground">Máximo Drawdown</td>
                    {summaryRows.map((row) => (
                      <td
                        key={row.coin.id}
                        className="px-3.5 py-2 text-right font-mono text-negative"
                      >
                        {formatPercent(row.maxDrawdown, preferences.numberLocale)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2 text-muted-foreground">Volatilidade no período</td>
                    {summaryRows.map((row) => (
                      <td
                        key={row.coin.id}
                        className="px-3.5 py-2 text-right font-mono text-foreground"
                      >
                        {row.periodVolPct.toFixed(2)}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2 text-muted-foreground">Relação Retorno / Risco</td>
                    {summaryRows.map((row) => (
                      <td
                        key={row.coin.id}
                        className="px-3.5 py-2 text-right font-mono text-foreground"
                      >
                        {row.riskRatio.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2 text-muted-foreground">Preço inicial USD</td>
                    {summaryRows.map((row) => (
                      <td key={row.coin.id} className="px-3.5 py-2 text-right text-foreground">
                        {formatCurrencyUSD(row.startPrice, fmtOpts)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2 text-muted-foreground">Preço final USD</td>
                    {summaryRows.map((row) => (
                      <td
                        key={row.coin.id}
                        className="px-3.5 py-2 text-right font-medium text-foreground"
                      >
                        {formatCurrencyUSD(row.endPrice, fmtOpts)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2 text-muted-foreground">Capitalização atual</td>
                    {summaryRows.map((row) => (
                      <td
                        key={row.coin.id}
                        className="px-3.5 py-2 text-right font-mono text-muted-foreground"
                      >
                        US$ {formatCompactNumber(row.coin.marketCap, preferences.numberLocale)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}

          {/* Pearson Correlation Matrix */}
          {correlationMatrix.length > 1 ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-nav/60 px-4 py-2.5 text-xs">
                <span className="font-semibold text-foreground">
                  Matriz de Correlação (Retornos no período)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  +1,00 = movimento idêntico · 0,00 = independente · -1,00 = movimento inverso
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                      <th className="px-4 py-2 text-left">Ativo</th>
                      {correlationMatrix.map((col) => (
                        <th key={col.rowCoin.id} className="px-4 py-2 text-center font-mono">
                          {col.rowCoin.symbol.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {correlationMatrix.map((row, rIdx) => (
                      <tr key={row.rowCoin.id}>
                        <td className="px-4 py-2 font-mono font-semibold text-foreground">
                          {row.rowCoin.symbol.toUpperCase()}
                        </td>
                        {row.values.map((val, cIdx) => {
                          const isDiag = rIdx === cIdx;
                          const badgeClass =
                            val == null
                              ? 'text-muted-foreground'
                              : isDiag
                                ? 'bg-muted/60 text-muted-foreground'
                                : val >= 0.75
                                  ? 'bg-positive/15 text-positive'
                                  : val >= 0.35
                                    ? 'bg-accent/15 text-accent'
                                    : val <= -0.2
                                      ? 'bg-negative/15 text-negative'
                                      : 'bg-amber-500/15 text-amber-400';

                          return (
                            <td key={cIdx} className="px-4 py-2 text-center">
                              <span
                                className={`inline-block min-w-[54px] rounded-md px-2 py-0.5 font-mono text-[11px] font-medium ${badgeClass}`}
                              >
                                {val == null ? '—' : val.toFixed(2)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
