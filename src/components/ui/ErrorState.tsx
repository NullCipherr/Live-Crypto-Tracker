import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Surface } from './Surface';

interface ErrorStateProps {
  onRetry: () => void;
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <Surface className="p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-negative/10 text-negative">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-semibold text-foreground">Unable to load market data</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        CoinGecko may be rate-limiting requests. Try refreshing in a few seconds.
      </p>
      <button
        onClick={onRetry}
        className="mx-auto mt-6 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
      >
        <RefreshCw className="h-4 w-4" />
        Retry Request
      </button>
    </Surface>
  );
}
