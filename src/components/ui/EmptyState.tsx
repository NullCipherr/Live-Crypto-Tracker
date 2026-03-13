import { SearchX } from 'lucide-react';
import { Surface } from './Surface';

interface EmptyStateProps {
  onReset: () => void;
}

export function EmptyState({ onReset }: EmptyStateProps) {
  return (
    <Surface className="p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-semibold text-foreground">No assets match your filters</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Try another query or reset current filters to view all tracked coins.
      </p>
      <button
        onClick={onReset}
        className="mt-6 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
      >
        Clear Filters
      </button>
    </Surface>
  );
}
