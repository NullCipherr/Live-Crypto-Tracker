import { useMemo, useRef, useState } from 'react';
import type { CoinMarket } from '../../types/crypto';
import {
  computeDistributionStats,
  downloadChartPng,
  downloadChartSvg,
  downloadCsvRows,
  type DailySeriesPoint,
  type DistributionStats,
} from '../../lib/analytics';
import { formatDateShort, formatPercent } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { ChartToolbar } from './ChartToolbar';
import type { DataInspectorPayload } from './DataInspectorModal';

export interface BoxplotAssetInput {
  coin: CoinMarket;
  daily: DailySeriesPoint[];
  returns: Map<string, number>;
}

interface ReturnsBoxplotCardProps {
  items: BoxplotAssetInput[];
  periodLabel: string;
  onInspectCoin: (coinId: string) => void;
  onInspectData: (payload: DataInspectorPayload) => void;
  onAddToReport?: (note: string) => void;
}

export function ReturnsBoxplotCard({
  items,
  periodLabel,
  onInspectCoin,
  onInspectData,
  onAddToReport,
}: ReturnsBoxplotCardProps) {
  const { preferences } = usePreferences();
  const [sortBy, setSortBy] = useState<'dispersion' | 'median' | 'name'>('dispersion');
  const [showDaysOverride, setShowDaysOverride] = useState<boolean | null>(null);
  const [showData, setShowData] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{
    coin: CoinMarket;
    dayKey: string;
    timestamp: number;
    ret: number;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  const computed = useMemo(() => {
    const rows = items.map((item) => ({
      coin: item.coin,
      stats: computeDistributionStats(item.daily, item.returns),
      returns: item.returns,
    }));

    rows.sort((a, b) => {
      if (sortBy === 'median') return b.stats.median - a.stats.median;
      if (sortBy === 'name') return a.coin.symbol.localeCompare(b.coin.symbol);
      return b.stats.iqr - a.stats.iqr;
    });

    let globalMin = -4;
    let globalMax = 4;
    for (const r of rows) {
      if (r.stats.min < globalMin) globalMin = r.stats.min;
      if (r.stats.max > globalMax) globalMax = r.stats.max;
    }
    const maxAbs = Math.max(Math.abs(globalMin), Math.abs(globalMax), 4);
    const bound = Math.ceil(maxAbs / 2) * 2;
    const sampleCount = rows[0]?.stats.points.length ?? 0;

    return { rows, minScale: -bound, maxScale: bound, sampleCount };
  }, [items, sortBy]);

  const showDays = showDaysOverride ?? computed.sampleCount <= 10;

  const scaleX = (val: number) => {
    const span = computed.maxScale - computed.minScale || 1;
    return ((val - computed.minScale) / span) * 100;
  };

  const btcItem = items.find((i) => i.coin.symbol.toLowerCase() === 'btc');
  const btcOnSelectedDay =
    selectedPoint && btcItem ? btcItem.returns.get(selectedPoint.dayKey) : undefined;

  const formatDistNote = (stats: DistributionStats, coin: CoinMarket) =>
    `${coin.symbol.toUpperCase()}: mediana ${formatPercent(stats.median, preferences.numberLocale)}, amplitude [${formatPercent(stats.min, preferences.numberLocale)} a ${formatPercent(stats.max, preferences.numberLocale)}]`;

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-foreground">
            Distribuição dos retornos diários
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Caixa = 50% centrais (Q1–Q3) · linha interna = mediana · pontos = dias extremos (n ={' '}
            {computed.sampleCount})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Ordenar boxplot"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'dispersion' | 'median' | 'name')}
            className="h-6 rounded border border-border bg-background px-2 text-[11px] text-foreground"
          >
            <option value="dispersion">Ordenar: Dispersão</option>
            <option value="median">Ordenar: Mediana</option>
            <option value="name">Ordenar: Nome</option>
          </select>

          <button
            type="button"
            onClick={() => setShowDaysOverride(!showDays)}
            className={`h-6 rounded border px-2 text-[11px] font-medium ${
              showDays
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            Mostrar dias: {showDays ? 'sim' : 'não'}
          </button>

          <ChartToolbar
            showData={showData}
            onToggleData={() => setShowData((p) => !p)}
            onInspectData={() =>
              onInspectData({
                title: 'Distribuição dos retornos diários (Boxplot)',
                source: 'CoinGecko API v3 (/coins/{id}/market_chart)',
                unit: 'Retorno diário (%)',
                timezone: preferences.timezone,
                requestedPeriod: periodLabel,
                coveredPeriod: `${computed.sampleCount} retornos diários`,
                observationCount: computed.sampleCount * computed.rows.length,
                excludedCount: 0,
                formula:
                  'Quartis Q1 (25%), Mediana (50%) e Q3 (75%) sobre retornos diários; extremos fora de [Q1 − 1,5×IQR, Q3 + 1,5×IQR].',
              })
            }
            onExportPng={() =>
              downloadChartPng(
                cardRef.current,
                'Distribuição dos retornos diários',
                periodLabel,
                'boxplot-retornos.png'
              )
            }
            onExportSvg={() =>
              downloadChartSvg(
                cardRef.current,
                'Distribuição dos retornos diários',
                periodLabel,
                'boxplot-retornos.svg'
              )
            }
            onExportCsv={() =>
              downloadCsvRows(
                'boxplot-retornos.csv',
                ['ticker', 'min_pct', 'q1_pct', 'mediana_pct', 'q3_pct', 'max_pct'],
                computed.rows.map((r) => [
                  r.coin.symbol.toUpperCase(),
                  r.stats.min.toFixed(2),
                  r.stats.q1.toFixed(2),
                  r.stats.median.toFixed(2),
                  r.stats.q3.toFixed(2),
                  r.stats.max.toFixed(2),
                ])
              )
            }
            onAddToReport={
              onAddToReport && computed.rows[0]
                ? () =>
                    onAddToReport(
                      selectedPoint
                        ? `${selectedPoint.coin.symbol.toUpperCase()} em ${formatDateShort(selectedPoint.timestamp, preferences.timezone)}: retorno ${formatPercent(selectedPoint.ret, preferences.numberLocale)}`
                        : formatDistNote(computed.rows[0].stats, computed.rows[0].coin)
                    )
                : undefined
            }
          />
        </div>
      </div>

      {showData ? (
        <div className="mt-3 overflow-x-auto rounded border border-border bg-background">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-border bg-nav text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5">Ativo</th>
                <th className="px-3 py-1.5 text-right">Mín.</th>
                <th className="px-3 py-1.5 text-right">Q1</th>
                <th className="px-3 py-1.5 text-right">Mediana</th>
                <th className="px-3 py-1.5 text-right">Q3</th>
                <th className="px-3 py-1.5 text-right">Máx.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {computed.rows.map((r) => (
                <tr key={r.coin.id}>
                  <td className="px-3 py-1.5 font-mono font-semibold text-accent">
                    {r.coin.symbol.toUpperCase()}
                  </td>
                  <td className="px-3 py-1.5 text-right text-negative">
                    {formatPercent(r.stats.min, preferences.numberLocale)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-foreground">
                    {formatPercent(r.stats.q1, preferences.numberLocale)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-foreground">
                    {formatPercent(r.stats.median, preferences.numberLocale)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-foreground">
                    {formatPercent(r.stats.q3, preferences.numberLocale)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-positive">
                    {formatPercent(r.stats.max, preferences.numberLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={cardRef} className="mt-4 space-y-2.5">
          {/* Scale Header */}
          <div className="grid grid-cols-[52px_1fr] items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span />
            <div className="flex justify-between border-b border-border pb-1 tabular-nums">
              <span>{computed.minScale}%</span>
              <span>{computed.minScale / 2}%</span>
              <span>0%</span>
              <span>+{computed.maxScale / 2}%</span>
              <span>+{computed.maxScale}%</span>
            </div>
          </div>

          {computed.rows.map(({ coin, stats }) => {
            const minX = scaleX(stats.min);
            const q1X = scaleX(stats.q1);
            const medX = scaleX(stats.median);
            const q3X = scaleX(stats.q3);
            const maxX = scaleX(stats.max);
            const zeroX = scaleX(0);

            return (
              <div key={coin.id} className="grid grid-cols-[52px_1fr] items-center gap-3 text-xs">
                <span className="font-mono text-[11px] font-semibold text-foreground">
                  {coin.symbol.toUpperCase()}
                </span>

                <div className="relative h-6">
                  {/* Zero line */}
                  <div
                    className="absolute bottom-0 top-0 w-px bg-border"
                    style={{ left: `${zeroX}%` }}
                  />
                  {/* Whisker min-max */}
                  <div
                    className="absolute top-1/2 h-px -translate-y-1/2 bg-muted-foreground/60"
                    style={{ left: `${minX}%`, width: `${Math.max(maxX - minX, 0.5)}%` }}
                  />
                  {/* IQR Box */}
                  <div
                    className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm border border-accent bg-accent/25"
                    style={{ left: `${q1X}%`, width: `${Math.max(q3X - q1X, 1)}%` }}
                  />
                  {/* Median */}
                  <div
                    className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-foreground"
                    style={{ left: `${medX}%` }}
                  />

                  {/* Points (either all days or outliers only) */}
                  {stats.points
                    .filter((pt) => showDays || pt.isOutlier)
                    .map((pt) => (
                      <button
                        key={pt.dayKey}
                        type="button"
                        onClick={() => setSelectedPoint({ coin, ...pt })}
                        style={{ left: `${scaleX(pt.ret)}%` }}
                        title={`${coin.symbol.toUpperCase()} · ${formatDateShort(pt.timestamp, preferences.timezone)}: ${formatPercent(pt.ret, preferences.numberLocale)}`}
                        aria-label={`Selecionar retorno de ${coin.symbol.toUpperCase()} em ${formatDateShort(pt.timestamp, preferences.timezone)}`}
                        className={`absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                          pt.isOutlier
                            ? 'border-warning bg-warning/80'
                            : 'border-accent bg-background'
                        } hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPoint ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-background px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-3 tabular-nums">
            <span className="font-mono font-semibold text-accent">
              {selectedPoint.coin.symbol.toUpperCase()} /{' '}
              {formatDateShort(selectedPoint.timestamp, preferences.timezone)}
            </span>
            <span>
              Retorno:{' '}
              <strong
                className={selectedPoint.ret >= 0 ? 'text-positive' : 'text-negative'}
              >
                {formatPercent(selectedPoint.ret, preferences.numberLocale)}
              </strong>
            </span>
            {btcOnSelectedDay !== undefined ? (
              <span className="text-muted-foreground">
                BTC no dia:{' '}
                <span className="font-mono text-foreground">
                  {formatPercent(btcOnSelectedDay, preferences.numberLocale)}
                </span>
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onInspectCoin(selectedPoint.coin.id)}
            className="rounded border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-muted"
          >
            Ver no ativo
          </button>
        </div>
      ) : null}
    </div>
  );
}
