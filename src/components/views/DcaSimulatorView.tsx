import { useMemo, useState } from 'react';
import { CalendarClock, Coins, Sparkles, TrendingUp } from 'lucide-react';
import type { CoinMarket } from '../../types/crypto';
import { formatPrice } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { PageHeader, HeaderSegmented } from '../shell/PageHeader';
import { CustomSelect } from '../ui/CustomSelect';

interface DcaSimulatorViewProps {
  coins: CoinMarket[];
}

type FrequencyId = 'weekly' | 'biweekly' | 'monthly';
type HorizonMonths = 3 | 6 | 12 | 24;

const CONTRIBUTION_PRESETS = ['50', '100', '250', '500', '1000'];
const HORIZON_OPTIONS: { id: string; label: string; months: HorizonMonths }[] = [
  { id: '3', label: '3 meses', months: 3 },
  { id: '6', label: '6 meses', months: 6 },
  { id: '12', label: '1 ano', months: 12 },
  { id: '24', label: '2 anos', months: 24 },
];

export function DcaSimulatorView({ coins }: DcaSimulatorViewProps) {
  const { preferences } = usePreferences();
  const [coinId, setCoinId] = useState<string>(() => coins[0]?.id ?? 'bitcoin');
  const [amountStr, setAmountStr] = useState('250');
  const [frequency, setFrequency] = useState<FrequencyId>('monthly');
  const [horizonId, setHorizonId] = useState<string>('12');
  const [annualReturnStr, setAnnualReturnStr] = useState('25');

  const selectedCoin = useMemo(
    () => coins.find((c) => c.id === coinId) ?? coins[0] ?? null,
    [coins, coinId]
  );

  const contribution = Math.max(0, Number(amountStr.replace(',', '.')) || 0);
  const horizonMonths = HORIZON_OPTIONS.find((h) => h.id === horizonId)?.months ?? 12;
  const annualRatePct = Number(annualReturnStr.replace(',', '.')) || 0;

  const periodsPerYear = frequency === 'weekly' ? 52 : frequency === 'biweekly' ? 26 : 12;
  const totalPeriods = Math.max(1, Math.round((horizonMonths / 12) * periodsPerYear));
  const stepRate = annualRatePct / 100 / periodsPerYear;

  const simulation = useMemo(() => {
    const basePrice = selectedCoin?.currentPrice ?? 1;
    let totalInvested = 0;
    let accumulatedCoins = 0;
    const milestones: {
      step: number;
      price: number;
      invested: number;
      coins: number;
      portfolioValue: number;
    }[] = [];

    for (let i = 1; i <= totalPeriods; i++) {
      const simulatedPrice = Math.max(0.000001, basePrice * Math.pow(1 + stepRate, i - 1));
      totalInvested += contribution;
      accumulatedCoins += contribution / simulatedPrice;
      const portfolioValue = accumulatedCoins * simulatedPrice;

      if (
        i === 1 ||
        i === totalPeriods ||
        i % Math.max(1, Math.floor(totalPeriods / 6)) === 0
      ) {
        milestones.push({
          step: i,
          price: simulatedPrice,
          invested: totalInvested,
          coins: accumulatedCoins,
          portfolioValue,
        });
      }
    }

    const finalPrice = Math.max(
      0.000001,
      basePrice * Math.pow(1 + stepRate, Math.max(0, totalPeriods - 1))
    );
    const finalValue = accumulatedCoins * finalPrice;
    const profitUsd = finalValue - totalInvested;
    const profitPct = totalInvested > 0 ? (profitUsd / totalInvested) * 100 : 0;
    const avgCostPerCoin = accumulatedCoins > 0 ? totalInvested / accumulatedCoins : basePrice;

    return {
      totalInvested,
      accumulatedCoins,
      finalValue,
      profitUsd,
      profitPct,
      avgCostPerCoin,
      milestones: milestones.slice(0, 8),
    };
  }, [selectedCoin?.currentPrice, totalPeriods, stepRate, contribution]);

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const scenarioComparison = useMemo(() => {
    const rates = [-20, 0, 15, 30, 60];
    const basePrice = selectedCoin?.currentPrice ?? 1;
    return rates.map((rate) => {
      const rStep = rate / 100 / periodsPerYear;
      let coinsAcc = 0;
      let invested = 0;
      let lastP = basePrice;
      for (let i = 1; i <= totalPeriods; i++) {
        lastP = Math.max(0.000001, basePrice * Math.pow(1 + rStep, i - 1));
        invested += contribution;
        coinsAcc += contribution / lastP;
      }
      const value = coinsAcc * lastP;
      const roi = invested > 0 ? ((value - invested) / invested) * 100 : 0;
      return { rate, invested, value, roi };
    });
  }, [selectedCoin?.currentPrice, periodsPerYear, totalPeriods, contribution]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Simulador DCA"
        subtitle="Planejamento de aportes recorrentes (Dollar-Cost Averaging) e preço médio."
        actions={
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="mr-1 inline-flex items-center gap-1 text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" aria-hidden="true" />
              Cenário:
            </span>
            {[
              { label: 'Conservador (0%)', val: '0' },
              { label: 'Moderado (+25%)', val: '25' },
              { label: 'Otimista (+50%)', val: '50' },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setAnnualReturnStr(preset.val)}
                className={`rounded-md border px-2.5 py-1 text-foreground transition-colors ${
                  annualReturnStr === preset.val
                    ? 'border-accent/60 bg-accent/15 text-accent'
                    : 'border-border/80 bg-card/75 hover:border-accent/50 hover:text-accent'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
        <div className="mx-auto w-full max-w-page space-y-5">
          {/* Top Grid: Config + Summary */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Configuration Card */}
            <div className="space-y-5 rounded-xl border border-border/80 bg-card/95 p-6 text-sm shadow-card">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="mb-2 block text-xs font-medium text-muted-foreground">
                    Ativo selecionado
                  </span>
                  <CustomSelect
                    ariaLabel="Ativo para DCA"
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
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label htmlFor="dca-amount" className="text-xs font-medium text-muted-foreground">
                      Aporte por período (USD)
                    </label>
                    <div className="flex items-center gap-1">
                      {CONTRIBUTION_PRESETS.slice(0, 4).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setAmountStr(p)}
                          className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                            amountStr === p
                              ? 'border-accent/60 bg-accent/15 text-accent'
                              : 'border-border/70 bg-background/60 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          ${p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    id="dca-amount"
                    type="text"
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="h-control-lg w-full rounded-lg border border-border bg-background/90 px-3.5 text-base font-medium tabular-nums text-foreground outline-none transition-colors focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="mb-2 block text-xs font-medium text-muted-foreground">
                    Frequência dos aportes
                  </span>
                  <HeaderSegmented
                    value={frequency}
                    onChange={(v) => setFrequency(v as FrequencyId)}
                    tone="surface"
                    className="h-control-md w-full justify-between"
                    options={[
                      { id: 'weekly', label: 'Semanal' },
                      { id: 'biweekly', label: 'Quinzenal' },
                      { id: 'monthly', label: 'Mensal' },
                    ]}
                  />
                </div>

                <div>
                  <span className="mb-2 block text-xs font-medium text-muted-foreground">
                    Horizonte de acumulação
                  </span>
                  <HeaderSegmented
                    value={horizonId}
                    onChange={setHorizonId}
                    tone="surface"
                    className="h-control-md w-full justify-between"
                    options={HORIZON_OPTIONS.map((h) => ({ id: h.id, label: h.label }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-accent" aria-hidden="true" />
                  <span>Crescimento anualizado estimado (%):</span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Crescimento anualizado estimado"
                  value={annualReturnStr}
                  onChange={(e) => setAnnualReturnStr(e.target.value)}
                  className="h-8 w-24 rounded-md border border-border bg-card px-2.5 text-right text-xs font-semibold tabular-nums text-foreground focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Right Summary Card */}
            <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/95 p-6 text-xs shadow-card">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Projeção acumulada
                  </h2>
                  <CalendarClock className="h-4 w-4 text-accent" aria-hidden="true" />
                </div>

                <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  US$ {formatPrice(simulation.finalValue, fmtOpts)}
                </p>
                <p
                  className={`mt-1 text-xs font-semibold tabular-nums ${
                    simulation.profitUsd >= 0 ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {simulation.profitUsd >= 0 ? '+' : ''}
                  US$ {formatPrice(simulation.profitUsd, fmtOpts)} ({simulation.profitPct >= 0 ? '+' : ''}
                  {simulation.profitPct.toFixed(1)}%)
                </p>

                <dl className="mt-4 divide-y divide-border/70 text-[13px] tabular-nums">
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-muted-foreground">Total aportado ({totalPeriods}x)</dt>
                    <dd className="font-semibold text-foreground">
                      US$ {formatPrice(simulation.totalInvested, fmtOpts)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-muted-foreground">Saldo acumulado</dt>
                    <dd className="font-semibold text-foreground">
                      {simulation.accumulatedCoins.toFixed(6)}{' '}
                      {selectedCoin?.symbol.toUpperCase() ?? ''}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-muted-foreground">Preço médio estimado</dt>
                    <dd className="font-semibold text-foreground">
                      US$ {formatPrice(simulation.avgCostPerCoin, fmtOpts)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Bottom Grid: Scenarios + Milestones */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-card">
              <div className="flex items-center justify-between border-b border-border/70 bg-nav/60 px-5 py-3 text-sm font-semibold text-foreground">
                <span>Sensibilidade por cenário anual</span>
                <Coins className="h-4 w-4 text-accent" aria-hidden="true" />
              </div>
              <table className="w-full border-collapse text-[13px] tabular-nums">
                <thead>
                  <tr className="border-b border-border/70 text-[11px] uppercase text-muted-foreground">
                    <th className="px-5 py-2.5 text-left">Variação anual</th>
                    <th className="px-5 py-2.5 text-right">Total aportado</th>
                    <th className="px-5 py-2.5 text-right">Valor final</th>
                    <th className="px-5 py-2.5 text-right">Retorno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {scenarioComparison.map((row) => (
                    <tr
                      key={row.rate}
                      onClick={() => setAnnualReturnStr(String(row.rate))}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <td className="px-5 py-2.5 font-medium text-foreground">
                        {row.rate >= 0 ? `+${row.rate}%` : `${row.rate}%`} / ano
                      </td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground">
                        US$ {formatPrice(row.invested, fmtOpts)}
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold text-foreground">
                        US$ {formatPrice(row.value, fmtOpts)}
                      </td>
                      <td
                        className={`px-5 py-2.5 text-right font-semibold ${
                          row.roi >= 0 ? 'text-positive' : 'text-negative'
                        }`}
                      >
                        {row.roi >= 0 ? '+' : ''}
                        {row.roi.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-card">
              <div className="border-b border-border/70 bg-nav/60 px-5 py-3 text-sm font-semibold text-foreground">
                Marcos de acumulação ({selectedCoin?.symbol.toUpperCase() ?? 'Ativo'})
              </div>
              <table className="w-full border-collapse text-[13px] tabular-nums">
                <thead>
                  <tr className="border-b border-border/70 text-[11px] uppercase text-muted-foreground">
                    <th className="px-5 py-2.5 text-left">Aporte #</th>
                    <th className="px-5 py-2.5 text-right">Aportado</th>
                    <th className="px-5 py-2.5 text-right">Qtd. Moedas</th>
                    <th className="px-5 py-2.5 text-right">Patrimônio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {simulation.milestones.map((m) => (
                    <tr key={m.step} className="hover:bg-muted/30">
                      <td className="px-5 py-2 font-medium text-foreground">#{m.step}</td>
                      <td className="px-5 py-2 text-right text-muted-foreground">
                        US$ {formatPrice(m.invested, fmtOpts)}
                      </td>
                      <td className="px-5 py-2 text-right text-foreground">
                        {m.coins.toFixed(5)}
                      </td>
                      <td className="px-5 py-2 text-right font-semibold text-foreground">
                        US$ {formatPrice(m.portfolioValue, fmtOpts)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
