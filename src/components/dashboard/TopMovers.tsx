import { Flame, ArrowDownRight, Orbit } from 'lucide-react';
import type { ComponentType } from 'react';
import type { CoinMarket } from '../../types/crypto';
import { formatPercent } from '../../lib/formatters';
import { Surface } from '../ui/Surface';

interface TopMoversProps {
  gainer: CoinMarket | null;
  loser: CoinMarket | null;
  momentum: CoinMarket | null;
}

export function TopMovers({ gainer, loser, momentum }: TopMoversProps) {
  return (
    <Surface className="p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Top Movers</h3>
      <div className="mt-4 space-y-3">
        <MoverRow
          label="Highest Gain"
          icon={Flame}
          coinName={gainer?.name ?? 'N/A'}
          value={gainer ? formatPercent(gainer.priceChange24h) : '0.00%'}
          positive
        />
        <MoverRow
          label="Biggest Drop"
          icon={ArrowDownRight}
          coinName={loser?.name ?? 'N/A'}
          value={loser ? formatPercent(loser.priceChange24h) : '0.00%'}
        />
        <MoverRow
          label="Best Momentum"
          icon={Orbit}
          coinName={momentum?.name ?? 'N/A'}
          value={momentum ? formatPercent(momentum.priceChange24h) : '0.00%'}
          positive={momentum ? momentum.priceChange24h >= 0 : true}
        />
      </div>
    </Surface>
  );
}

function MoverRow({
  label,
  coinName,
  value,
  icon: Icon,
  positive,
}: {
  label: string;
  coinName: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-card p-1.5 text-accent">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold text-foreground">{coinName}</p>
        </div>
      </div>
      <p className={positive ? 'text-sm font-semibold text-positive' : 'text-sm font-semibold text-negative'}>
        {value}
      </p>
    </div>
  );
}
