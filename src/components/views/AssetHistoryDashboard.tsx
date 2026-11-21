import { useMemo, useState } from 'react';
import type { ApexOptions } from 'apexcharts';
import {
  Activity,
  BarChart3,
  Download,
  LineChart as LineChartIcon,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { AssetOhlcPoint, CoinMarket } from '../../types/crypto';
import { usePreferences } from '../../hooks/usePreferences';
import {
  formatCurrencyUSD,
  formatDateShort,
  formatDateTimeFull,
  formatPercent,
  formatPrice,
} from '../../lib/formatters';
import { ApexChartWrapper } from '../analytics/ApexChartWrapper';
import { HeaderSegmented } from '../shell/PageHeader';
import { CustomSelect } from '../ui/CustomSelect';

export type OhlcRange = '7' | '14' | '30' | '90';
type HistoryChartMode = 'candlestick' | 'forecast';
type ForecastHorizon = 5 | 10 | 15;

interface AssetHistoryDashboardProps {
  coin: CoinMarket;
  ohlcCandles: AssetOhlcPoint[] | undefined;
  isOhlcLoading: boolean;
  isOhlcError: boolean;
  ohlcRange: OhlcRange;
  onOhlcRangeChange: (range: OhlcRange) => void;
  onExportCsv: () => void;
}

function computeEma(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function computeRsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

interface LinearForecastResult {
  slope: number;
  intercept: number;
  rSquared: number;
  residualStd: number;
  projected: { timestamp: number; base: number; upper: number; lower: number }[];
  targetPrice: number;
  upperPrice: number;
  lowerPrice: number;
  expectedChangePct: number;
}

function computeLinearForecast(
  candles: AssetOhlcPoint[],
  horizon: number
): LinearForecastResult | null {
  const n = candles.length;
  if (n < 4) return null;

  const ys = candles.map((c) => c.close);
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += ys[i];
    sumXY += i * ys[i];
    sumXX += i * i;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * i + intercept;
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }

  const rSquared = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;
  const residualStd = Math.sqrt(ssRes / Math.max(1, n - 2));

  const stepMs =
    n >= 2
      ? Math.max(60_000, candles[n - 1].timestamp - candles[n - 2].timestamp)
      : 3_600_000;
  const lastTs = candles[n - 1].timestamp;
  const lastClose = ys[n - 1];

  const projected: { timestamp: number; base: number; upper: number; lower: number }[] = [];
  for (let step = 1; step <= horizon; step++) {
    const idx = n - 1 + step;
    const base = Math.max(0, slope * idx + intercept);
    const band = residualStd * Math.sqrt(1 + step / n);
    projected.push({
      timestamp: lastTs + step * stepMs,
      base,
      upper: base + band,
      lower: Math.max(0, base - band),
    });
  }

  const lastProj = projected[projected.length - 1];
  const expectedChangePct =
    lastClose > 0 ? ((lastProj.base - lastClose) / lastClose) * 100 : 0;

  return {
    slope,
    intercept,
    rSquared,
    residualStd,
    projected,
    targetPrice: lastProj.base,
    upperPrice: lastProj.upper,
    lowerPrice: lastProj.lower,
    expectedChangePct,
  };
}

export function AssetHistoryDashboard({
  coin,
  ohlcCandles,
  isOhlcLoading,
  isOhlcError,
  ohlcRange,
  onOhlcRangeChange,
  onExportCsv,
}: AssetHistoryDashboardProps) {
  const { preferences } = usePreferences();
  const [chartMode, setChartMode] = useState<HistoryChartMode>('forecast');
  const [horizon, setHorizon] = useState<ForecastHorizon>(10);
  const [showEma9, setShowEma9] = useState(true);
  const [showEma21, setShowEma21] = useState(true);
  const [showBands, setShowBands] = useState(true);

  const fmtOpts = useMemo(
    () => ({
      locale: preferences.numberLocale,
      decimalMode: preferences.decimalMode,
    }),
    [preferences.numberLocale, preferences.decimalMode]
  );

  const stats = useMemo(() => {
    if (!ohlcCandles || ohlcCandles.length === 0) return null;
    const closes = ohlcCandles.map((c) => c.close);
    const high = Math.max(...ohlcCandles.map((c) => c.high));
    const low = Math.min(...ohlcCandles.map((c) => c.low));
    const firstOpen = ohlcCandles[0].open;
    const lastClose = ohlcCandles[ohlcCandles.length - 1].close;
    const periodPct = firstOpen > 0 ? ((lastClose - firstOpen) / firstOpen) * 100 : 0;
    const spreadPct = low > 0 ? ((high - low) / low) * 100 : 0;

    let bullishCount = 0;
    let totalRangePct = 0;
    for (const c of ohlcCandles) {
      if (c.close >= c.open) bullishCount++;
      if (c.open > 0) totalRangePct += ((c.high - c.low) / c.open) * 100;
    }

    const avgCandleVolatility = totalRangePct / ohlcCandles.length;
    const bullishRatio = (bullishCount / ohlcCandles.length) * 100;
    const ema9 = computeEma(closes, 9);
    const ema21 = computeEma(closes, 21);
    const rsi14 = computeRsi(closes, 14);
    const forecast = computeLinearForecast(ohlcCandles, horizon);

    const lastEma9 = ema9[ema9.length - 1] ?? lastClose;
    const lastEma21 = ema21[ema21.length - 1] ?? lastClose;
    const emaSignal: 'alta' | 'baixa' | 'neutro' =
      lastEma9 > lastEma21 * 1.002 ? 'alta' : lastEma9 < lastEma21 * 0.998 ? 'baixa' : 'neutro';

    return {
      high,
      low,
      firstOpen,
      lastClose,
      periodPct,
      spreadPct,
      avgCandleVolatility,
      bullishCount,
      bullishRatio,
      ema9,
      ema21,
      rsi14,
      emaSignal,
      forecast,
    };
  }, [ohlcCandles, horizon]);

  const candlestickSeries = useMemo<NonNullable<ApexOptions['series']>>(() => {
    if (!ohlcCandles || ohlcCandles.length === 0) return [];
    return [
      {
        name: coin.symbol.toUpperCase(),
        data: ohlcCandles.map((c) => ({
          x: c.timestamp,
          y: [c.open, c.high, c.low, c.close],
        })),
      },
    ];
  }, [ohlcCandles, coin.symbol]);

  const forecastSeries = useMemo<NonNullable<ApexOptions['series']>>(() => {
    if (!ohlcCandles || ohlcCandles.length === 0 || !stats) return [];

    const closeData = ohlcCandles.map((c) => ({ x: c.timestamp, y: c.close }));
    const series: NonNullable<ApexOptions['series']> = [
      {
        name: 'Fechamento',
        type: 'line',
        data: closeData,
      },
    ];

    if (showEma9) {
      series.push({
        name: 'EMA 9',
        type: 'line',
        data: ohlcCandles.map((c, idx) => ({
          x: c.timestamp,
          y: Number(stats.ema9[idx].toFixed(6)),
        })),
      });
    }

    if (showEma21) {
      series.push({
        name: 'EMA 21',
        type: 'line',
        data: ohlcCandles.map((c, idx) => ({
          x: c.timestamp,
          y: Number(stats.ema21[idx].toFixed(6)),
        })),
      });
    }

    if (stats.forecast) {
      const lastCandle = ohlcCandles[ohlcCandles.length - 1];
      const baseForecastData = [
        { x: lastCandle.timestamp, y: lastCandle.close },
        ...stats.forecast.projected.map((p) => ({
          x: p.timestamp,
          y: Number(p.base.toFixed(6)),
        })),
      ];
      series.push({
        name: `Previsão (+${horizon} candles)`,
        type: 'line',
        data: baseForecastData,
      });

      if (showBands) {
        series.push({
          name: 'Cenário Otimista (+1σ)',
          type: 'line',
          data: [
            { x: lastCandle.timestamp, y: lastCandle.close },
            ...stats.forecast.projected.map((p) => ({
              x: p.timestamp,
              y: Number(p.upper.toFixed(6)),
            })),
          ],
        });
        series.push({
          name: 'Cenário Cauteloso (-1σ)',
          type: 'line',
          data: [
            { x: lastCandle.timestamp, y: lastCandle.close },
            ...stats.forecast.projected.map((p) => ({
              x: p.timestamp,
              y: Number(p.lower.toFixed(6)),
            })),
          ],
        });
      }
    }

    return series;
  }, [ohlcCandles, stats, showEma9, showEma21, showBands, horizon]);

  const candlestickOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: `history-candle-${coin.id}`,
        zoom: { enabled: true },
        toolbar: { show: true },
      },
      plotOptions: {
        candlestick: {
          colors: {
            upward: '#22c55e',
            downward: '#ef4444',
          },
          wick: { useFillColor: true },
        },
      },
      xaxis: {
        type: 'datetime',
        labels: {
          formatter: (val) => formatDateShort(Number(val), preferences.timezone),
        },
      },
      yaxis: {
        tooltip: { enabled: true },
        labels: {
          formatter: (val) => formatPrice(val, fmtOpts),
        },
      },
      tooltip: {
        x: {
          formatter: (val) => formatDateTimeFull(Number(val), preferences.timezone),
        },
      },
    }),
    [coin.id, preferences.timezone, fmtOpts]
  );

  const forecastOptions = useMemo<ApexOptions>(() => {
    const colors: string[] = ['#3b82f6'];
    const widths: number[] = [2.25];
    const dashes: number[] = [0];

    if (showEma9) {
      colors.push('#f59e0b');
      widths.push(1.5);
      dashes.push(0);
    }
    if (showEma21) {
      colors.push('#a855f7');
      widths.push(1.5);
      dashes.push(0);
    }
    if (stats?.forecast) {
      colors.push('#22c55e');
      widths.push(2.25);
      dashes.push(6);
      if (showBands) {
        colors.push('#38bdf8', '#ef4444');
        widths.push(1.25, 1.25);
        dashes.push(4, 4);
      }
    }

    return {
      chart: {
        id: `history-forecast-${coin.id}`,
        zoom: { enabled: true },
        toolbar: { show: true },
      },
      colors,
      stroke: {
        curve: 'smooth',
        width: widths,
        dashArray: dashes,
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'left',
        fontSize: '11px',
      },
      xaxis: {
        type: 'datetime',
        labels: {
          formatter: (val) => formatDateShort(Number(val), preferences.timezone),
        },
      },
      yaxis: {
        labels: {
          formatter: (val) => formatPrice(val, fmtOpts),
        },
      },
      tooltip: {
        shared: true,
        x: {
          formatter: (val) => formatDateTimeFull(Number(val), preferences.timezone),
        },
        y: {
          formatter: (val) =>
            typeof val === 'number' && Number.isFinite(val) ? formatCurrencyUSD(val, fmtOpts) : '—',
        },
      },
    };
  }, [coin.id, showEma9, showEma21, showBands, stats?.forecast, preferences.timezone, fmtOpts]);

  const rsiLabel =
    stats?.rsi14 == null
      ? 'Indisponível'
      : stats.rsi14 >= 70
        ? 'Sobrecomprado'
        : stats.rsi14 <= 30
          ? 'Sobrevendido'
          : 'Zona neutra';

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3.5 text-xs shadow-card">
        <div className="flex flex-wrap items-center gap-2.5">
          <HeaderSegmented
            value={ohlcRange}
            onChange={(v) => onOhlcRangeChange(v as OhlcRange)}
            mono
            options={[
              { id: '7', label: '7D' },
              { id: '14', label: '14D' },
              { id: '30', label: '30D' },
              { id: '90', label: '90D' },
            ]}
          />

          <HeaderSegmented
            value={chartMode}
            onChange={(v) => setChartMode(v as HistoryChartMode)}
            tone="surface"
            options={[
              { id: 'forecast', label: 'Linha + Previsão' },
              { id: 'candlestick', label: 'Candles OHLC' },
            ]}
          />

          {chartMode === 'forecast' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowEma9((p) => !p)}
                className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                  showEma9
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                EMA 9
              </button>
              <button
                type="button"
                onClick={() => setShowEma21((p) => !p)}
                className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                  showEma21
                    ? 'border-purple-500/50 bg-purple-500/15 text-purple-400'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                EMA 21
              </button>
              <button
                type="button"
                onClick={() => setShowBands((p) => !p)}
                className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                  showBands
                    ? 'border-sky-500/50 bg-sky-500/15 text-sky-400'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                Banda ±1σ
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {chartMode === 'forecast' ? (
            <CustomSelect
              ariaLabel="Horizonte de previsão"
              value={String(horizon)}
              onChange={(v) => setHorizon(Number(v) as ForecastHorizon)}
              searchable={false}
              menuWidth={180}
              className="h-7 rounded-md bg-background px-2.5 text-[11px]"
              options={[
                { value: '5', label: 'Previsão: +5 candles' },
                { value: '10', label: 'Previsão: +10 candles' },
                { value: '15', label: 'Previsão: +15 candles' },
              ]}
            />
          ) : null}

          <button
            type="button"
            onClick={onExportCsv}
            disabled={!ohlcCandles || ohlcCandles.length === 0}
            className="inline-flex h-7 items-center gap-1.5 rounded border border-border bg-background px-2.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-card">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Retorno no período ({ohlcRange}D)
            </p>
            <p
              className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                stats.periodPct >= 0 ? 'text-positive' : 'text-negative'
              }`}
            >
              {formatPercent(stats.periodPct, preferences.numberLocale)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
              {formatPrice(stats.firstOpen, fmtOpts)} → {formatPrice(stats.lastClose, fmtOpts)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-card">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Faixa Máx / Mín
            </p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
              {formatPercent(stats.spreadPct, preferences.numberLocale)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
              {formatPrice(stats.low, fmtOpts)} – {formatPrice(stats.high, fmtOpts)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-card">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Volatilidade & Candles
            </p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
              {stats.avgCandleVolatility.toFixed(2)}%
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
              {Math.round(stats.bullishRatio)}% candles positivos ({stats.bullishCount}/{ohlcCandles?.length ?? 0})
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-card">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Alvo Projetado (+{horizon} candles)
            </p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-accent">
              {stats.forecast ? formatCurrencyUSD(stats.forecast.targetPrice, fmtOpts) : '—'}
            </p>
            <p
              className={`mt-0.5 text-[11px] font-medium tabular-nums ${
                (stats.forecast?.expectedChangePct ?? 0) >= 0 ? 'text-positive' : 'text-negative'
              }`}
            >
              {stats.forecast
                ? `${formatPercent(stats.forecast.expectedChangePct, preferences.numberLocale)} vs atual`
                : 'Amostra insuficiente'}
            </p>
          </div>
        </div>
      ) : null}

      {/* Interactive Chart */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {chartMode === 'candlestick' ? (
              <BarChart3 className="h-4 w-4 text-accent" aria-hidden="true" />
            ) : (
              <LineChartIcon className="h-4 w-4 text-accent" aria-hidden="true" />
            )}
            <h3 className="text-xs font-semibold text-foreground">
              {chartMode === 'candlestick'
                ? `Candles OHLC · ${coin.name} (${ohlcRange} dias)`
                : `Série Histórica & Previsão Linear · ${coin.name} (${ohlcRange} dias)`}
            </h3>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            Fuso: {preferences.timezone} · Use o scroll/arrasto para zoom
          </span>
        </div>

        <div className="h-[340px] w-full">
          {isOhlcLoading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Carregando dashboard histórico...
            </div>
          ) : isOhlcError || !ohlcCandles || ohlcCandles.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Não foi possível obter candles OHLC para este período.
            </div>
          ) : chartMode === 'candlestick' ? (
            <ApexChartWrapper
              type="candlestick"
              series={candlestickSeries}
              options={candlestickOptions}
              height={340}
            />
          ) : (
            <ApexChartWrapper
              type="line"
              series={forecastSeries}
              options={forecastOptions}
              height={340}
            />
          )}
        </div>
      </div>

      {/* Quantitative Predictors Panel */}
      {stats?.forecast ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {/* Linear Regression Predictor */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Previsor de Tendência (OLS)
              </span>
              <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
                R² {(stats.forecast.rSquared * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Projeção linear para os próximos <strong className="text-foreground">{horizon}</strong>{' '}
              intervalos com base nos fechamentos do período.
            </p>
            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-2.5 text-xs tabular-nums">
              <span className="text-muted-foreground">Alvo base</span>
              <span className="font-mono font-semibold text-foreground">
                {formatCurrencyUSD(stats.forecast.targetPrice, fmtOpts)}
              </span>
            </div>
          </div>

          {/* Scenario Bands */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                {stats.forecast.expectedChangePct >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-positive" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-negative" aria-hidden="true" />
                )}
                Cenários de Projeção (±1σ)
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">Desvio residual</span>
            </div>
            <div className="mt-3 space-y-2 text-xs tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-sky-400">Otimista (+1σ)</span>
                <span className="font-mono font-medium text-foreground">
                  {formatCurrencyUSD(stats.forecast.upperPrice, fmtOpts)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-negative">Cauteloso (-1σ)</span>
                <span className="font-mono font-medium text-foreground">
                  {formatCurrencyUSD(stats.forecast.lowerPrice, fmtOpts)}
                </span>
              </div>
            </div>
          </div>

          {/* Momentum & EMA Crossover */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Activity className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Momentum (RSI 14 & EMA)
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  stats.emaSignal === 'alta'
                    ? 'bg-positive/15 text-positive'
                    : stats.emaSignal === 'baixa'
                      ? 'bg-negative/15 text-negative'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                EMA {stats.emaSignal}
              </span>
            </div>
            <div className="mt-3 space-y-2 text-xs tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">RSI (14)</span>
                <span className="font-mono font-semibold text-foreground">
                  {stats.rsi14 != null ? stats.rsi14.toFixed(1) : '—'} · {rsiLabel}
                </span>
              </div>
              {stats.rsi14 != null ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      stats.rsi14 >= 70
                        ? 'bg-negative'
                        : stats.rsi14 <= 30
                          ? 'bg-positive'
                          : 'bg-accent'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, stats.rsi14))}%` }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Detailed OHLC Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border bg-nav/60 px-4 py-2.5 text-xs">
          <span className="font-semibold text-foreground">Registros OHLC (USD)</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {ohlcCandles?.length ?? 0} candles
          </span>
        </div>

        {isOhlcLoading ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Carregando histórico OHLC...
          </p>
        ) : isOhlcError || !ohlcCandles || ohlcCandles.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Não foi possível obter candles OHLC para este período.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 border-b border-border bg-nav text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Data / Hora</th>
                  <th className="px-3 py-2 text-right">Abertura USD</th>
                  <th className="px-3 py-2 text-right">Máxima USD</th>
                  <th className="px-3 py-2 text-right">Mínima USD</th>
                  <th className="px-3 py-2 text-right">Fechamento USD</th>
                  <th className="px-3 py-2 text-right">Var. %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {[...ohlcCandles].reverse().map((c) => {
                  const pct = c.open > 0 ? ((c.close - c.open) / c.open) * 100 : 0;
                  return (
                    <tr key={c.timestamp} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {formatDateTimeFull(c.timestamp, preferences.timezone)}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {formatPrice(c.open, fmtOpts)}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {formatPrice(c.high, fmtOpts)}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {formatPrice(c.low, fmtOpts)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-foreground">
                        {formatPrice(c.close, fmtOpts)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-medium ${
                          pct > 0
                            ? 'text-positive'
                            : pct < 0
                              ? 'text-negative'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {formatPercent(pct, preferences.numberLocale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Granularidade automática entregue pelo endpoint OHLC da CoinGecko. Previsores são projeções
        estatísticas baseadas no histórico e não constituem recomendação financeira.
      </p>
    </div>
  );
}
