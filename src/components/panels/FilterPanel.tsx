import { useState } from 'react';
import { X } from 'lucide-react';
import type { CoinMarket, MonitorFilters } from '../../types/crypto';
import { applyMonitorFilters } from '../../lib/market';
import { DEFAULT_MONITOR_FILTERS } from '../../lib/defaults';

interface FilterPanelProps {
  filters: MonitorFilters;
  coins: CoinMarket[];
  watchlistSet: Set<string>;
  onApply: (filters: MonitorFilters) => void;
  onClose: () => void;
}

export function FilterPanel({
  filters,
  coins,
  watchlistSet,
  onApply,
  onClose,
}: FilterPanelProps) {
  const [draft, setDraft] = useState<MonitorFilters>(filters);

  const previewCount = applyMonitorFilters(coins, draft, watchlistSet).length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Filtrar ativos do monitor"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Filtrar ativos</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar filtros"
            className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
          <div>
            <p className="mb-1.5 font-medium text-muted-foreground">Universo</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'all', label: 'Todos os ativos' },
                  { id: 'favorites', label: 'Favoritos' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, universe: opt.id }))}
                  className={`h-8 rounded border px-2 font-medium transition-colors ${
                    draft.universe === opt.id
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 font-medium text-muted-foreground">Variação 24h</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'all', label: 'Qualquer' },
                  { id: 'up', label: 'Em alta' },
                  { id: 'down', label: 'Em queda' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, direction: opt.id }))}
                  className={`h-8 rounded border px-2 font-medium transition-colors ${
                    draft.direction === opt.id
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="min-cap" className="mb-1.5 block font-medium text-muted-foreground">
              Capitalização mínima (USD)
            </label>
            <input
              id="min-cap"
              type="number"
              min="0"
              placeholder="Ex: 10000000000"
              value={draft.minMarketCap}
              onChange={(e) => setDraft((prev) => ({ ...prev, minMarketCap: e.target.value }))}
              className="h-8 w-full rounded border border-border bg-background px-2.5 font-mono text-xs text-foreground outline-none focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="min-vol" className="mb-1.5 block font-medium text-muted-foreground">
              Volume mínimo em 24h (USD)
            </label>
            <input
              id="min-vol"
              type="number"
              min="0"
              placeholder="Ex: 1000000000"
              value={draft.minVolume}
              onChange={(e) => setDraft((prev) => ({ ...prev, minVolume: e.target.value }))}
              className="h-8 w-full rounded border border-border bg-background px-2.5 font-mono text-xs text-foreground outline-none focus:border-accent"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded border border-border bg-background px-3 py-2">
            <input
              type="checkbox"
              checked={draft.excludeStablecoins}
              onChange={(e) => setDraft((prev) => ({ ...prev, excludeStablecoins: e.target.checked }))}
              className="accent-accent"
            />
            <span className="text-foreground">Excluir stablecoins (USDT, USDC, DAI…)</span>
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-nav px-4 py-3 text-xs">
          <span className="tabular-nums text-muted-foreground">
            {previewCount} {previewCount === 1 ? 'ativo corresponde' : 'ativos correspondem'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft(DEFAULT_MONITOR_FILTERS)}
              className="h-8 rounded border border-border bg-card px-3 font-medium text-foreground hover:bg-muted"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                onClose();
              }}
              className="h-8 rounded bg-accent px-3 font-semibold text-accent-foreground hover:opacity-90"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
