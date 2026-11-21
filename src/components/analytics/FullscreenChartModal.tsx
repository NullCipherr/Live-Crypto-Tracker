import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CoinMarket } from '../../types/crypto';
import { formatDateShort, formatPercent } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';

interface FullscreenChartModalProps {
  title: string;
  periodLabel: string;
  coins: CoinMarket[];
  selectedIds: string[];
  seriesColors: string[];
  chartRows: Record<string, number | string>[];
  onToggleCoin: (id: string) => void;
  onClose: () => void;
}

export function FullscreenChartModal({
  title,
  periodLabel,
  coins,
  selectedIds,
  seriesColors,
  chartRows,
  onToggleCoin,
  onClose,
}: FullscreenChartModalProps) {
  const { preferences } = usePreferences();
  const [cursorIndex, setCursorIndex] = useState<number>(() =>
    Math.max(0, chartRows.length - 1)
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCursorIndex((prev) => Math.min(chartRows.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCursorIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chartRows.length, onClose]);

  const activeRow = chartRows[cursorIndex];
  const activeTs = activeRow ? Number(activeRow.timestamp) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background p-4 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} em tela cheia`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Analytics / {title}
          </h2>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Sair da tela cheia</span>
        </button>
      </div>

      <div className="my-3 flex flex-wrap items-center gap-2 text-xs">
        {coins.map((c) => {
          const checked = selectedIds.includes(c.id);
          return (
            <label
              key={c.id}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-border bg-card px-2.5 py-1"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleCoin(c.id)}
                className="accent-accent"
              />
              <span className="font-mono font-semibold text-foreground">
                {c.symbol.toUpperCase()}
              </span>
            </label>
          );
        })}
      </div>

      <div className="relative min-h-0 flex-1 rounded border border-border bg-card p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartRows} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts: number) => formatDateShort(ts, preferences.timezone)}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11 }}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11 }}
              width={56}
            />
            {activeTs ? (
              <ReferenceLine x={activeTs} stroke="hsl(var(--accent))" strokeDasharray="3 3" />
            ) : null}
            <Tooltip
              contentStyle={{
                borderRadius: '4px',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                fontSize: '12px',
              }}
              labelFormatter={(ts) => formatDateShort(Number(ts), preferences.timezone)}
              formatter={(value, name) => [
                formatPercent(Number(value ?? 0), preferences.numberLocale),
                String(name),
              ]}
            />
            {selectedIds.map((id, idx) => {
              const coin = coins.find((c) => c.id === id);
              if (!coin) return null;
              return (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={coin.symbol.toUpperCase()}
                  stroke={seriesColors[idx % seriesColors.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>

        {activeRow && activeTs ? (
          <div className="pointer-events-none absolute right-6 top-6 rounded border border-border bg-nav/95 p-3 text-xs shadow-lg">
            <p className="mb-1.5 font-mono text-[11px] font-semibold text-foreground">
              {formatDateShort(activeTs, preferences.timezone)}
            </p>
            <div className="space-y-1 tabular-nums">
              {selectedIds.map((id, idx) => {
                const coin = coins.find((c) => c.id === id);
                if (!coin) return null;
                const val = Number(activeRow[id] ?? 0);
                return (
                  <div key={id} className="flex items-center justify-between gap-4">
                    <span
                      className="font-mono font-semibold"
                      style={{ color: seriesColors[idx % seriesColors.length] }}
                    >
                      {coin.symbol.toUpperCase()}
                    </span>
                    <span className="font-mono text-foreground">
                      {formatPercent(val, preferences.numberLocale)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Use ← e → no teclado para percorrer as datas</span>
        <span>Esc para voltar</span>
      </div>
    </div>
  );
}
