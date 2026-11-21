import { useMemo, useState } from 'react';
import { ShieldCheck, Sparkles, Target, TrendingDown, TrendingUp } from 'lucide-react';
import type { CoinMarket } from '../../types/crypto';
import { formatPrice } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { PageHeader, HeaderSegmented } from '../shell/PageHeader';
import { CustomSelect } from '../ui/CustomSelect';

interface PositionCalculatorViewProps {
  coins: CoinMarket[];
}

const RISK_PRESETS = ['0.5', '1', '2', '3', '5'];

export function PositionCalculatorView({ coins }: PositionCalculatorViewProps) {
  const { preferences } = usePreferences();
  const [coinId, setCoinId] = useState<string>(() => coins[0]?.id ?? 'bitcoin');
  const [capitalStr, setCapitalStr] = useState('10000');
  const [riskPctStr, setRiskPctStr] = useState('1');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [stopPctStr, setStopPctStr] = useState('5');
  const [targetPctStr, setTargetPctStr] = useState('15');

  const selectedCoin = useMemo(
    () => coins.find((c) => c.id === coinId) ?? coins[0] ?? null,
    [coins, coinId]
  );

  const entryPrice = selectedCoin?.currentPrice ?? 1;
  const capital = Math.max(0, Number(capitalStr.replace(',', '.')) || 0);
  const riskPct = Math.max(0.05, Math.min(50, Number(riskPctStr.replace(',', '.')) || 1));
  const stopPct = Math.max(0.1, Math.min(95, Number(stopPctStr.replace(',', '.')) || 5));
  const targetPct = Math.max(0.1, Number(targetPctStr.replace(',', '.')) || 15);

  const metrics = useMemo(() => {
    const maxLossUsd = capital * (riskPct / 100);
    const positionSizeUsd = stopPct > 0 ? maxLossUsd / (stopPct / 100) : 0;
    const positionUnits = entryPrice > 0 ? positionSizeUsd / entryPrice : 0;
    const stopPrice =
      direction === 'long'
        ? entryPrice * (1 - stopPct / 100)
        : entryPrice * (1 + stopPct / 100);
    const targetPrice =
      direction === 'long'
        ? entryPrice * (1 + targetPct / 100)
        : entryPrice * (1 - targetPct / 100);
    const potentialProfitUsd = positionSizeUsd * (targetPct / 100);
    const riskReward = stopPct > 0 ? targetPct / stopPct : 0;
    const leverageRequired = capital > 0 ? positionSizeUsd / capital : 0;

    return {
      maxLossUsd,
      positionSizeUsd,
      positionUnits,
      stopPrice,
      targetPrice,
      potentialProfitUsd,
      riskReward,
      leverageRequired,
    };
  }, [capital, riskPct, stopPct, targetPct, entryPrice, direction]);

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const rrBadge =
    metrics.riskReward >= 2
      ? { label: 'Risco/Retorno Favorável', cls: 'bg-positive/15 text-positive' }
      : metrics.riskReward >= 1.2
        ? { label: 'Equilibrado', cls: 'bg-accent/15 text-accent' }
        : { label: 'Desfavorável', cls: 'bg-negative/15 text-negative' };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Risco & Posição"
        subtitle="Dimensionamento de posição por risco máximo, Stop Loss e relação Risco/Retorno."
        actions={
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" aria-hidden="true" />
              Direção:
            </span>
            <HeaderSegmented
              value={direction}
              onChange={(v) => setDirection(v as 'long' | 'short')}
              tone="surface"
              options={[
                { id: 'long', label: 'Compra (Long)' },
                { id: 'short', label: 'Venda (Short)' },
              ]}
            />
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
        <div className="mx-auto w-full max-w-page space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Parameters Card */}
            <div className="space-y-5 rounded-xl border border-border/80 bg-card/95 p-6 text-sm shadow-card">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="mb-2 block text-xs font-medium text-muted-foreground">
                    Ativo da operação
                  </span>
                  <CustomSelect
                    ariaLabel="Ativo da operação"
                    value={selectedCoin?.id ?? ''}
                    onChange={setCoinId}
                    menuWidth={280}
                    className="h-control-lg w-full bg-background/90 px-3 text-xs font-medium"
                    options={coins.map((c) => ({
                      value: c.id,
                      label: `${c.symbol.toUpperCase()} — ${c.name}`,
                      iconUrl: c.image,
                    }))}
                  />
                </div>

                <div>
                  <label htmlFor="pos-capital" className="mb-2 block text-xs font-medium text-muted-foreground">
                    Capital total da carteira (USD)
                  </label>
                  <input
                    id="pos-capital"
                    type="text"
                    inputMode="decimal"
                    value={capitalStr}
                    onChange={(e) => setCapitalStr(e.target.value)}
                    className="h-control-lg w-full rounded-lg border border-border bg-background/90 px-3.5 text-base font-medium tabular-nums text-foreground outline-none transition-colors focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="pos-risk" className="text-xs font-medium text-muted-foreground">
                    Risco máximo aceito (% do capital)
                  </label>
                  <div className="flex items-center gap-1">
                    {RISK_PRESETS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRiskPctStr(r)}
                        className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                          riskPctStr === r
                            ? 'border-accent/60 bg-accent/15 text-accent'
                            : 'border-border/70 bg-background/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  id="pos-risk"
                  type="text"
                  inputMode="decimal"
                  value={riskPctStr}
                  onChange={(e) => setRiskPctStr(e.target.value)}
                  className="h-control-lg w-full rounded-lg border border-border bg-background/90 px-3.5 text-base font-medium tabular-nums text-foreground outline-none transition-colors focus:border-accent"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="pos-stop" className="mb-2 flex items-center gap-1.5 text-xs font-medium text-negative">
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                    Distância do Stop Loss (%)
                  </label>
                  <input
                    id="pos-stop"
                    type="text"
                    inputMode="decimal"
                    value={stopPctStr}
                    onChange={(e) => setStopPctStr(e.target.value)}
                    className="h-control-lg w-full rounded-lg border border-border bg-background/90 px-3.5 text-base font-medium tabular-nums text-foreground outline-none transition-colors focus:border-accent"
                  />
                </div>
                <div>
                  <label htmlFor="pos-target" className="mb-2 flex items-center gap-1.5 text-xs font-medium text-positive">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                    Distância do Alvo / Take Profit (%)
                  </label>
                  <input
                    id="pos-target"
                    type="text"
                    inputMode="decimal"
                    value={targetPctStr}
                    onChange={(e) => setTargetPctStr(e.target.value)}
                    className="h-control-lg w-full rounded-lg border border-border bg-background/90 px-3.5 text-base font-medium tabular-nums text-foreground outline-none transition-colors focus:border-accent"
                  />
                </div>
              </div>
            </div>

            {/* Output Card */}
            <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/95 p-6 text-xs shadow-card">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tamanho ideal da posição
                  </h2>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${rrBadge.cls}`}>
                    {rrBadge.label}
                  </span>
                </div>

                <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  US$ {formatPrice(metrics.positionSizeUsd, fmtOpts)}
                </p>
                <p className="mt-1 text-xs font-medium tabular-nums text-accent">
                  {metrics.positionUnits.toFixed(6)} {selectedCoin?.symbol.toUpperCase() ?? ''} ·{' '}
                  {metrics.leverageRequired > 1
                    ? `${metrics.leverageRequired.toFixed(2)}x alavancagem`
                    : `${Math.round(metrics.leverageRequired * 100)}% do capital`}
                </p>

                <dl className="mt-4 divide-y divide-border/70 text-[13px] tabular-nums">
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-muted-foreground">Relação Risco / Retorno</dt>
                    <dd className="font-semibold text-foreground">
                      1 : {metrics.riskReward.toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-muted-foreground">Perda máxima no Stop</dt>
                    <dd className="font-semibold text-negative">
                      -US$ {formatPrice(metrics.maxLossUsd, fmtOpts)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-muted-foreground">Lucro estimado no Alvo</dt>
                    <dd className="font-semibold text-positive">
                      +US$ {formatPrice(metrics.potentialProfitUsd, fmtOpts)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-border/70 pt-3 text-xs tabular-nums">
                <div className="rounded-lg border border-negative/30 bg-negative/10 p-2.5">
                  <p className="text-[10px] text-muted-foreground">Preço Stop</p>
                  <p className="mt-0.5 font-semibold text-negative">
                    US$ {formatPrice(metrics.stopPrice, fmtOpts)}
                  </p>
                </div>
                <div className="rounded-lg border border-positive/30 bg-positive/10 p-2.5">
                  <p className="text-[10px] text-muted-foreground">Preço Alvo</p>
                  <p className="mt-0.5 font-semibold text-positive">
                    US$ {formatPrice(metrics.targetPrice, fmtOpts)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Matrix Table */}
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-card">
            <div className="flex items-center justify-between border-b border-border/70 bg-nav/60 px-5 py-3 text-sm font-semibold text-foreground">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
                Tabela de dimensionamento por nível de risco (Stop {stopPct}%)
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Clique em uma linha para aplicar
              </span>
            </div>
            <table className="w-full border-collapse text-[13px] tabular-nums">
              <thead>
                <tr className="border-b border-border/70 text-[11px] uppercase text-muted-foreground">
                  <th className="px-5 py-2.5 text-left">Risco (%)</th>
                  <th className="px-5 py-2.5 text-right">Perda Máxima</th>
                  <th className="px-5 py-2.5 text-right">Tamanho Posição</th>
                  <th className="px-5 py-2.5 text-right">Qtd. {selectedCoin?.symbol.toUpperCase()}</th>
                  <th className="px-5 py-2.5 text-right">Lucro no Alvo ({targetPct}%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {RISK_PRESETS.map((rStr) => {
                  const rVal = Number(rStr);
                  const loss = capital * (rVal / 100);
                  const posUsd = stopPct > 0 ? loss / (stopPct / 100) : 0;
                  const units = entryPrice > 0 ? posUsd / entryPrice : 0;
                  const profit = posUsd * (targetPct / 100);
                  return (
                    <tr
                      key={rStr}
                      onClick={() => setRiskPctStr(rStr)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <td className="px-5 py-2.5 font-semibold text-foreground">{rStr}%</td>
                      <td className="px-5 py-2.5 text-right text-negative">
                        -US$ {formatPrice(loss, fmtOpts)}
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold text-foreground">
                        US$ {formatPrice(posUsd, fmtOpts)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground">
                        {units.toFixed(5)}
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold text-positive">
                        +US$ {formatPrice(profit, fmtOpts)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
