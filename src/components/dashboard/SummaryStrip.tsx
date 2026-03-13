import { Layers, Gauge, ShieldCheck, TrendingUp } from 'lucide-react';
import type { ComponentType } from 'react';
import type { CoinMarket, MarketStats } from '../../types/crypto';
import { formatCompactNumber, formatPercent } from '../../lib/formatters';
import { getSentiment } from '../../lib/market';
import { Surface } from '../ui/Surface';

interface SummaryStripProps {
  stats: MarketStats;
  topGainer: CoinMarket | null;
}

export function SummaryStrip({ stats, topGainer }: SummaryStripProps) {
  const sentiment = getSentiment(stats.avgChange24h);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        title="Coins Tracked"
        value={String(stats.totalCoins)}
        detail="Top market cap assets"
        icon={Layers}
      />
      <SummaryCard
        title="Avg 24H Move"
        value={formatPercent(stats.avgChange24h)}
        detail={`${stats.positiveCount} up / ${stats.negativeCount} down`}
        icon={Gauge}
      />
      <SummaryCard
        title="Combined Market Cap"
        value={`$${formatCompactNumber(stats.totalMarketCap)}`}
        detail={`Volume $${formatCompactNumber(stats.totalVolume)}`}
        icon={ShieldCheck}
      />
      <SummaryCard
        title="Best Performer"
        value={topGainer ? topGainer.name : 'N/A'}
        detail={topGainer ? formatPercent(topGainer.priceChange24h) : sentiment}
        icon={TrendingUp}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Surface className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/40 p-2 text-accent">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Surface>
  );
}
