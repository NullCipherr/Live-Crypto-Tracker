import { ExternalLink, Activity } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCoinDescription } from '../../hooks/useCoinDescription';
import { formatCompactNumber, formatCurrency } from '../../lib/formatters';
import type { CoinMarket } from '../../types/crypto';

interface CoinExpandedPanelProps {
  coin: CoinMarket;
  expanded: boolean;
}

export function CoinExpandedPanel({ coin, expanded }: CoinExpandedPanelProps) {
  const { data: description } = useCoinDescription(coin.id, expanded);

  const chartData = coin.sparkline7d.map((price, index) => ({
    t: index,
    price,
  }));

  const positive = coin.priceChange24h >= 0;

  return (
    <div className="mt-5 grid gap-5 rounded-2xl border border-border/70 bg-muted/30 p-4 lg:grid-cols-[2fr_1fr]">
      <div className="h-56 w-full rounded-xl border border-border/70 bg-card/80 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id={`coin-gradient-${coin.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={positive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'} stopOpacity={0.35} />
                <stop offset="95%" stopColor={positive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'} stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
              contentStyle={{
                borderRadius: '0.8rem',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
              }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Price']}
              labelFormatter={() => '7D trend'}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={positive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
              strokeWidth={2}
              fill={`url(#coin-gradient-${coin.id})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="24H High" value={formatCurrency(coin.high24h)} />
          <Metric label="24H Low" value={formatCurrency(coin.low24h)} />
          <Metric label="Volume" value={`$${formatCompactNumber(coin.totalVolume)}`} />
          <Metric label="Mkt Rank" value={`#${coin.marketCapRank}`} />
        </div>

        <div className="rounded-xl border border-border/70 bg-card/80 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Activity className="h-4 w-4" />
            Project Brief
          </div>
          <p className="text-sm text-muted-foreground">
            {description || 'Description unavailable from API for this asset at the moment.'}
          </p>
        </div>

        <a
          href={`https://www.coingecko.com/en/coins/${coin.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition-opacity hover:opacity-80"
        >
          View Details
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-2.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
