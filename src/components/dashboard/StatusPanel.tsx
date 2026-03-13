import { Activity, Clock3, Radio, Signal } from 'lucide-react';
import type { ComponentType } from 'react';
import { formatDateTime } from '../../lib/formatters';
import { Surface } from '../ui/Surface';

interface StatusPanelProps {
  fetchedAt?: number;
  isError: boolean;
  isFetching: boolean;
  shownCoins: number;
  latencyMs?: number;
}

export function StatusPanel({ fetchedAt, isError, isFetching, shownCoins, latencyMs }: StatusPanelProps) {
  return (
    <Surface className="p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">System Status</h3>
      <div className="mt-4 space-y-3 text-sm">
        <StatusRow
          icon={Radio}
          label="API status"
          value={isError ? 'degraded' : isFetching ? 'syncing' : 'healthy'}
          valueClass={isError ? 'text-negative' : isFetching ? 'text-accent' : 'text-positive'}
        />
        <StatusRow icon={Clock3} label="Last update" value={formatDateTime(fetchedAt)} />
        <StatusRow icon={Activity} label="Shown assets" value={String(shownCoins)} />
        <StatusRow icon={Signal} label="Latency" value={latencyMs ? `${latencyMs}ms` : '--'} />
      </div>
    </Surface>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <span className={`text-sm font-semibold text-foreground ${valueClass ?? ''}`}>{value}</span>
    </div>
  );
}
