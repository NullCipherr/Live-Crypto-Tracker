import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Columns,
  Download,
  Filter,
  History,
  Pause,
  Play,
  Search,
  SlidersHorizontal,
  Star,
} from 'lucide-react';
import type {
  CoinMarket,
  ColumnConfig,
  MonitorFilters,
  SortField,
  TableSort,
} from '../../types/crypto';
import {
  applyMonitorFilters,
  applyTableSort,
  getMarketStats,
} from '../../lib/market';
import { PageHeader, HeaderButton } from '../shell/PageHeader';
import {
  formatCompactNumber,
  formatPercent,
  formatPrice,
  formatTime,
} from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { CoinSparkline } from '../coins/CoinSparkline';
import { QuickInspector } from '../panels/QuickInspector';
import { cn } from '../../utils/cn';

interface MonitorViewProps {
  coins: CoinMarket[];
  fetchedAt?: number;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  watchlistSet: Set<string>;
  activeCustomList?: { id: string; name: string; coinIds: string[] } | null;
  onClearCustomList?: () => void;
  filters: MonitorFilters;
  columns: ColumnConfig[];
  onChangeFilters: (filters: MonitorFilters) => void;
  onToggleFavorite: (coinId: string) => void;
  onOpenAsset: (coinId: string) => void;
  onCreateAlert: (coinId: string) => void;
  onOpenFilterPanel: () => void;
  onOpenColumnsPanel: () => void;
  onOpenExportModal: () => void;
  onGoToSources: () => void;
  onRetry: () => void;
}

export function MonitorView({
  coins,
  fetchedAt,
  isPending,
  isFetching,
  isError,
  watchlistSet,
  activeCustomList,
  onClearCustomList,
  filters,
  columns,
  onChangeFilters,
  onToggleFavorite,
  onOpenAsset,
  onCreateAlert,
  onOpenFilterPanel,
  onOpenColumnsPanel,
  onOpenExportModal,
  onGoToSources,
  onRetry,
}: MonitorViewProps) {
  const { preferences } = usePreferences();
  const [sort, setSort] = useState<TableSort>({ field: 'marketCap', direction: 'desc' });
  const [tableSearch, setTableSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState<number>(100);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Market Replay state (synchronized over 7d hourly samples)
  const [replayOpen, setReplayOpen] = useState(false);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const maxReplayStep = useMemo(() => {
    const maxLen = coins.reduce((m, c) => Math.max(m, c.sparkline7d.length), 0);
    return Math.max(0, maxLen - 1);
  }, [coins]);
  const [replayStep, setReplayStep] = useState<number>(0);

  useEffect(() => {
    if (!replayOpen || !replayPlaying || maxReplayStep === 0) return;
    const id = window.setInterval(() => {
      setReplayStep((prev) => {
        if (prev >= maxReplayStep) {
          setReplayPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 350);
    return () => window.clearInterval(id);
  }, [maxReplayStep, replayOpen, replayPlaying]);

  const replayCoins = useMemo(() => {
    if (!replayOpen || maxReplayStep === 0) return coins;
    return coins.map((coin) => {
      const series = coin.sparkline7d;
      if (series.length === 0) return coin;
      const idx = Math.min(replayStep, series.length - 1);
      const priceAtStep = series[idx];
      const refIdx = Math.max(0, idx - 24);
      const refPrice = series[refIdx] || priceAtStep;
      const change24hAtStep = refPrice > 0 ? ((priceAtStep - refPrice) / refPrice) * 100 : 0;
      return {
        ...coin,
        currentPrice: priceAtStep,
        priceChange24h: change24hAtStep,
        sparkline7d: series.slice(0, idx + 1),
      };
    });
  }, [coins, maxReplayStep, replayOpen, replayStep]);

  const jumpToBiggestDrop = () => {
    if (coins.length === 0 || maxReplayStep === 0) return;
    let worstStep = 0;
    let worstAvg = Infinity;
    for (let step = 24; step <= maxReplayStep; step++) {
      let sum = 0;
      let cnt = 0;
      for (const c of coins) {
        if (c.sparkline7d.length > step) {
          const p = c.sparkline7d[step];
          const ref = c.sparkline7d[step - 24] || p;
          if (ref > 0) {
            sum += ((p - ref) / ref) * 100;
            cnt++;
          }
        }
      }
      const avg = cnt > 0 ? sum / cnt : 0;
      if (avg < worstAvg) {
        worstAvg = avg;
        worstStep = step;
      }
    }
    setReplayPlaying(false);
    setReplayStep(worstStep);
  };

  // Order-lock state: prevent rows from jumping under the user's cursor on background refresh
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const scopedCoins = useMemo(() => {
    if (!activeCustomList) return replayCoins;
    const set = new Set(activeCustomList.coinIds);
    return replayCoins.filter((c) => set.has(c.id));
  }, [activeCustomList, replayCoins]);

  const filteredCoins = useMemo(
    () => applyMonitorFilters(scopedCoins, filters, watchlistSet, tableSearch),
    [filters, scopedCoins, tableSearch, watchlistSet]
  );

  const sortedCoins = useMemo(() => applyTableSort(filteredCoins, sort), [filteredCoins, sort]);

  const pendingOrderUpdate = useMemo(() => {
    if (!frozenOrder) return false;
    const currentIds = sortedCoins.map((c) => c.id);
    return (
      currentIds.length !== frozenOrder.length ||
      currentIds.some((id, idx) => id !== frozenOrder[idx])
    );
  }, [frozenOrder, sortedCoins]);

  const selectCoin = (coinId: string, openInspector?: boolean) => {
    setSelectedId(coinId);
    if (!frozenOrder && sortedCoins.length > 0) {
      setFrozenOrder(sortedCoins.map((c) => c.id));
    }
    if (openInspector !== undefined) {
      setInspectorOpen(openInspector);
    }
  };

  const displayedCoins = useMemo(() => {
    if (!frozenOrder) return sortedCoins;
    const map = new Map(sortedCoins.map((c) => [c.id, c]));
    const ordered: CoinMarket[] = [];
    for (const id of frozenOrder) {
      const coin = map.get(id);
      if (coin) {
        ordered.push(coin);
        map.delete(id);
      }
    }
    for (const remaining of map.values()) {
      ordered.push(remaining);
    }
    return ordered;
  }, [frozenOrder, sortedCoins]);

  const stats = useMemo(() => getMarketStats(coins), [coins]);
  const selectedCoin = useMemo(
    () => displayedCoins.find((c) => c.id === selectedId) ?? null,
    [displayedCoins, selectedId]
  );

  const visibleColumns = useMemo(() => {
    const base = columns.filter((c) => c.visible);
    if (!inspectorOpen) return base;
    // When inspector is open, sparkline and marketCap yield space first
    return base.filter((c) => c.id !== 'sparkline');
  }, [columns, inspectorOpen]);

  const handleSortClick = (field: SortField) => {
    setFrozenOrder(null);
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === 'desc' ? 'asc' : 'desc' }
        : { field, direction: field === 'name' || field === 'rank' ? 'asc' : 'desc' }
    );
  };

  const applyNewOrder = () => {
    setFrozenOrder(sortedCoins.map((c) => c.id));
  };

  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    if (displayedCoins.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = displayedCoins.findIndex((c) => c.id === selectedId);
      const next = displayedCoins[Math.min(displayedCoins.length - 1, idx + 1)] ?? displayedCoins[0];
      selectCoin(next.id);
      rowRefs.current.get(next.id)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = displayedCoins.findIndex((c) => c.id === selectedId);
      const prev = displayedCoins[Math.max(0, idx <= 0 ? 0 : idx - 1)] ?? displayedCoins[0];
      selectCoin(prev.id);
      rowRefs.current.get(prev.id)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === ' ' && selectedId) {
      e.preventDefault();
      setInspectorOpen((prev) => !prev);
    } else if (e.key === 'Enter' && selectedId) {
      e.preventDefault();
      onOpenAsset(selectedId);
    } else if (e.key === 'Escape' && inspectorOpen) {
      e.preventDefault();
      setInspectorOpen(false);
      setFrozenOrder(null);
      if (selectedId) {
        rowRefs.current.get(selectedId)?.focus();
      }
    }
  };

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const rowHeightClass = preferences.density === 'compact' ? 'h-[34px]' : 'h-[42px]';
  const activeFilterCount =
    (filters.universe !== 'all' ? 1 : 0) +
    (filters.direction !== 'all' ? 1 : 0) +
    (filters.minMarketCap ? 1 : 0) +
    (filters.minVolume ? 1 : 0) +
    (filters.excludeStablecoins ? 1 : 0);

  const sortLabelMap: Record<SortField, string> = {
    rank: 'posição',
    name: 'nome',
    price: 'preço',
    change24h: 'variação 24h',
    marketCap: 'capitalização',
    volume: 'volume 24h',
  };

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Market Summary Strip */}
        <PageHeader
          title="Monitor de mercado"
          actions={
            <>
              <span className="font-mono text-muted-foreground">USD</span>
              <HeaderButton
                onClick={onOpenColumnsPanel}
                title="Abrir painel de visualização e colunas"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Visualizar</span>
              </HeaderButton>
            </>
          }
        />

        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/80 bg-background/95 px-5 py-2.5 text-xs tabular-nums text-muted-foreground lg:px-6">
          <span>{stats.totalCoins} ativos acompanhados</span>
          <span aria-hidden="true" className="text-border">·</span>
          <span>
            Cap. <span className="font-medium text-foreground">US$ {formatCompactNumber(stats.totalMarketCap, preferences.numberLocale)}</span>
          </span>
          <span aria-hidden="true" className="text-border">·</span>
          <span>
            Volume 24h <span className="font-medium text-foreground">US$ {formatCompactNumber(stats.totalVolume, preferences.numberLocale)}</span>
          </span>
          <span aria-hidden="true" className="hidden text-border sm:inline">
            |
          </span>
          <span className="inline-flex items-center rounded-md bg-positive/10 px-1.5 py-0.5 font-medium text-positive">
            {stats.positiveCount} em alta
          </span>
          <span className="inline-flex items-center rounded-md bg-negative/10 px-1.5 py-0.5 font-medium text-negative">
            {stats.negativeCount} em queda
          </span>
          <span>
            Média <span className="font-mono font-medium text-foreground">{formatPercent(stats.avgChange24h, preferences.numberLocale)}</span>
          </span>
        </div>

        {/* Table Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-nav/70 px-5 py-2.5 text-xs lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {activeCustomList ? (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-accent/60 bg-accent/15 px-3 font-medium text-accent shadow-card">
                <span>Lista: {activeCustomList.name}</span>
                {onClearCustomList ? (
                  <button
                    type="button"
                    onClick={onClearCustomList}
                    aria-label="Sair da lista personalizada"
                    className="hover:text-foreground"
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ) : (
              <select
                aria-label="Universo de ativos"
                value={filters.universe}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    universe: e.target.value as 'all' | 'favorites',
                  })
                }
                className="h-8 rounded-lg border border-border/80 bg-card/85 pl-3 pr-8 text-xs font-medium text-foreground shadow-card outline-none transition-all hover:border-accent/50 hover:bg-card focus:border-accent"
              >
                <option value="all">Todos os ativos</option>
                <option value="favorites">Favoritos ({watchlistSet.size})</option>
              </select>
            )}

            <button
              type="button"
              onClick={onOpenFilterPanel}
              className={cn(
                'group inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                activeFilterCount > 0
                  ? 'border-accent/60 bg-accent/15 text-accent'
                  : 'border-border/80 bg-card/85 text-muted-foreground hover:border-accent/50 hover:bg-card hover:text-foreground'
              )}
            >
              <Filter
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  activeFilterCount > 0 ? 'text-accent' : 'text-muted-foreground group-hover:text-accent'
                )}
                aria-hidden="true"
              />
              <span>Filtrar{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
            </button>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Filtrar tabela..."
                aria-label="Filtrar ativos na tabela"
                className="h-8 w-40 rounded-lg border border-border/80 bg-card/85 pl-8 pr-2.5 text-xs text-foreground shadow-card outline-none transition-all placeholder:text-muted-foreground hover:border-accent/50 focus:border-accent focus:bg-card sm:w-48"
              />
            </div>

            {activeFilterCount > 0 || tableSearch ? (
              <button
                type="button"
                onClick={() => {
                  onChangeFilters({
                    universe: 'all',
                    direction: 'all',
                    minMarketCap: '',
                    minVolume: '',
                    excludeStablecoins: false,
                  });
                  setTableSearch('');
                }}
                className="h-8 rounded-lg px-2.5 text-[11px] font-medium text-accent hover:bg-accent/10"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setReplayOpen((prev) => {
                  const next = !prev;
                  if (next && replayStep === 0) setReplayStep(maxReplayStep);
                  if (!next) setReplayPlaying(false);
                  return next;
                });
              }}
              aria-pressed={replayOpen}
              className={cn(
                'group inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                replayOpen
                  ? 'border-accent/60 bg-accent/15 text-accent'
                  : 'border-border/80 bg-card/85 text-muted-foreground hover:border-accent/50 hover:bg-card hover:text-foreground'
              )}
            >
              <History
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  replayOpen ? 'text-accent' : 'text-muted-foreground group-hover:text-accent'
                )}
                aria-hidden="true"
              />
              <span>Replay</span>
            </button>
            <button
              type="button"
              onClick={onOpenColumnsPanel}
              className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card/85 px-3 text-xs font-medium text-muted-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Columns
                className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-accent"
                aria-hidden="true"
              />
              <span>Colunas</span>
            </button>
            <button
              type="button"
              onClick={onOpenExportModal}
              className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card/85 px-3 text-xs font-medium text-muted-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Download
                className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-accent"
                aria-hidden="true"
              />
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* Market Replay Bar */}
        {replayOpen && maxReplayStep > 0 ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-accent/30 bg-card px-5 py-2 text-xs lg:px-6">
            <div className="flex items-center gap-2">
              <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-accent">
                REPLAY
              </span>
              <span className="font-mono tabular-nums text-foreground">
                Amostra {replayStep + 1} / {maxReplayStep + 1} (janela 7d)
              </span>
            </div>

            <div className="flex flex-1 items-center gap-2 max-w-xl">
              <button
                type="button"
                onClick={() => {
                  setReplayPlaying(false);
                  setReplayStep((p) => Math.max(0, p - 1));
                }}
                disabled={replayStep <= 0}
                aria-label="Amostra anterior"
                className="inline-flex h-7 items-center rounded border border-border bg-background px-2 text-foreground hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (replayStep >= maxReplayStep) setReplayStep(0);
                  setReplayPlaying((p) => !p);
                }}
                className="inline-flex h-7 items-center gap-1 rounded bg-accent px-2.5 font-semibold text-accent-foreground hover:opacity-90"
              >
                {replayPlaying ? (
                  <>
                    <Pause className="h-3 w-3" aria-hidden="true" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" aria-hidden="true" />
                    <span>Reproduzir</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplayPlaying(false);
                  setReplayStep((p) => Math.min(maxReplayStep, p + 1));
                }}
                disabled={replayStep >= maxReplayStep}
                aria-label="Próxima amostra"
                className="inline-flex h-7 items-center rounded border border-border bg-background px-2 text-foreground hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              <input
                type="range"
                min={0}
                max={maxReplayStep}
                value={replayStep}
                onChange={(e) => {
                  setReplayPlaying(false);
                  setReplayStep(Number(e.target.value));
                }}
                aria-label="Linha do tempo do replay"
                className="flex-1 accent-accent"
              />

              <button
                type="button"
                onClick={jumpToBiggestDrop}
                className="h-7 shrink-0 rounded border border-border bg-background px-2.5 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                Ir à maior queda
              </button>
            </div>
          </div>
        ) : null}

        {/* Status / Order-lock banners */}
        {isError && coins.length > 0 ? (
          <div
            role="status"
            className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-xs text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              <span>
                Dados das {formatTime(fetchedAt, preferences.timezone)}. Falha ao atualizar cotações.
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="rounded border border-border bg-card px-2 py-0.5 text-[11px] font-medium hover:bg-muted"
              >
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={onGoToSources}
                className="text-[11px] font-medium text-accent hover:underline"
              >
                Ver fonte
              </button>
            </div>
          </div>
        ) : null}

        {pendingOrderUpdate ? (
          <div
            role="status"
            className="flex shrink-0 items-center justify-between gap-2 border-b border-accent/30 bg-accent/10 px-4 py-1.5 text-xs text-foreground"
          >
            <span>Cotações atualizadas — o ranking mudou desde a sua seleção.</span>
            <button
              type="button"
              onClick={applyNewOrder}
              className="rounded bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-foreground hover:opacity-90"
            >
              Aplicar nova ordem
            </button>
          </div>
        ) : null}

        {/* Table Workspace */}
        <div
          className="flex-1 overflow-auto outline-none"
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
          aria-label="Tabela de ativos de mercado"
        >
          {isPending ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex h-[34px] items-center justify-between px-4 animate-pulse">
                  <div className="h-3 w-40 rounded bg-muted" />
                  <div className="h-3 w-20 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                  <div className="hidden h-3 w-24 rounded bg-muted sm:block" />
                </div>
              ))}
            </div>
          ) : isError && coins.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 px-4 text-center">
              <AlertTriangle className="h-6 w-6 text-warning" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">
                Não foi possível carregar as cotações.
              </p>
              <p className="text-xs text-muted-foreground">
                A CoinGecko pode estar limitando requisições no momento.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="h-8 rounded bg-accent px-3 text-xs font-semibold text-accent-foreground hover:opacity-90"
                >
                  Tentar novamente
                </button>
                <button
                  type="button"
                  onClick={onGoToSources}
                  className="h-8 rounded border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Ver fonte
                </button>
              </div>
            </div>
          ) : displayedCoins.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="text-sm font-medium text-foreground">
                Nenhum ativo atende aos critérios atuais.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenFilterPanel}
                  className="h-8 rounded border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Revisar filtros
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeFilters({
                      universe: 'all',
                      direction: 'all',
                      minMarketCap: '',
                      minVolume: '',
                      excludeStablecoins: false,
                    });
                    setTableSearch('');
                  }}
                  className="h-8 rounded bg-accent px-3 text-xs font-semibold text-accent-foreground hover:opacity-90"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-border bg-nav text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 py-2 pl-5 pr-2 text-left lg:pl-6">
                    <span className="sr-only">Favorito</span>
                  </th>
                  {visibleColumns.map((col) => {
                    const sortableField: SortField | null =
                      col.id === 'rank'
                        ? 'rank'
                        : col.id === 'asset'
                          ? 'name'
                          : col.id === 'price'
                            ? 'price'
                            : col.id === 'change24h'
                              ? 'change24h'
                              : col.id === 'marketCap'
                                ? 'marketCap'
                                : col.id === 'volume'
                                  ? 'volume'
                                  : null;

                    const isRight =
                      col.id === 'price' ||
                      col.id === 'change24h' ||
                      col.id === 'marketCap' ||
                      col.id === 'volume' ||
                      col.id === 'sparkline';

                    const activeSort = sortableField && sort.field === sortableField;

                    return (
                      <th
                        key={col.id}
                        className={cn(
                          'whitespace-nowrap px-3 py-2',
                          col.id === 'rank' && 'w-10 text-right',
                          isRight && 'text-right',
                          (col.id === 'marketCap' || col.id === 'volume') && 'hidden md:table-cell',
                          col.id === 'sparkline' && 'hidden pr-5 lg:table-cell lg:pr-6'
                        )}
                      >
                        {sortableField ? (
                          <button
                            type="button"
                            onClick={() => handleSortClick(sortableField)}
                            className={cn(
                              'inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:text-accent',
                              activeSort && 'text-accent'
                            )}
                          >
                            <span>{col.label}</span>
                            {activeSort ? (
                              sort.direction === 'desc' ? (
                                <ArrowDown className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <ArrowUp className="h-3 w-3" aria-hidden="true" />
                              )
                            ) : null}
                          </button>
                        ) : (
                          col.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {(tableSearch.trim() ? displayedCoins : displayedCoins.slice(0, visibleLimit)).map((coin) => {
                  const isSelected = coin.id === selectedId;
                  const isFav = watchlistSet.has(coin.id);
                  const isPos = coin.priceChange24h > 0;
                  const isNeg = coin.priceChange24h < 0;

                  return (
                    <tr
                      key={coin.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(coin.id, el);
                        else rowRefs.current.delete(coin.id);
                      }}
                      tabIndex={-1}
                      onClick={() => selectCoin(coin.id, true)}
                      onDoubleClick={() => onOpenAsset(coin.id)}
                      aria-selected={isSelected}
                      className={cn(
                        rowHeightClass,
                        'cursor-pointer transition-colors focus-visible:outline-none',
                        isSelected
                          ? 'bg-accent/10 hover:bg-accent/15'
                          : 'hover:bg-muted/40'
                      )}
                    >
                      <td
                        className="pl-5 pr-2 text-left lg:pl-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(coin.id);
                        }}
                      >
                        <button
                          type="button"
                          aria-label={isFav ? `Remover ${coin.name} dos favoritos` : `Favoritar ${coin.name}`}
                          aria-pressed={isFav}
                          className={cn(
                            'inline-flex h-6 w-5 items-center justify-start rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                            isFav ? 'text-accent' : 'text-muted-foreground/50 hover:text-foreground'
                          )}
                        >
                          <Star className={cn('h-3.5 w-3.5', isFav && 'fill-current')} aria-hidden="true" />
                        </button>
                      </td>

                      {visibleColumns.map((col) => {
                        switch (col.id) {
                          case 'rank':
                            return (
                              <td
                                key={col.id}
                                className="px-3 text-right font-mono text-[11px] tabular-nums text-muted-foreground"
                              >
                                {coin.marketCapRank || '--'}
                              </td>
                            );
                          case 'asset':
                            return (
                              <td key={col.id} className="px-3">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={coin.image}
                                    alt=""
                                    width={20}
                                    height={20}
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                    className="h-5 w-5 shrink-0 rounded-full border border-border bg-background"
                                  />
                                  <span className="truncate font-medium text-foreground">
                                    {coin.name}
                                  </span>
                                  <span className="font-mono text-[11px] uppercase text-muted-foreground">
                                    {coin.symbol}
                                  </span>
                                </div>
                              </td>
                            );
                          case 'price':
                            return (
                              <td
                                key={col.id}
                                className="whitespace-nowrap px-3 text-right font-medium tabular-nums text-foreground"
                              >
                                {formatPrice(coin.currentPrice, fmtOpts)}
                              </td>
                            );
                          case 'change24h':
                            return (
                              <td
                                key={col.id}
                                className={cn(
                                  'whitespace-nowrap px-3 text-right font-medium tabular-nums',
                                  isPos
                                    ? 'text-positive'
                                    : isNeg
                                      ? 'text-negative'
                                      : 'text-muted-foreground'
                                )}
                              >
                                {formatPercent(coin.priceChange24h, preferences.numberLocale)}
                              </td>
                            );
                          case 'marketCap':
                            return (
                              <td
                                key={col.id}
                                className="hidden whitespace-nowrap px-3 text-right tabular-nums text-muted-foreground md:table-cell"
                              >
                                {formatCompactNumber(coin.marketCap, preferences.numberLocale)}
                              </td>
                            );
                          case 'volume':
                            return (
                              <td
                                key={col.id}
                                className="hidden whitespace-nowrap px-3 text-right tabular-nums text-muted-foreground md:table-cell"
                              >
                                {formatCompactNumber(coin.totalVolume, preferences.numberLocale)}
                              </td>
                            );
                          case 'sparkline':
                            return (
                              <td key={col.id} className="hidden pl-3 pr-5 text-right lg:table-cell lg:pr-6">
                                <div className="inline-flex justify-end">
                                  <CoinSparkline data={coin.sparkline7d} />
                                </div>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer */}
        <footer className="flex min-h-[40px] shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-nav/90 px-5 py-1.5 text-[11px] leading-none tabular-nums text-muted-foreground lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              <span className="font-medium text-foreground">
                {Math.min(
                  tableSearch.trim() ? displayedCoins.length : visibleLimit,
                  displayedCoins.length
                )}
              </span>{' '}
              de {displayedCoins.length} ativos{' '}
              <span className="text-muted-foreground/75">({coins.length} carregados)</span>
              {isFetching ? (
                <span className="ml-1.5 text-accent">· Atualizando...</span>
              ) : null}
            </span>

            {!tableSearch.trim() && displayedCoins.length > 50 ? (
              <>
                <span className="hidden h-3.5 w-px bg-border sm:inline-block" aria-hidden="true" />
                <div className="hidden items-center gap-2 sm:inline-flex">
                  <span className="text-muted-foreground/80">Exibir</span>
                  <div className="inline-flex h-6 items-center rounded-lg border border-border/80 bg-card/85 p-0.5 shadow-card">
                    {([50, 100, 250, 500, 1000] as const).map((lim) => (
                      <button
                        key={lim}
                        type="button"
                        onClick={() => setVisibleLimit(lim)}
                        className={cn(
                          'inline-flex h-full items-center rounded-md px-2 font-mono text-[10.5px] font-medium transition-colors',
                          visibleLimit === lim
                            ? 'bg-accent text-accent-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {lim}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground/80">Ordenado por</span>
            <span className="rounded-md border border-border/70 bg-card/70 px-2 py-1 font-medium text-foreground">
              {sortLabelMap[sort.field]} {sort.direction === 'desc' ? '↓' : '↑'}
            </span>
          </div>
        </footer>
      </div>

      {/* Right-hand Quick Inspector (Overlay Drawer — no table reflow or scrollbar jump) */}
      {inspectorOpen && selectedCoin ? (
        <div className="fixed inset-0 z-40 flex justify-end overflow-hidden bg-black/50 lg:pointer-events-none lg:absolute lg:inset-y-0 lg:right-0 lg:left-auto lg:bg-transparent lg:pl-8">
          <div className="pointer-events-auto h-full w-full lg:w-auto">
            <QuickInspector
              coin={selectedCoin}
              favorite={watchlistSet.has(selectedCoin.id)}
              fetchedAt={fetchedAt}
              onToggleFavorite={onToggleFavorite}
              onCreateAlert={onCreateAlert}
              onOpenAsset={onOpenAsset}
              onClose={() => {
                setInspectorOpen(false);
                setFrozenOrder(null);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
