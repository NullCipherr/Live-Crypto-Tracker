import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BookmarkPlus,
  Check,
  Copy,
  History,
  Percent,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { CoinMarket } from '../../types/crypto';
import { formatPrice, formatTime } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { PageHeader, HeaderSegmented } from '../shell/PageHeader';
import { CustomSelect } from '../ui/CustomSelect';

interface ConverterViewProps {
  coins: CoinMarket[];
  fetchedAt?: number;
}

interface ConverterOption {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number;
  image?: string;
  change24h?: number;
  isFiat?: boolean;
}

interface SavedConversion {
  id: string;
  amountStr: string;
  fromId: string;
  fromSymbol: string;
  toId: string;
  toSymbol: string;
  resultText: string;
  timestamp: number;
}

const AMOUNT_PRESETS = ['0.1', '0.5', '1', '10', '100', '1000'];
const FEE_OPTIONS = [
  { id: '0', label: '0% (Puro)', pct: 0 },
  { id: '0.1', label: '0,1% (Maker)', pct: 0.1 },
  { id: '0.5', label: '0,5% (Swap)', pct: 0.5 },
  { id: '1', label: '1,0% (Spread)', pct: 1.0 },
];
const SCALE_MULTIPLIERS = [0.01, 0.1, 0.5, 1, 5, 10, 50, 100];

function buildSavedConversion(params: {
  amountStr: string;
  fromId: string;
  fromSymbol: string;
  toId: string;
  toSymbol: string;
  resultText: string;
}): SavedConversion {
  const now = Date.now();
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 6)}`,
    ...params,
    timestamp: now,
  };
}

export function ConverterView({ coins, fetchedAt }: ConverterViewProps) {
  const { preferences } = usePreferences();
  const [amountStr, setAmountStr] = useState('0.25');
  const [fromId, setFromId] = useState<string>(() => coins[0]?.id ?? 'bitcoin');
  const [toId, setToId] = useState<string>('usd');
  const [brlPerUsd, setBrlPerUsd] = useState<string>('5.75');
  const [eurPerUsd, setEurPerUsd] = useState<string>('0.92');
  const [feeId, setFeeId] = useState<string>('0');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<SavedConversion[]>([]);

  const parsedBrl = Math.max(0.01, Number(brlPerUsd.replace(',', '.')) || 5.75);
  const parsedEur = Math.max(0.01, Number(eurPerUsd.replace(',', '.')) || 0.92);

  const options = useMemo<ConverterOption[]>(
    () => [
      { id: 'usd', symbol: 'USD', name: 'Dólar americano', priceUsd: 1, isFiat: true },
      { id: 'brl', symbol: 'BRL', name: 'Real brasileiro', priceUsd: 1 / parsedBrl, isFiat: true },
      { id: 'eur', symbol: 'EUR', name: 'Euro', priceUsd: 1 / parsedEur, isFiat: true },
      ...coins.map((c) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        priceUsd: c.currentPrice,
        image: c.image,
        change24h: c.priceChange24h,
      })),
    ],
    [coins, parsedBrl, parsedEur]
  );

  const fromAsset = options.find((o) => o.id === fromId) ?? options[0];
  const toAsset = options.find((o) => o.id === toId) ?? options[0];

  const amount = Number(amountStr.replace(',', '.'));
  const validAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;

  const rate =
    fromAsset && toAsset && toAsset.priceUsd > 0 ? fromAsset.priceUsd / toAsset.priceUsd : 0;
  const grossResult = validAmount * rate;
  const feePct = FEE_OPTIONS.find((f) => f.id === feeId)?.pct ?? 0;
  const feeCostToAsset = grossResult * (feePct / 100);
  const netResult = Math.max(0, grossResult - feeCostToAsset);

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const formatTargetValue = (val: number, target: ConverterOption) => {
    if (target.id === 'usd') return formatPrice(val, fmtOpts);
    if (target.id === 'brl') {
      return `R$ ${new Intl.NumberFormat(preferences.numberLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(val)}`;
    }
    if (target.id === 'eur') {
      return `€ ${new Intl.NumberFormat(preferences.numberLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(val)}`;
    }
    return new Intl.NumberFormat(preferences.numberLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(val);
  };

  const formattedResult = formatTargetValue(netResult, toAsset);

  const multiTargets = useMemo(() => {
    const preferredIds = ['usd', 'brl', 'eur', 'bitcoin', 'ethereum', 'solana', 'binancecoin'];
    return preferredIds
      .map((id) => options.find((o) => o.id === id))
      .filter((o): o is ConverterOption => Boolean(o && o.id !== fromAsset.id))
      .slice(0, 6);
  }, [options, fromAsset.id]);

  const handleSwap = () => {
    setFromId(toId);
    setToId(fromId);
    if (Number.isFinite(netResult) && netResult > 0) {
      setAmountStr(String(Number(netResult.toFixed(8))));
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${formattedResult} ${toAsset.symbol}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handleSaveHistory = () => {
    if (validAmount <= 0) return;
    const entry = buildSavedConversion({
      amountStr,
      fromId: fromAsset.id,
      fromSymbol: fromAsset.symbol,
      toId: toAsset.id,
      toSymbol: toAsset.symbol,
      resultText: formattedResult,
    });
    setHistory((prev) => [entry, ...prev].slice(0, 8));
  };

  const applyPairPreset = (nextFrom: string, nextTo: string) => {
    const hasFrom = options.some((o) => o.id === nextFrom);
    const hasTo = options.some((o) => o.id === nextTo);
    if (hasFrom) setFromId(nextFrom);
    if (hasTo) setToId(nextTo);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Conversor"
        subtitle="Cálculo em tempo real entre criptoativos e moedas fiduciárias (USD, BRL, EUR)."
        actions={
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="mr-1 inline-flex items-center gap-1 text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" aria-hidden="true" />
              Pares:
            </span>
            <button
              type="button"
              onClick={() => applyPairPreset('bitcoin', 'usd')}
              className="rounded-md border border-border/80 bg-card/75 px-2.5 py-1 font-mono text-foreground transition-colors hover:border-accent/50 hover:text-accent"
            >
              BTC → USD
            </button>
            <button
              type="button"
              onClick={() => applyPairPreset('bitcoin', 'brl')}
              className="rounded-md border border-border/80 bg-card/75 px-2.5 py-1 font-mono text-foreground transition-colors hover:border-accent/50 hover:text-accent"
            >
              BTC → BRL
            </button>
            <button
              type="button"
              onClick={() => applyPairPreset('ethereum', 'bitcoin')}
              className="rounded-md border border-border/80 bg-card/75 px-2.5 py-1 font-mono text-foreground transition-colors hover:border-accent/50 hover:text-accent"
            >
              ETH → BTC
            </button>
            <button
              type="button"
              onClick={() => applyPairPreset('solana', 'usd')}
              className="rounded-md border border-border/80 bg-card/75 px-2.5 py-1 font-mono text-foreground transition-colors hover:border-accent/50 hover:text-accent"
            >
              SOL → USD
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
        <div className="mx-auto w-full max-w-page space-y-5">
          {/* Top Grid: Main Converter + Quotes & Fiat FX */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Main Converter Card */}
            <div className="space-y-5 rounded-xl border border-border/80 bg-card/95 p-6 text-sm shadow-card">
              {/* Origin */}
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="conv-amount" className="font-medium text-muted-foreground">
                    Quantidade de origem
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    {AMOUNT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmountStr(preset)}
                        className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                          amountStr === preset
                            ? 'border-accent/60 bg-accent/15 text-accent'
                            : 'border-border/70 bg-background/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <input
                    id="conv-amount"
                    type="text"
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="h-control-lg min-w-0 flex-1 rounded-lg border border-border bg-background/90 px-3.5 font-mono text-base font-medium tabular-nums text-foreground outline-none transition-colors focus:border-accent"
                  />
                  <CustomSelect
                    ariaLabel="Ativo de origem"
                    value={fromId}
                    onChange={setFromId}
                    menuWidth={280}
                    className="h-control-lg w-full sm:w-60 bg-background/90 px-3 font-mono text-xs font-medium"
                    options={options.map((o) => ({
                      value: o.id,
                      label: `${o.symbol} — ${o.name}`,
                      iconUrl: o.image,
                    }))}
                  />
                </div>
              </div>

              {/* Swap Divider */}
              <div className="relative flex items-center justify-center py-0.5">
                <div className="absolute inset-x-0 top-1/2 border-t border-border/70" />
                <button
                  type="button"
                  onClick={handleSwap}
                  className="relative z-10 inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium text-foreground shadow-card transition-all hover:border-accent/60 hover:text-accent"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  <span>Inverter par</span>
                </button>
              </div>

              {/* Target */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-muted-foreground">
                    Equivalente estimado {feePct > 0 ? `(após taxa de ${feePct}%)` : ''}
                  </span>
                  {feePct > 0 ? (
                    <span className="font-mono text-[11px] text-amber-400">
                      Custo taxa: {formatTargetValue(feeCostToAsset, toAsset)} {toAsset.symbol}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <div className="flex h-control-lg min-w-0 flex-1 items-center rounded-lg border border-border bg-background/60 px-3.5 font-mono text-base font-semibold tabular-nums text-foreground">
                    {formattedResult}
                  </div>
                  <CustomSelect
                    ariaLabel="Ativo de destino"
                    value={toId}
                    onChange={setToId}
                    menuWidth={280}
                    className="h-control-lg w-full sm:w-60 bg-background/90 px-3 font-mono text-xs font-medium"
                    options={options.map((o) => ({
                      value: o.id,
                      label: `${o.symbol} — ${o.name}`,
                      iconUrl: o.image,
                    }))}
                  />
                </div>
              </div>

              {/* Fee / Spread Simulator */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/50 px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Percent className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  Simular taxa / spread:
                </span>
                <HeaderSegmented
                  value={feeId}
                  onChange={setFeeId}
                  tone="surface"
                  options={FEE_OPTIONS.map((f) => ({ id: f.id, label: f.label }))}
                />
              </div>

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  1 {fromAsset.symbol} = {rate > 0 ? formatPrice(rate, fmtOpts) : '--'}{' '}
                  {toAsset.symbol}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveHistory}
                    disabled={validAmount <= 0}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-background/80 px-3 font-medium text-foreground transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Salvar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-background/80 px-3 font-medium text-foreground transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-positive" aria-hidden="true" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copiar resultado</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Sidebar Card: Quotes & Fiat FX */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border/80 bg-card/95 p-4 text-xs shadow-card">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cotações utilizadas
                </h2>
                <dl className="mt-3 divide-y divide-border/70 tabular-nums">
                  {!fromAsset.isFiat ? (
                    <div className="flex items-center justify-between py-2">
                      <dt className="font-mono text-muted-foreground">{fromAsset.symbol}/USD</dt>
                      <dd className="font-mono font-medium text-foreground">
                        {formatPrice(fromAsset.priceUsd, fmtOpts)}
                      </dd>
                    </div>
                  ) : null}
                  {!toAsset.isFiat && toAsset.id !== fromAsset.id ? (
                    <div className="flex items-center justify-between py-2">
                      <dt className="font-mono text-muted-foreground">{toAsset.symbol}/USD</dt>
                      <dd className="font-mono font-medium text-foreground">
                        {formatPrice(toAsset.priceUsd, fmtOpts)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted-foreground">Valor em USD</dt>
                    <dd className="font-mono font-medium text-foreground">
                      {formatPrice(validAmount * fromAsset.priceUsd, fmtOpts)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted-foreground">Atualizado</dt>
                    <dd className="font-mono text-foreground">
                      {fetchedAt ? formatTime(fetchedAt, preferences.timezone) : '--:--:--'}
                    </dd>
                  </div>
                </dl>

                {/* Editable Fiat FX rates */}
                <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Câmbio fiduciário (ajustável)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-muted-foreground">USD / BRL</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={brlPerUsd}
                        onChange={(e) => setBrlPerUsd(e.target.value)}
                        className="h-7 w-full rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-muted-foreground">USD / EUR</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={eurPerUsd}
                        onChange={(e) => setEurPerUsd(e.target.value)}
                        className="h-7 w-full rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Quote Grid */}
          <div className="rounded-xl border border-border/80 bg-card/95 p-6 shadow-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Equivalência multi-moedas para {validAmount || 0} {fromAsset.symbol}
              </h2>
              <span className="text-xs text-muted-foreground">
                Clique em qualquer moeda para definir como destino
              </span>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {multiTargets.map((target) => {
                const targetRate = target.priceUsd > 0 ? fromAsset.priceUsd / target.priceUsd : 0;
                const val = validAmount * targetRate * (1 - feePct / 100);
                const isSelected = target.id === toAsset.id;
                return (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => setToId(target.id)}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-accent/60 bg-accent/10 shadow-sm'
                        : 'border-border/75 bg-background/60 hover:border-accent/40 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {target.image ? (
                        <img
                          src={target.image}
                          alt={target.name}
                          className="h-7 w-7 shrink-0 rounded-full"
                        />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-bold text-accent">
                          {target.symbol[0]}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {target.symbol}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{target.name}</p>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                      {formatTargetValue(val, target)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Grid: Scale Reference Table + Saved Conversions */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Quick Reference Scale */}
            <div className="overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-card">
              <div className="border-b border-border/70 bg-nav/60 px-4 py-2.5 text-xs font-semibold text-foreground">
                Tabela rápida ({fromAsset.symbol} → {toAsset.symbol})
              </div>
              <table className="w-full border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-border/70 text-[11px] uppercase text-muted-foreground">
                    <th className="px-4 py-2 text-left">{fromAsset.symbol}</th>
                    <th className="px-4 py-2 text-right">{toAsset.symbol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {SCALE_MULTIPLIERS.map((mult) => (
                    <tr
                      key={mult}
                      onClick={() => setAmountStr(String(mult))}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-1.5 font-mono font-medium text-foreground">
                        {mult} {fromAsset.symbol}
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono text-muted-foreground">
                        {formatTargetValue(mult * rate * (1 - feePct / 100), toAsset)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Saved History */}
            <div className="overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-card">
              <div className="flex items-center justify-between border-b border-border/70 bg-nav/60 px-4 py-2.5 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <History className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  Conversões salvas ({history.length})
                </span>
                {history.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setHistory([])}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-negative"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    Limpar
                  </button>
                ) : null}
              </div>
              {history.length === 0 ? (
                <div className="flex h-48 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                  Clique em &ldquo;Salvar&rdquo; após calcular para registrar aqui e reaplicar em 1 clique.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setAmountStr(item.amountStr);
                        setFromId(item.fromId);
                        setToId(item.toId);
                      }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs transition-colors hover:bg-muted/40"
                    >
                      <div>
                        <p className="font-mono font-medium text-foreground">
                          {item.amountStr} {item.fromSymbol} → {item.resultText} {item.toSymbol}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Salvo às {formatTime(item.timestamp, preferences.timezone)}
                        </p>
                      </div>
                      <span className="text-[11px] font-medium text-accent">Aplicar</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
