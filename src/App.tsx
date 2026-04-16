import { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { DashboardHeader } from './components/layout/DashboardHeader';
import { SummaryStrip } from './components/dashboard/SummaryStrip';
import { TopMovers } from './components/dashboard/TopMovers';
import { MarketOverview } from './components/dashboard/MarketOverview';
import { StatusPanel } from './components/dashboard/StatusPanel';
import { CoinTable } from './components/coins/CoinTable';
import { LoadingSkeleton } from './components/ui/LoadingSkeleton';
import { ErrorState } from './components/ui/ErrorState';
import { EmptyState } from './components/ui/EmptyState';
import { Surface } from './components/ui/Surface';
import { useCryptoMarket } from './hooks/useCryptoMarket';
import { useWatchlist } from './hooks/useWatchlist';
import { applySort, getMarketStats, getMomentumCoin, getTopGainer, getTopLoser } from './lib/market';
import type { SortOption } from './types/crypto';

function App() {
  const { data, isPending, isError, isFetching, refetch } = useCryptoMarket();
  const { watchlistSet, toggleWatchlist } = useWatchlist();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('market-cap-desc');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const coins = useMemo(() => data?.coins ?? [], [data?.coins]);

  const filteredCoins = useMemo(() => {
    const query = search.toLowerCase().trim();

    const bySearch = query
      ? coins.filter(
          (coin) =>
            coin.name.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query)
        )
      : coins;

    const byFavorite = favoritesOnly
      ? bySearch.filter((coin) => watchlistSet.has(coin.id))
      : bySearch;

    return applySort(byFavorite, sort);
  }, [coins, favoritesOnly, search, sort, watchlistSet]);

  const marketStats = useMemo(() => getMarketStats(coins), [coins]);
  const topGainer = useMemo(() => getTopGainer(coins), [coins]);
  const topLoser = useMemo(() => getTopLoser(coins), [coins]);
  const momentum = useMemo(() => getMomentumCoin(coins), [coins]);

  const resetFilters = () => {
    setSearch('');
    setFavoritesOnly(false);
    setSort('market-cap-desc');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-5%] h-80 w-80 rounded-full bg-positive/10 blur-3xl" />
      </div>

      <DashboardHeader
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => refetch()}
        isFetching={isFetching}
        fetchedAt={data?.fetchedAt}
      />

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SummaryStrip stats={marketStats} topGainer={topGainer} />

        <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr_1fr]">
          <TopMovers gainer={topGainer} loser={topLoser} momentum={momentum} />
          <MarketOverview stats={marketStats} />
          <StatusPanel
            fetchedAt={data?.fetchedAt}
            isError={isError}
            isFetching={isFetching}
            shownCoins={filteredCoins.length}
            latencyMs={data?.latencyMs}
          />
        </section>

        <Surface className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Market Monitor</h2>
              <p className="text-sm text-muted-foreground">
                Real-time watchlist with expanded analytics and trend context.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFavoritesOnly((prev) => !prev)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  favoritesOnly
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                Favorites Only
              </button>

              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortOption)}
                  className="bg-transparent text-sm text-foreground outline-none"
                >
                  <option value="market-cap-desc">Market Cap (High to Low)</option>
                  <option value="market-cap-asc">Market Cap (Low to High)</option>
                  <option value="top-gainers">Top Gainers</option>
                  <option value="top-losers">Top Losers</option>
                  <option value="alphabetical">Alphabetical</option>
                </select>
              </div>
            </div>
          </div>
        </Surface>

        {isPending ? <LoadingSkeleton /> : null}
        {isError ? <ErrorState onRetry={() => refetch()} /> : null}
        {!isPending && !isError && filteredCoins.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : null}
        {!isPending && !isError && filteredCoins.length > 0 ? (
          <CoinTable coins={filteredCoins} watchlistSet={watchlistSet} onToggleFavorite={toggleWatchlist} />
        ) : null}
      </main>
    </div>
  );
}

export default App;
