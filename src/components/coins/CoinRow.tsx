import { useState, type ComponentType } from 'react';
import { ChevronDown, ChevronUp, Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { CoinMarket } from '../../types/crypto';
import { formatCompactNumber, formatCurrency, formatPercent } from '../../lib/formatters';
import { CoinSparkline } from './CoinSparkline';
import { CoinExpandedPanel } from './CoinExpandedPanel';
import { Surface } from '../ui/Surface';

interface CoinRowProps {
  coin: CoinMarket;
  favorite: boolean;
  onToggleFavorite: (coinId: string) => void;
}

export function CoinRow({ coin, favorite, onToggleFavorite }: CoinRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isPositive = coin.priceChange24h >= 0;

  return (
    <Surface className="p-4 transition-all duration-300 hover:-translate-y-[1px] hover:border-accent/30">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <img src={coin.image} alt={`${coin.name} logo`} className="h-11 w-11 rounded-full border border-border bg-white p-0.5" loading="lazy" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{coin.name}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {coin.symbol} • Rank #{coin.marketCapRank}
            </p>
          </div>
          <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', trendClass(coin.priceChange24h))}>
            {coin.trend === 'up' ? 'Uptrend' : coin.trend === 'down' ? 'Downtrend' : 'Flat'}
          </span>
        </button>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-3">
          <Metric label="Price" value={formatCurrency(coin.currentPrice)} />
          <Metric
            label="24H"
            value={formatPercent(coin.priceChange24h)}
            valueClass={isPositive ? 'text-positive' : 'text-negative'}
            icon={coin.priceChange24h > 0 ? TrendingUp : coin.priceChange24h < 0 ? TrendingDown : Minus}
          />
          <Metric label="Cap" value={`$${formatCompactNumber(coin.marketCap)}`} />
          <Metric label="Volume" value={`$${formatCompactNumber(coin.totalVolume)}`} />
        </div>

        <div className="flex items-center justify-end gap-2">
          <div className="hidden w-36 lg:block">
            <CoinSparkline data={coin.sparkline7d} positive={isPositive} />
          </div>
          <button
            onClick={() => onToggleFavorite(coin.id)}
            className={cn(
              'rounded-lg border px-2.5 py-2 transition-colors',
              favorite
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            )}
            aria-label={`Toggle ${coin.name} favorite`}
          >
            <Star className={cn('h-4 w-4', favorite && 'fill-current')} />
          </button>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-lg border border-border bg-card px-2.5 py-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Toggle ${coin.name} details`}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded ? <CoinExpandedPanel coin={coin} expanded={expanded} /> : null}
    </Surface>
  );
}

function Metric({
  label,
  value,
  valueClass,
  icon: Icon,
}: {
  label: string;
  value: string;
  valueClass?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className={cn('mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground', valueClass)}>
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span>{value}</span>
      </div>
    </div>
  );
}

function trendClass(value: number): string {
  if (value > 0.35) return 'bg-positive/10 text-positive';
  if (value < -0.35) return 'bg-negative/10 text-negative';
  return 'bg-muted text-muted-foreground';
}
