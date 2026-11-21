import { useMemo, useRef, useState } from 'react';
import { formatDateShort } from '../../lib/formatters';
import { downloadChartPng, downloadChartSvg, downloadCsvRows } from '../../lib/analytics';
import { usePreferences } from '../../hooks/usePreferences';
import { ChartToolbar } from './ChartToolbar';
import { ChartCardHeader } from './ChartCard';
import type { DataInspectorPayload } from './DataInspectorModal';

export interface DailyBreadthRow {
  dayKey: string;
  timestamp: number;
  upTickers: string[];
  flatTickers: string[];
  downTickers: string[];
}

interface MarketBreadthTimelineCardProps {
  rows: DailyBreadthRow[];
  periodLabel: string;
  onInspectData: (payload: DataInspectorPayload) => void;
}

export function MarketBreadthTimelineCard({
  rows,
  periodLabel,
  onInspectData,
}: MarketBreadthTimelineCardProps) {
  const { preferences } = usePreferences();
  const [unit, setUnit] = useState<'count' | 'pct'>('pct');
  const [showData, setShowData] = useState(false);
  const [selectedDayDrops, setSelectedDayDrops] = useState<DailyBreadthRow | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const displayedRows = useMemo(() => rows.slice(-14), [rows]);

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <ChartCardHeader
        title="Amplitude de mercado"
        subtitle="Participação dos ativos por dia · clique na barra de queda para ver as moedas"
        right={
          <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-7 items-center rounded-lg border border-border/80 bg-card/85 p-0.5 text-[11px] shadow-card">
            <button
              type="button"
              onClick={() => setUnit('count')}
              className={`h-full rounded-md px-2.5 font-medium transition-colors ${
                unit === 'count'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Contagem
            </button>
            <button
              type="button"
              onClick={() => setUnit('pct')}
              className={`h-full rounded-md px-2.5 font-medium transition-colors ${
                unit === 'pct'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              %
            </button>
          </div>

          <ChartToolbar
            showData={showData}
            onToggleData={() => setShowData((p) => !p)}
            onInspectData={() =>
              onInspectData({
                title: 'Amplitude de mercado diária',
                source: 'CoinGecko API v3 (/coins/{id}/market_chart)',
                unit: unit === 'pct' ? 'Percentual (%)' : 'Contagem de ativos',
                timezone: preferences.timezone,
                requestedPeriod: periodLabel,
                coveredPeriod: `${rows.length} dias`,
                observationCount: rows.length,
                excludedCount: 0,
                formula:
                  'Alta: retorno diário > +0,25% · Estável: −0,25% a +0,25% · Queda: < −0,25%.',
              })
            }
            onExportPng={() =>
              downloadChartPng(
                cardRef.current,
                'Amplitude de mercado',
                periodLabel,
                'amplitude-mercado.png'
              )
            }
            onExportSvg={() =>
              downloadChartSvg(
                cardRef.current,
                'Amplitude de mercado',
                periodLabel,
                'amplitude-mercado.svg'
              )
            }
            onExportCsv={() =>
              downloadCsvRows(
                'amplitude-mercado.csv',
                ['data', 'em_alta', 'estaveis', 'em_queda'],
                rows.map((r) => [
                  r.dayKey,
                  r.upTickers.length,
                  r.flatTickers.length,
                  r.downTickers.length,
                ])
              )
            }
          />
          </div>
        }
      />

      {showData ? (
        <div className="mt-3 max-h-56 overflow-auto rounded border border-border bg-background">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 border-b border-border bg-nav text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5">Data</th>
                <th className="px-3 py-1.5 text-right">Alta</th>
                <th className="px-3 py-1.5 text-right">Estável</th>
                <th className="px-3 py-1.5 text-right">Queda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {displayedRows.map((r) => (
                <tr key={r.dayKey}>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">
                    {formatDateShort(r.timestamp, preferences.timezone)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-positive">{r.upTickers.length}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {r.flatTickers.length}
                  </td>
                  <td className="px-3 py-1.5 text-right text-negative">{r.downTickers.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={cardRef} className="mt-3 space-y-1.5">
          {displayedRows.map((row) => {
            const total =
              row.upTickers.length + row.flatTickers.length + row.downTickers.length || 1;
            const upPct = (row.upTickers.length / total) * 100;
            const flatPct = (row.flatTickers.length / total) * 100;
            const downPct = (row.downTickers.length / total) * 100;

            return (
              <div
                key={row.dayKey}
                className="grid grid-cols-[64px_1fr_92px] items-center gap-3 text-xs"
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatDateShort(row.timestamp, preferences.timezone)}
                </span>

                <div className="flex h-3 w-full overflow-hidden rounded bg-background">
                  {upPct > 0 ? (
                    <div
                      className="h-full bg-positive/80 transition-[width] duration-300 ease-out"
                      style={{ width: `${upPct}%` }}
                      title={`Em alta: ${row.upTickers.join(', ')}`}
                    />
                  ) : null}
                  {flatPct > 0 ? (
                    <div
                      className="h-full bg-muted-foreground/40 transition-[width] duration-300 ease-out"
                      style={{ width: `${flatPct}%` }}
                      title={`Estáveis: ${row.flatTickers.join(', ')}`}
                    />
                  ) : null}
                  {downPct > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSelectedDayDrops(row)}
                      className="h-full bg-negative/80 transition-[width,background-color] duration-300 ease-out hover:bg-negative focus-visible:outline-none"
                      style={{ width: `${downPct}%` }}
                      title={`Em queda: ${row.downTickers.join(', ')} (clique para listar)`}
                      aria-label={`Ver ativos em queda em ${formatDateShort(row.timestamp, preferences.timezone)}`}
                    />
                  ) : null}
                </div>

                <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {unit === 'count'
                    ? `${row.upTickers.length} / ${row.flatTickers.length} / ${row.downTickers.length}`
                    : `${Math.round(upPct)}% / ${Math.round(downPct)}%`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {selectedDayDrops ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-background px-3 py-2 text-xs">
          <span>
            Quedas em{' '}
            <strong className="font-mono">
              {formatDateShort(selectedDayDrops.timestamp, preferences.timezone)}
            </strong>
            :{' '}
            <span className="font-mono text-negative">
              {selectedDayDrops.downTickers.join(', ') || 'nenhuma'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedDayDrops(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
        </div>
      ) : null}
    </div>
  );
}
