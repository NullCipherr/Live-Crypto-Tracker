import { useMemo, useRef, useState } from 'react';
import type { CoinMarket } from '../../types/crypto';
import { formatPercent } from '../../lib/formatters';
import { downloadChartPng, downloadChartSvg, downloadCsvRows } from '../../lib/analytics';
import { usePreferences } from '../../hooks/usePreferences';
import { ChartToolbar } from './ChartToolbar';
import type { DataInspectorPayload } from './DataInspectorModal';

export interface ContributionItem {
  coin: CoinMarket;
  initialCap: number;
  periodReturn: number;
}

interface ContributionCardProps {
  items: ContributionItem[];
  periodLabel: string;
  coveredLabel: string;
  onInspectData: (payload: DataInspectorPayload) => void;
}

export function ContributionCard({
  items,
  periodLabel,
  coveredLabel,
  onInspectData,
}: ContributionCardProps) {
  const { preferences } = usePreferences();
  const [weightMode, setWeightMode] = useState<'cap' | 'equal'>('cap');
  const [showData, setShowData] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const { rows, portfolioReturn, upCount, maxAbsContribution } = useMemo(() => {
    const count = items.length;
    if (count === 0) {
      return { rows: [], portfolioReturn: 0, upCount: 0, maxAbsContribution: 1 };
    }

    const totalInitialCap = items.reduce((s, item) => s + Math.max(item.initialCap, 0), 0);
    const useEqual = weightMode === 'equal' || totalInitialCap <= 0;

    const computed = items
      .map((item) => {
        const weight = useEqual ? 1 / count : item.initialCap / totalInitialCap;
        const contributionPp = weight * item.periodReturn;
        return {
          coin: item.coin,
          weightPct: weight * 100,
          periodReturn: item.periodReturn,
          contributionPp,
        };
      })
      .sort((a, b) => b.contributionPp - a.contributionPp);

    const totalRet = computed.reduce((s, r) => s + r.contributionPp, 0);
    const ups = computed.filter((r) => r.periodReturn > 0).length;
    const maxAbs = Math.max(...computed.map((r) => Math.abs(r.contributionPp)), 0.1);

    return {
      rows: computed,
      portfolioReturn: totalRet,
      upCount: ups,
      maxAbsContribution: maxAbs,
    };
  }, [items, weightMode]);

  const methodLabel =
    weightMode === 'cap'
      ? 'Carteira ponderada pela capitalização inicial'
      : 'Carteira com pesos iguais (1/N)';

  const openInspector = () => {
    onInspectData({
      title: 'Contribuição e amplitude de mercado',
      source: 'CoinGecko API v3 (/coins/{id}/market_chart)',
      unit: 'Pontos percentuais (p.p.) e %',
      timezone: preferences.timezone,
      requestedPeriod: periodLabel,
      coveredPeriod: coveredLabel,
      observationCount: rows.length,
      excludedCount: 0,
      formula:
        weightMode === 'cap'
          ? 'Contribuição (p.p.) = (Cap_inicial_ativo / Soma_Cap_inicial) × Retorno_ativo(%). Amplitude = ativos com retorno > 0.'
          : 'Contribuição (p.p.) = (1 / N) × Retorno_ativo(%). Amplitude = ativos com retorno > 0.',
    });
  };

  return (
    <div className="rounded-md border border-border bg-card p-3.5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-foreground">
            Contribuição para o retorno e amplitude
          </h2>
          <p className="text-[11px] text-muted-foreground">{methodLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Método de ponderação"
            value={weightMode}
            onChange={(e) => setWeightMode(e.target.value as 'cap' | 'equal')}
            className="h-6 rounded border border-border bg-background px-2 text-[11px] text-foreground"
          >
            <option value="cap">Cap. inicial</option>
            <option value="equal">Pesos iguais</option>
          </select>

          <ChartToolbar
            showData={showData}
            onToggleData={() => setShowData((p) => !p)}
            onInspectData={openInspector}
            onExportPng={() =>
              downloadChartPng(
                cardRef.current,
                'Contribuição para o retorno',
                methodLabel,
                'contribuicao-mercado.png'
              )
            }
            onExportSvg={() =>
              downloadChartSvg(
                cardRef.current,
                'Contribuição para o retorno',
                methodLabel,
                'contribuicao-mercado.svg'
              )
            }
            onExportCsv={() =>
              downloadCsvRows(
                'contribuicao-mercado.csv',
                ['ticker', 'peso_pct', 'retorno_pct', 'contribuicao_pp'],
                rows.map((r) => [
                  r.coin.symbol.toUpperCase(),
                  r.weightPct.toFixed(2),
                  r.periodReturn.toFixed(2),
                  r.contributionPp.toFixed(2),
                ])
              )
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
                <th className="px-3 py-1.5 text-right">Peso inicial</th>
                <th className="px-3 py-1.5 text-right">Retorno</th>
                <th className="px-3 py-1.5 text-right">Contribuição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {rows.map((r) => (
                <tr key={r.coin.id}>
                  <td className="px-3 py-1.5 font-mono font-semibold text-accent">
                    {r.coin.symbol.toUpperCase()}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {r.weightPct.toFixed(1).replace('.', ',')}%
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right ${
                      r.periodReturn >= 0 ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {formatPercent(r.periodReturn, preferences.numberLocale)}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right font-medium ${
                      r.contributionPp >= 0 ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {r.contributionPp > 0 ? '+' : r.contributionPp < 0 ? '−' : ''}
                    {Math.abs(r.contributionPp).toFixed(2).replace('.', ',')} p.p.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={cardRef} className="mt-3 space-y-2">
          {rows.map((r) => {
            const pctWidth = Math.max((Math.abs(r.contributionPp) / maxAbsContribution) * 100, 3);
            const isPos = r.contributionPp >= 0;
            return (
              <div key={r.coin.id} className="grid grid-cols-[52px_1fr_76px] items-center gap-3 text-xs">
                <span className="font-mono text-[11px] font-semibold text-foreground">
                  {r.coin.symbol.toUpperCase()}
                </span>

                <div className="grid grid-cols-2 items-center">
                  <div className="flex justify-end border-r border-border pr-0.5">
                    {!isPos ? (
                      <div
                        className="h-3 rounded-l-sm bg-negative/80"
                        style={{ width: `${pctWidth}%` }}
                      />
                    ) : null}
                  </div>
                  <div className="flex justify-start pl-0.5">
                    {isPos ? (
                      <div
                        className="h-3 rounded-r-sm bg-positive/80"
                        style={{ width: `${pctWidth}%` }}
                      />
                    ) : null}
                  </div>
                </div>

                <span
                  className={`text-right font-mono text-[11px] font-medium tabular-nums ${
                    isPos ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {r.contributionPp > 0 ? '+' : r.contributionPp < 0 ? '−' : ''}
                  {Math.abs(r.contributionPp).toFixed(2).replace('.', ',')} p.p.
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-2.5 text-xs tabular-nums">
        <div>
          <span className="text-muted-foreground">Retorno da carteira: </span>
          <span
            className={`font-semibold ${
              portfolioReturn >= 0 ? 'text-positive' : 'text-negative'
            }`}
          >
            {formatPercent(portfolioReturn, preferences.numberLocale)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Amplitude: </span>
          <span className="font-semibold text-foreground">
            {upCount} de {rows.length} em alta
          </span>
        </div>
      </div>
    </div>
  );
}
