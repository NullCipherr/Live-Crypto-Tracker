import { useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { CoinMarket } from '../../types/crypto';
import { formatCompactNumber } from '../../lib/formatters';
import { downloadChartPng, downloadChartSvg, downloadCsvRows } from '../../lib/analytics';
import { usePreferences } from '../../hooks/usePreferences';
import { ChartToolbar } from './ChartToolbar';
import { ChartCardHeader } from './ChartCard';

interface MarketCompositionCardProps {
  coins: CoinMarket[];
  onInspectCoin: (coinId: string) => void;
}

const ACCENT_HEX = ['#82B4FF', '#34D399', '#FBBF24', '#38BDF8', '#A78BFA', '#F472B6'];

export function MarketCompositionCard({ coins, onInspectCoin }: MarketCompositionCardProps) {
  const { preferences } = usePreferences();
  const [showData, setShowData] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => coins[0]?.id ?? null);
  const cardRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () => [...coins].sort((a, b) => b.marketCap - a.marketCap),
    [coins]
  );

  const totalCap = useMemo(
    () => sorted.reduce((sum, c) => sum + c.marketCap, 0) || 1,
    [sorted]
  );

  const displayed = showAll ? sorted : sorted.slice(0, 6);
  const selectedCoin = sorted.find((c) => c.id === selectedId) ?? sorted[0] ?? null;
  const btcEthShare = useMemo(() => {
    const btc = sorted.find((c) => c.symbol.toLowerCase() === 'btc')?.marketCap ?? 0;
    const eth = sorted.find((c) => c.symbol.toLowerCase() === 'eth')?.marketCap ?? 0;
    return (((btc + eth) / totalCap) * 100).toFixed(1);
  }, [sorted, totalCap]);

  const handleExportCsv = () => {
    downloadCsvRows(
      'composicao-mercado.csv',
      ['ticker', 'nome', 'cap_usd', 'participacao_pct'],
      sorted.map((c) => [
        c.symbol.toUpperCase(),
        c.name,
        c.marketCap,
        ((c.marketCap / totalCap) * 100).toFixed(2),
      ])
    );
  };

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-card">
      <ChartCardHeader
        title="Composição do mercado"
        subtitle="Participação proporcional na capitalização"
        right={
          <ChartToolbar
            showData={showData}
            onToggleData={() => setShowData((prev) => !prev)}
            onExportPng={() =>
              downloadChartPng(
                cardRef.current,
                'Composição do mercado',
                'Capitalização USD',
                'composicao-mercado.png'
              )
            }
            onExportSvg={() =>
              downloadChartSvg(
                cardRef.current,
                'Composição do mercado',
                'Capitalização USD',
                'composicao-mercado.svg'
              )
            }
            onExportCsv={handleExportCsv}
          />
        }
      />

      {showData ? (
        <div className="my-2 max-h-72 flex-1 overflow-y-auto rounded border border-border bg-background">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 border-b border-border bg-nav text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-2.5 py-1.5">Ativo</th>
                <th className="px-2.5 py-1.5 text-right">Cap. USD</th>
                <th className="px-2.5 py-1.5 text-right">Part.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {sorted.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-2.5 py-1.5 font-mono text-[11px] font-semibold text-accent">
                    {c.symbol.toUpperCase()}
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-foreground">
                    US$ {formatCompactNumber(c.marketCap, preferences.numberLocale)}
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-muted-foreground">
                    {((c.marketCap / totalCap) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={cardRef} className="flex flex-1 flex-col justify-between gap-4 py-1">
          {/* Proportional Stacked Distribution Bar */}
          <div className="space-y-2">
            <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-muted/70 p-0.5">
              {sorted.map((coin, idx) => {
                const pct = (coin.marketCap / totalCap) * 100;
                if (pct < 0.4) return null;
                return (
                  <button
                    key={coin.id}
                    type="button"
                    onClick={() => setSelectedId(coin.id)}
                    title={`${coin.symbol.toUpperCase()}: ${pct.toFixed(1)}%`}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: ACCENT_HEX[idx % ACCENT_HEX.length],
                    }}
                    className={`h-full transition-opacity first:rounded-l-full last:rounded-r-full hover:opacity-90 ${selectedCoin?.id === coin.id ? 'opacity-100' : 'opacity-80'
                      }`}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Total do recorte</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                US$ {formatCompactNumber(totalCap, preferences.numberLocale)}
              </span>
            </div>
          </div>

          {/* Ranked Breakdown Rows */}
          <div className="max-h-[260px] flex-1 space-y-1.5 overflow-y-auto pr-0.5">
            {displayed.map((coin, idx) => {
              const pct = (coin.marketCap / totalCap) * 100;
              const isSelected = selectedCoin?.id === coin.id;
              const barColor = ACCENT_HEX[idx % ACCENT_HEX.length];
              return (
                <button
                  key={coin.id}
                  type="button"
                  onClick={() => setSelectedId(coin.id)}
                  className={`flex w-full flex-col gap-1.5 rounded-md border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isSelected
                    ? 'border-accent/60 bg-accent/10'
                    : 'border-border/70 bg-background/50 hover:bg-muted/50'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: barColor }}
                      />
                      <span className="font-mono font-semibold text-foreground">
                        {coin.symbol.toUpperCase()}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">{coin.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2.5 font-mono text-[11px] tabular-nums">
                      <span className="text-muted-foreground">
                        US$ {formatCompactNumber(coin.marketCap, preferences.numberLocale)}
                      </span>
                      <span className="w-11 text-right font-semibold text-foreground">
                        {pct.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(pct, 1.5)}%`, backgroundColor: barColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3 text-xs">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Concentração BTC + ETH</span>
          <span className="rounded-md border border-border/70 bg-background/60 px-2 py-0.5 font-mono font-semibold tabular-nums text-foreground">
            {btcEthShare.replace('.', ',')}%
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {selectedCoin ? (
            <button
              type="button"
              onClick={() => onInspectCoin(selectedCoin.id)}
              className="group inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/80 bg-card/85 px-2.5 text-[11px] font-medium text-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span>Inspecionar {selectedCoin.symbol.toUpperCase()}</span>
              <ArrowUpRight
                className="h-3.5 w-3.5 text-accent transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </button>
          ) : (
            <span />
          )}
          {sorted.length > 6 ? (
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="group inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/80 bg-card/85 px-2.5 text-[11px] font-medium text-muted-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span>{showAll ? 'Mostrar principais' : `Ver os ${sorted.length} ativos`}</span>
              {showAll ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent" aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
