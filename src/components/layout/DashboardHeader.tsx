import { Search, RefreshCw, Moon, Sun, Radio } from 'lucide-react';
import { formatDateTime } from '../../lib/formatters';

interface DashboardHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  isFetching: boolean;
  fetchedAt?: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function DashboardHeader({
  search,
  onSearchChange,
  onRefresh,
  isFetching,
  fetchedAt,
  theme,
  onToggleTheme,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="hidden items-center gap-2 sm:flex">
          <div className="rounded-xl bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground">LC</div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-foreground">Live Crypto Tracker V2</h1>
            <p className="text-xs text-muted-foreground">Premium market monitor</p>
          </div>
        </div>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by coin name or ticker..."
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-foreground outline-none ring-accent/30 transition-all placeholder:text-muted-foreground focus:ring"
          />
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-positive/30 bg-positive/10 px-2.5 py-1 text-xs font-semibold text-positive">
            <Radio className="h-3.5 w-3.5" />
            Live Market
          </div>
          <p className="text-xs text-muted-foreground">Updated {formatDateTime(fetchedAt)}</p>
        </div>

        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        <button
          onClick={onToggleTheme}
          className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
