import { useMemo, useRef, useState } from 'react';
import type { CoinMarket } from '../../types/crypto';
import { formatPercent } from '../../lib/formatters';
import { downloadChartPng, downloadChartSvg, downloadCsvRows } from '../../lib/analytics';
import { usePreferences } from '../../hooks/usePreferences';
import { ChartToolbar } from './ChartToolbar';
import { ChartCardHeader } from './ChartCard';
import type { DataInspectorPayload } from './DataInspectorModal';

export interface WaterfallItem {
  coin: CoinMarket;
  initialCap: number;
  periodReturn: number;
}

interface WaterfallContributionCardProps {
  items: WaterfallItem[];
  periodLabel: string;
  coveredLabel: string;
  onInspectData: (payload: DataInspectorPayload) => void;
}

export function WaterfallContributionCard({
  items,
  periodLabel,
  coveredLabel,
  onInspectData,
}: WaterfallContributionCardProps) {
  const { preferences } = usePreferences();
  const [weightMode, setWeightMode] = useState<'cap' | 'equal'>('cap');
  const [showData, setShowData] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const { steps, totalReturn, minY, maxY } = useMemo(() => {
    const count = items.length;
    if (count === 0) return { steps: [], totalReturn: 0, minY: -2, maxY: 2 };

    const totalCap = items.reduce((s, i) => s + Math.max(i.initialCap, 0), 0);
    const useEqual = weightMode === 'equal' || totalCap <= 0;

    let running = 0;
    let minVal = 0;
    let maxVal = 0;

    const sorted = [...items].sort((a, b) => b.initialCap - a.initialCap);

    const list = sorted.map((item) => {
      const weight = useEqual ? 1 / count : item.initialCap / totalCap;
      const contrib = weight * item.periodReturn;
      const start = running;
      const end = running + contrib;
      running = end;
      if (start < minVal) minVal = start;
      if (end < minVal) minVal = end;
      if (start > maxVal) maxVal = start;
      if (end > maxVal) maxVal = end;
      return {
        ticker: item.coin.symbol.toUpperCase(),
        weightPct: weight * 100,
        periodReturn: item.periodReturn,
        contrib,
        start,
        end,
      };
    });

    const pad = Math.max((maxVal - minVal) * 0.18, 0.5);
    return {
      steps: list,
      totalReturn: running,
      minY: minVal - pad,
      maxY: maxVal + pad,
    };
  }, [items, weightMode]);

  const selectedStep =
    steps.find((s) => s.ticker === selectedTicker) ?? steps[0] ?? null;

  const span = maxY - minY || 1;
  const toTopPct = (val: number) => ((maxY - val) / span) * 100;
  const zeroTopPct = toTopPct(0);

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <ChartCardHeader
        title="Cascata de contribuição para o retorno"
        subtitle="Carteira de referência / pontos percentuais (p.p.)"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Ponderação da cascata"
              value={weightMode}
              onChange={(e) => setWeightMode(e.target.value as 'cap' | 'equal')}
              className="h-7 rounded-lg border border-border/80 bg-card/85 pl-2.5 pr-7 text-[11px] font-medium text-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card"
            >
              <option value="cap">Peso inicial</option>
              <option value="equal">Pesos iguais</option>
            </select>

            <ChartToolbar
              showData={showData}
              onToggleData={() => setShowData((p) => !p)}
              onInspectData={() =>
                onInspectData({
                  title: 'Cascata de contribuição para o retorno',
                  source: 'CoinGecko API v3 (/coins/{id}/market_chart)',
                  unit: 'Pontos percentuais (p.p.)',
                  timezone: preferences.timezone,
                  requestedPeriod: periodLabel,
                coveredPeriod: coveredLabel,
                observationCount: steps.length,
                excludedCount: 0,
                formula:
                  weightMode === 'cap'
                    ? 'Contribuição = Peso_cap_inicial × Retorno_ativo. Soma das contribuições = Retorno total da carteira.'
                    : 'Contribuição = (1/N) × Retorno_ativo.',
              })
            }
            onExportPng={() =>
              downloadChartPng(
                cardRef.current,
                'Cascata de contribuição',
                periodLabel,
                'cascata-contribuicao.png'
              )
            }
            onExportSvg={() =>
              downloadChartSvg(
                cardRef.current,
                'Cascata de contribuição',
                periodLabel,
                'cascata-contribuicao.svg'
              )
            }
            onExportCsv={() =>
              downloadCsvRows(
                'cascata-contribuicao.csv',
                ['ticker', 'peso_pct', 'retorno_pct', 'contribuicao_pp'],
                steps.map((s) => [
                  s.ticker,
                  s.weightPct.toFixed(2),
                  s.periodReturn.toFixed(2),
                  s.contrib.toFixed(2),
                ])
              )
            }
          />
          </div>
        }
      />

      {showData ? (
        <div className="mt-3 overflow-x-auto rounded border border-border bg-background">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-border bg-nav text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5">Ativo</th>
                <th className="px-3 py-1.5 text-right">Peso</th>
                <th className="px-3 py-1.5 text-right">Retorno</th>
                <th className="px-3 py-1.5 text-right">Contribuição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {steps.map((s) => (
                <tr key={s.ticker}>
                  <td className="px-3 py-1.5 font-mono font-semibold text-accent">{s.ticker}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {s.weightPct.toFixed(1).replace('.', ',')}%
                  </td>
                  <td className="px-3 py-1.5 text-right text-foreground">
                    {formatPercent(s.periodReturn, preferences.numberLocale)}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right font-medium ${
                      s.contrib >= 0 ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {s.contrib >= 0 ? '+' : '−'}
                    {Math.abs(s.contrib).toFixed(2).replace('.', ',')} p.p.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={cardRef} className="mt-4">
          <div className="relative h-44 w-full border-b border-border">
            {/* Zero reference line */}
            <div
              className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/40 transition-[top] duration-300 ease-out"
              style={{ top: `${zeroTopPct}%` }}
            />

            <div className="grid h-full gap-2 px-2" style={{ gridTemplateColumns: `repeat(${steps.length + 1}, minmax(0, 1fr))` }}>
              {steps.map((s) => {
                const topVal = Math.max(s.start, s.end);
                const botVal = Math.min(s.start, s.end);
                const topPct = toTopPct(topVal);
                const heightPct = Math.max(toTopPct(botVal) - topPct, 2);
                const isPos = s.contrib >= 0;
                const isSelected = selectedStep?.ticker === s.ticker;

                return (
                  <button
                    key={s.ticker}
                    type="button"
                    onClick={() => setSelectedTicker(s.ticker)}
                    className="relative h-full w-full focus-visible:outline-none"
                    title={`${s.ticker}: ${s.contrib >= 0 ? '+' : '−'}${Math.abs(s.contrib).toFixed(2)} p.p.`}
                  >
                    <div
                      style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                      className={`absolute left-1.5 right-1.5 rounded-sm transition-all duration-300 ease-out ${
                        isPos ? 'bg-positive/80' : 'bg-negative/80'
                      } ${isSelected ? 'ring-1 ring-accent' : 'opacity-85 hover:opacity-100'}`}
                    />
                  </button>
                );
              })}

              {/* Total Portfolio Bar */}
              <div className="relative h-full w-full">
                <div
                  style={{
                    top: `${toTopPct(Math.max(0, totalReturn))}%`,
                    height: `${Math.max(
                      toTopPct(Math.min(0, totalReturn)) - toTopPct(Math.max(0, totalReturn)),
                      2
                    )}%`,
                  }}
                  className="absolute left-1.5 right-1.5 rounded-sm bg-accent transition-all duration-300 ease-out"
                />
              </div>
            </div>
          </div>

          <div
            className="mt-1.5 grid gap-2 px-2 text-center font-mono text-[10px] text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${steps.length + 1}, minmax(0, 1fr))` }}
          >
            {steps.map((s) => (
              <span key={s.ticker} className="truncate font-semibold text-foreground">
                {s.ticker}
              </span>
            ))}
            <span className="truncate font-semibold text-accent">CARTEIRA</span>
          </div>
        </div>
      )}

      {selectedStep ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-xs tabular-nums">
          <span className="text-muted-foreground">
            Selecionado: <strong className="font-mono text-foreground">{selectedStep.ticker}</strong>{' '}
            · Peso {selectedStep.weightPct.toFixed(1).replace('.', ',')}% × Retorno{' '}
            {formatPercent(selectedStep.periodReturn, preferences.numberLocale)} ={' '}
            <strong
              className={selectedStep.contrib >= 0 ? 'text-positive' : 'text-negative'}
            >
              {selectedStep.contrib >= 0 ? '+' : '−'}
              {Math.abs(selectedStep.contrib).toFixed(2).replace('.', ',')} p.p.
            </strong>
          </span>
          <span className="font-mono font-semibold text-accent">
            Carteira: {formatPercent(totalReturn, preferences.numberLocale)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
