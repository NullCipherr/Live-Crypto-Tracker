import { useMemo } from 'react';
import { ArrowRight, Bell, Star, X } from 'lucide-react';
import type { CoinMarket } from '../../types/crypto';
import {
  formatCompactNumber,
  formatCurrencyUSD,
  formatPercent,
  formatPrice,
  formatTime,
} from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';

interface QuickInspectorProps {
  coin: CoinMarket;
  favorite: boolean;
  fetchedAt?: number;
  onToggleFavorite: (coinId: string) => void;
  onCreateAlert?: (coinId: string) => void;
  onOpenAsset: (coinId: string) => void;
  onClose: () => void;
}

export function QuickInspector({
  coin,
  favorite,
  fetchedAt,
  onToggleFavorite,
  onCreateAlert,
  onOpenAsset,
  onClose,
}: QuickInspectorProps) {
  const { preferences } = usePreferences();

  const reduceMotion =
    preferences.reduceMotion === 'reduce' ||
    (preferences.reduceMotion === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const chartInfo = useMemo(() => {
    const raw = coin.sparkline7d;
    const data = raw.length > 24 ? raw.slice(-24) : raw;
    if (data.length < 2) return null;

    let min = Infinity;
    let max = -Infinity;
    for (const v of data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min || 1;
    const w = 340;
    const h = 120;
    const padX = 6;
    const padY = 10;

    const coords = data.map((v, i) => ({
      x: Number((padX + (i / (data.length - 1)) * (w - padX * 2)).toFixed(1)),
      y: Number((h - padY - ((v - min) / range) * (h - padY * 2)).toFixed(1)),
    }));

    const linePts = coords.map((p) => `${p.x},${p.y}`).join(' ');
    const areaPath = `M ${coords[0].x},${h} L ${coords.map((p) => `${p.x},${p.y}`).join(' L ')} L ${coords[coords.length - 1].x},${h} Z`;
    const lastPt = coords[coords.length - 1];

    return { linePts, areaPath, lastPt, min, max, w, h };
  }, [coin.sparkline7d]);

  const isPositive = coin.priceChange24h > 0;
  const isNegative = coin.priceChange24h < 0;

  const rangeSpan = Math.max(coin.high24h - coin.low24h, 0);
  const aboveLow = Math.max(coin.currentPrice - coin.low24h, 0);
  const rangePct =
    rangeSpan > 0 ? Math.min(100, Math.max(0, (aboveLow / rangeSpan) * 100)) : 50;

  return (
    <aside
      aria-label={`Inspeção rápida de ${coin.name}`}
      className={`flex h-full w-full flex-col overflow-hidden border-l border-border bg-card shadow-panel lg:w-[430px] xl:w-[460px] lg:shrink-0 ${
        reduceMotion ? '' : 'animate-drawer-in'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={coin.image}
            alt={`${coin.name} logo`}
            width={36}
            height={36}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="h-9 w-9 shrink-0 rounded-full border border-border bg-background"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
                {coin.name}
              </h2>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase text-foreground">
                {coin.symbol}
              </span>
              <span className="font-mono text-xs text-muted-foreground">#{coin.marketCapRank}</span>
            </div>
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              Captura {fetchedAt ? formatTime(fetchedAt, preferences.timezone) : '--:--:--'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar inspeção rápida"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-3.5 overflow-y-auto overflow-x-hidden p-4">
        {/* Hero Quote */}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {formatCurrencyUSD(coin.currentPrice, fmtOpts)}
          </span>
          <span
            className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
              isPositive
                ? 'bg-positive/10 text-positive'
                : isNegative
                  ? 'bg-negative/10 text-negative'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {formatPercent(coin.priceChange24h, preferences.numberLocale)} em 24h
          </span>
        </div>

        {/* 24h Area Chart */}
        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Tendência recente (USD)</span>
            <span className="font-mono">Últimas 24h</span>
          </div>

          {chartInfo ? (
            <div className="rounded-lg border border-border bg-background/80 p-3 shadow-card">
              <div className="flex items-stretch gap-2.5">
                <div className="flex shrink-0 flex-col justify-between text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  <span>{formatPrice(chartInfo.max, fmtOpts)}</span>
                  <span>{formatPrice((chartInfo.max + chartInfo.min) / 2, fmtOpts)}</span>
                  <span>{formatPrice(chartInfo.min, fmtOpts)}</span>
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <svg
                    viewBox={`0 0 ${chartInfo.w} ${chartInfo.h}`}
                    className="block h-28 w-full"
                    role="img"
                    aria-label={`Gráfico de preço de ${coin.name} nas últimas 24 horas`}
                  >
                  <defs>
                    <linearGradient id={`qi-grad-${coin.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  <line
                    x1="0"
                    y1={chartInfo.h / 2}
                    x2={chartInfo.w}
                    y2={chartInfo.h / 2}
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                  />
                  <path d={chartInfo.areaPath} fill={`url(#qi-grad-${coin.id})`} />
                  <polyline
                    fill="none"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={chartInfo.linePts}
                  />
                  <circle
                    cx={chartInfo.lastPt.x}
                    cy={chartInfo.lastPt.y}
                    r="3.5"
                    fill="hsl(var(--accent))"
                    stroke="hsl(var(--card))"
                    strokeWidth="1.5"
                  />
                  </svg>
                </div>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-1.5 font-mono text-[10px] text-muted-foreground">
                <span>−24h</span>
                <span>−12h</span>
                <span>Agora</span>
              </div>
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center rounded-lg border border-border bg-background/80 text-xs text-muted-foreground shadow-card">
              Sparkline 7d não disponível para este ativo fora do Top 250.
            </div>
          )}
        </div>

        {/* 24h Trading Range Bar */}
        <div className="rounded-lg border border-border bg-background/80 p-3.5 shadow-card">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-medium text-foreground">Faixa de negociação (24h)</span>
            <span className="font-mono text-muted-foreground tabular-nums">
              {Math.round(rangePct)}% da faixa
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${rangePct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-muted-foreground">
            <span>Mín {formatPrice(coin.low24h, fmtOpts)}</span>
            <span>Máx {formatPrice(coin.high24h, fmtOpts)}</span>
          </div>
        </div>

        {/* 2x2 Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-lg border border-border bg-background/80 p-3 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Capitalização
            </p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
              US$ {formatCompactNumber(coin.marketCap, preferences.numberLocale)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/80 p-3 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Volume 24h
            </p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
              US$ {formatCompactNumber(coin.totalVolume, preferences.numberLocale)}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Use <kbd className="rounded border border-border px-1 font-mono">↑</kbd>{' '}
          <kbd className="rounded border border-border px-1 font-mono">↓</kbd> na tabela para
          trocar o ativo ou{' '}
          <kbd className="rounded border border-border px-1 font-mono">Enter</kbd> para abrir a
          análise completa.
        </p>
      </div>

      {/* Modern Footer Actions */}
      <div className="shrink-0 border-t border-border/80 bg-card/95 p-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-background p-0.5 shadow-card">
            <button
              type="button"
              onClick={() => onToggleFavorite(coin.id)}
              aria-pressed={favorite}
              title={favorite ? 'Remover dos favoritos' : 'Favoritar ativo'}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                favorite
                  ? 'bg-accent/15 text-accent'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${favorite ? 'fill-current' : ''}`} aria-hidden="true" />
              <span>{favorite ? 'Favorito' : 'Favoritar'}</span>
            </button>

            {onCreateAlert ? (
              <button
                type="button"
                onClick={() => onCreateAlert(coin.id)}
                title="Criar alerta de preço"
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Alerta</span>
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onOpenAsset(coin.id)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-semibold text-accent-foreground shadow-card transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span>Análise completa</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
