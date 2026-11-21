import { useState } from 'react';
import { X } from 'lucide-react';
import type {
  AlertConditionType,
  AlertMetric,
  AlertRepeat,
  AlertRule,
  CoinMarket,
} from '../../types/crypto';
import { formatCurrencyUSD, formatPercent, formatPrice } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';

interface AlertRuleModalProps {
  coins: CoinMarket[];
  initialCoinId?: string;
  editingRule?: AlertRule | null;
  onSave: (data: {
    coinId: string;
    metric: AlertMetric;
    condition: AlertConditionType;
    threshold: number;
    repeat: AlertRepeat;
  }) => void;
  onClose: () => void;
}

export function AlertRuleModal({
  coins,
  initialCoinId,
  editingRule,
  onSave,
  onClose,
}: AlertRuleModalProps) {
  const { preferences } = usePreferences();
  const [coinId, setCoinId] = useState(
    editingRule?.coinId ?? initialCoinId ?? coins[0]?.id ?? 'bitcoin'
  );
  const [metric, setMetric] = useState<AlertMetric>(editingRule?.metric ?? 'price');
  const [condition, setCondition] = useState<AlertConditionType>(
    editingRule?.condition ?? 'cross_below'
  );
  const [threshold, setThreshold] = useState<string>(() => {
    if (editingRule) return String(editingRule.threshold);
    const targetCoin = coins.find((c) => c.id === (initialCoinId ?? coins[0]?.id));
    return targetCoin ? String(targetCoin.currentPrice) : '';
  });
  const [repeat, setRepeat] = useState<AlertRepeat>(editingRule?.repeat ?? 'once');

  const selectedCoin = coins.find((c) => c.id === coinId);
  const thresholdNum = Number(threshold);
  const isValid = Number.isFinite(thresholdNum) && (metric === 'change24h' || thresholdNum > 0);

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const formattedThreshold = Number.isFinite(thresholdNum)
    ? metric === 'price'
      ? formatPrice(thresholdNum, fmtOpts)
      : formatPercent(thresholdNum, preferences.numberLocale)
    : '--';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      coinId,
      metric,
      condition,
      threshold: thresholdNum,
      repeat,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={editingRule ? 'Editar regra de alerta' : 'Novo alerta'}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-md border border-border bg-card shadow-overlay"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {editingRule ? 'Editar regra' : 'Novo alerta'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário de alerta"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 p-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="alert-coin" className="mb-1 block text-muted-foreground">
                Ativo
              </label>
              <select
                id="alert-coin"
                value={coinId}
                onChange={(e) => setCoinId(e.target.value)}
                className="h-8 w-full rounded border border-border bg-background px-2 text-foreground"
              >
                {coins.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.symbol.toUpperCase()} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="alert-metric" className="mb-1 block text-muted-foreground">
                Monitorar
              </label>
              <select
                id="alert-metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value as AlertMetric)}
                className="h-8 w-full rounded border border-border bg-background px-2 text-foreground"
              >
                <option value="price">Preço em USD</option>
                <option value="change24h">Variação 24h (%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="alert-cond" className="mb-1 block text-muted-foreground">
                Condição
              </label>
              <select
                id="alert-cond"
                value={condition}
                onChange={(e) => setCondition(e.target.value as AlertConditionType)}
                className="h-8 w-full rounded border border-border bg-background px-2 text-foreground"
              >
                <option value="cross_below">Cruza abaixo de</option>
                <option value="cross_above">Cruza acima de</option>
              </select>
            </div>

            <div>
              <label htmlFor="alert-threshold" className="mb-1 block text-muted-foreground">
                Limiar ({metric === 'price' ? 'USD' : '%'})
              </label>
              <input
                id="alert-threshold"
                type="number"
                step="any"
                required
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="h-8 w-full rounded border border-border bg-background px-2.5 font-mono text-foreground outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="alert-repeat" className="mb-1 block text-muted-foreground">
                Repetição
              </label>
              <select
                id="alert-repeat"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as AlertRepeat)}
                className="h-8 w-full rounded border border-border bg-background px-2 text-foreground"
              >
                <option value="once">Uma vez</option>
                <option value="recurring">Recorrente</option>
              </select>
            </div>

            <div>
              <span className="mb-1 block text-muted-foreground">Entrega</span>
              <div className="flex h-8 items-center rounded border border-border bg-background px-2.5 text-muted-foreground">
                No aplicativo
              </div>
            </div>
          </div>

          <div className="rounded border border-border bg-background px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Último valor válido</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {selectedCoin
                  ? metric === 'price'
                    ? formatCurrencyUSD(selectedCoin.currentPrice, fmtOpts)
                    : formatPercent(selectedCoin.priceChange24h, preferences.numberLocale)
                  : '--'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {condition === 'cross_below'
                ? `Dispara na passagem de ≥ ${formattedThreshold} para < ${formattedThreshold}.`
                : `Dispara na passagem de ≤ ${formattedThreshold} para > ${formattedThreshold}.`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-nav px-4 py-3 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded border border-border bg-card px-3 font-medium text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!isValid}
            className="h-8 rounded bg-accent px-3 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            Salvar regra
          </button>
        </div>
      </form>
    </div>
  );
}
