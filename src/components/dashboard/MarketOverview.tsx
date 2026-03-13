import type { MarketStats } from '../../types/crypto';
import { formatCompactNumber, formatPercent } from '../../lib/formatters';
import { Surface } from '../ui/Surface';

interface MarketOverviewProps {
  stats: MarketStats;
}

export function MarketOverview({ stats }: MarketOverviewProps) {
  const total = Math.max(stats.totalCoins, 1);
  const positiveRatio = Math.round((stats.positiveCount / total) * 100);
  const negativeRatio = 100 - positiveRatio;

  return (
    <Surface className="p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Market Overview</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniMetric label="Avg Change" value={formatPercent(stats.avgChange24h)} />
        <MiniMetric label="Coins" value={String(stats.totalCoins)} />
        <MiniMetric label="Total Cap" value={`$${formatCompactNumber(stats.totalMarketCap)}`} />
        <MiniMetric label="Total Volume" value={`$${formatCompactNumber(stats.totalVolume)}`} />
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Performance Split</span>
          <span>{positiveRatio}% Positive</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-positive" style={{ width: `${positiveRatio}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{negativeRatio}% are trading below 24h reference.</p>
      </div>
    </Surface>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
