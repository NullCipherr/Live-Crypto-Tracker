import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import type {
  CoinMarket,
  ColumnConfig,
  MonitorFilters,
  NavRoute,
  ResearchContextSnapshot,
} from './types/crypto';
import { useCryptoMarket } from './hooks/useCryptoMarket';
import { useWatchlist } from './hooks/useWatchlist';
import { useCustomLists } from './hooks/useLists';
import { useAlerts } from './hooks/useAlerts';
import { usePreferences } from './hooks/usePreferences';
import { applyMonitorFilters } from './lib/market';
import { TopBar } from './components/shell/TopBar';
import { Sidebar } from './components/shell/Sidebar';
import { PageHeaderProvider, PageHeaderShell } from './components/shell/PageHeader';
import { ViewErrorBoundary } from './components/shell/ViewErrorBoundary';
import { MonitorView } from './components/views/MonitorView';
import { HomeView } from './components/views/HomeView';
import { HeatmapView } from './components/views/HeatmapView';
import { ListsView } from './components/views/ListsView';
import { AlertsView } from './components/views/AlertsView';
import { ScreenerView } from './components/views/ScreenerView';
import { ConverterView } from './components/views/ConverterView';
import { DcaSimulatorView } from './components/views/DcaSimulatorView';
import { PositionCalculatorView } from './components/views/PositionCalculatorView';
import { SourcesView } from './components/views/SourcesView';
import { PreferencesView } from './components/views/PreferencesView';
import { CommandPalette } from './components/panels/CommandPalette';
import { FilterPanel } from './components/panels/FilterPanel';
import { ColumnsPanel } from './components/panels/ColumnsPanel';
import { ExportCsvModal } from './components/panels/ExportCsvModal';
import { AlertRuleModal } from './components/panels/AlertRuleModal';
import { DEFAULT_COLUMNS, DEFAULT_MONITOR_FILTERS } from './lib/defaults';
import type { AlertRule } from './types/crypto';

import { AssetView } from './components/views/AssetView';
import { ComparatorView } from './components/views/ComparatorView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { ReportsView } from './components/views/ReportsView';
import { TvModeView } from './components/views/TvModeView';
import { ResearchView } from './components/views/ResearchView';
import { MarketPulseDashboard } from './components/views/MarketPulseDashboard';
import { QuantRadarDashboard } from './components/views/QuantRadarDashboard';

const ROUTE_HEADER_TITLES: Partial<Record<NavRoute, string>> = {
  home: 'Home',
  monitor: 'Monitor de mercado',
  heatmap: 'Mapa de mercado',
  pulse: 'Pulso de mercado',
  quant: 'Radar Quant',
  analytics: 'Analytics',
  lists: 'Minhas listas',
  alerts: 'Alertas',
  screener: 'Screener',
  comparator: 'Comparador',
  converter: 'Conversor',
  dca: 'Simulador DCA',
  position: 'Risco & Posição',
  reports: 'Relatórios',
  sources: 'Fontes de dados',
  preferences: 'Preferências',
};

const COLUMNS_STORAGE_KEY = 'lct-columns-v1';
const NAV_STORAGE_KEY = 'lct-nav-state-v1';

const VALID_NAV_ROUTES = new Set<NavRoute>([
  'home',
  'monitor',
  'heatmap',
  'pulse',
  'analytics',
  'quant',
  'reports',
  'tv',
  'lists',
  'alerts',
  'screener',
  'comparator',
  'converter',
  'dca',
  'position',
  'research',
  'asset',
  'sources',
  'preferences',
]);

function parseHashNav(): { route: NavRoute; activeAssetId: string | null } | null {
  if (typeof window === 'undefined') return null;
  const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
  if (!rawHash) return null;
  const [segment, param] = rawHash.split('/');
  if (!VALID_NAV_ROUTES.has(segment as NavRoute)) return null;
  const route = segment as NavRoute;
  if (route === 'asset') {
    if (!param) return null;
    return { route: 'asset', activeAssetId: decodeURIComponent(param) };
  }
  return { route, activeAssetId: null };
}

function readInitialNavState(): { route: NavRoute; activeAssetId: string | null } {
  const fromHash = parseHashNav();
  if (fromHash) return fromHash;
  try {
    const raw = sessionStorage.getItem(NAV_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { route?: string; activeAssetId?: string | null };
      if (parsed.route && VALID_NAV_ROUTES.has(parsed.route as NavRoute)) {
        if (parsed.route === 'asset' && !parsed.activeAssetId) {
          return { route: 'monitor', activeAssetId: null };
        }
        return {
          route: parsed.route as NavRoute,
          activeAssetId: parsed.activeAssetId ?? null,
        };
      }
    }
  } catch {
    // Ignore storage errors
  }
  return { route: 'home', activeAssetId: null };
}

function readColumns(): ColumnConfig[] {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw) as ColumnConfig[];
    return Array.isArray(parsed) && parsed.length === DEFAULT_COLUMNS.length
      ? parsed
      : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

export function App() {
  const { data, isPending, isFetching, isError, refetch } = useCryptoMarket();
  const { watchlist, watchlistSet, toggleWatchlist } = useWatchlist();
  const { customLists, createList, updateList, deleteList, moveCoinInList } = useCustomLists();
  const { preferences, updatePreferences } = usePreferences();

  const [initialNav] = useState(() => readInitialNavState());
  const [route, setRoute] = useState<NavRoute>(initialNav.route);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(initialNav.activeAssetId);
  const [activeCustomListId, setActiveCustomListId] = useState<string | null>(null);
  const [compareSeedIds, setCompareSeedIds] = useState<string[] | undefined>(undefined);
  const [reportContext, setReportContext] = useState<{
    tickers?: string[];
    days?: '7' | '30' | '90' | '365';
  }>({});
  const [researchSeedContext, setResearchSeedContext] =
    useState<ResearchContextSnapshot | null>(null);
  const [researchReturnRoute, setResearchReturnRoute] = useState<NavRoute>('monitor');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [filters, setFilters] = useState<MonitorFilters>(DEFAULT_MONITOR_FILTERS);
  const [columns, setColumns] = useState<ColumnConfig[]>(() => readColumns());

  const [commandOpen, setCommandOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
  const [exportCoinsOverride, setExportCoinsOverride] = useState<CoinMarket[] | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [alertModalState, setAlertModalState] = useState<{
    open: boolean;
    editing?: AlertRule | null;
    coinId?: string;
  }>({ open: false });

  useEffect(() => {
    try {
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
    } catch {
      // Ignore storage errors
    }
  }, [columns]);

  // Persist current route & active asset across Ctrl+F5 / reloads and sync URL hash
  useEffect(() => {
    try {
      sessionStorage.setItem(
        NAV_STORAGE_KEY,
        JSON.stringify({ route, activeAssetId })
      );
    } catch {
      // Ignore storage errors
    }
    const targetHash =
      route === 'asset' && activeAssetId
        ? `#/asset/${encodeURIComponent(activeAssetId)}`
        : `#/${route}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  }, [route, activeAssetId]);

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHashNav();
      if (!parsed) return;
      setRoute(parsed.route);
      if (parsed.activeAssetId) setActiveAssetId(parsed.activeAssetId);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const coins = useMemo(() => data?.coins ?? [], [data?.coins]);
  const { rules: alertRules, events: alertEvents, createRule, updateRule, deleteRule } = useAlerts(
    coins,
    data?.fetchedAt
  );
  const activeCustomList = useMemo(
    () => customLists.find((l) => l.id === activeCustomListId) ?? null,
    [activeCustomListId, customLists]
  );

  const filteredForExport = useMemo(
    () => applyMonitorFilters(coins, filters, watchlistSet),
    [coins, filters, watchlistSet]
  );

  const activeAsset = useMemo(
    () => coins.find((c) => c.id === activeAssetId) ?? null,
    [activeAssetId, coins]
  );

  const [hasNavigated, setHasNavigated] = useState(false);

  const shouldReduceMotion =
    preferences.reduceMotion === 'reduce' ||
    (preferences.reduceMotion === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const navigateTo = useCallback(
    (nextRoute: NavRoute, beforeNavigate?: () => void) => {
      if (nextRoute === route && !beforeNavigate) return;

      const docWithTransition = document as Document & {
        startViewTransition?: (cb: () => void) => void;
      };

      const apply = () => {
        beforeNavigate?.();
        setHasNavigated(true);
        setRoute(nextRoute);
      };

      if (shouldReduceMotion || typeof docWithTransition.startViewTransition !== 'function') {
        apply();
        return;
      }

      docWithTransition.startViewTransition(() => {
        flushSync(apply);
      });
    },
    [route, shouldReduceMotion]
  );

  const handleOpenAsset = (coinId: string) => {
    navigateTo('asset', () => setActiveAssetId(coinId));
  };

  const handleOpenListInMonitor = (listId: 'favorites' | string) => {
    navigateTo('monitor', () => {
      if (listId === 'favorites') {
        setActiveCustomListId(null);
        setFilters((prev) => ({ ...prev, universe: 'favorites' }));
      } else {
        setActiveCustomListId(listId);
        setFilters((prev) => ({ ...prev, universe: 'all' }));
      }
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {route === 'tv' ? (
        <TvModeView
          coins={coins}
          watchlist={watchlist}
          fetchedAt={data?.fetchedAt}
          isError={isError}
          onExit={() => navigateTo('analytics')}
        />
      ) : route === 'research' ? (
        <ResearchView
          liveCoins={coins}
          liveFetchedAt={data?.fetchedAt}
          initialContext={researchSeedContext}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onExit={() => navigateTo(researchReturnRoute)}
          onCompareCoins={(ids) => {
            navigateTo('comparator', () => setCompareSeedIds(ids));
          }}
          onOpenReportWithContext={(coinIds) => {
            const tickers = coinIds
              .map((id) => coins.find((c) => c.id === id)?.symbol.toUpperCase())
              .filter((s): s is string => Boolean(s));
            navigateTo('reports', () => setReportContext({ tickers, days: '7' }));
          }}
          onOpenAnalytics={() => navigateTo('analytics')}
        />
      ) : (
        <>
          <Sidebar
            activeRoute={route}
            collapsed={sidebarCollapsed}
            mobileOpen={mobileMenuOpen}
            onSelectRoute={(next) => {
              if (next === 'research') {
                setResearchReturnRoute(route);
                setResearchSeedContext(null);
              }
              navigateTo(next);
            }}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            onCloseMobile={() => setMobileMenuOpen(false)}
            onGoHome={() => navigateTo('home')}
            onOpenCommandPalette={() => setCommandOpen(true)}
          />

          <PageHeaderProvider>
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <TopBar
                showTvMode={route === 'analytics'}
                onOpenMobileMenu={() => setMobileMenuOpen(true)}
                onOpenTvMode={() => navigateTo('tv')}
                onGoHome={() => navigateTo('home')}
              />

              <PageHeaderShell
                fallbackTitle={ROUTE_HEADER_TITLES[route]}
              />

              <main
                className="flex min-w-0 flex-1 overflow-hidden bg-background"
                style={{ viewTransitionName: 'main-page' }}
              >
                <div
                  key={route}
                  className={
                    hasNavigated && !shouldReduceMotion
                      ? 'flex min-w-0 flex-1 overflow-hidden animate-page-enter'
                      : 'flex min-w-0 flex-1 overflow-hidden'
                  }
                >
                  <ViewErrorBoundary key={route}>
              {route === 'home' ? (
                <HomeView
                  coins={coins}
                  watchlistSet={watchlistSet}
                  onToggleFavorite={toggleWatchlist}
                  onOpenAsset={handleOpenAsset}
                  onNavigate={(next) => navigateTo(next)}
                />
              ) : route === 'monitor' ? (
                <MonitorView
                  coins={coins}
                  fetchedAt={data?.fetchedAt}
                  isPending={isPending}
                  isFetching={isFetching}
                  isError={isError}
                  watchlistSet={watchlistSet}
                  activeCustomList={activeCustomList}
                  onClearCustomList={() => setActiveCustomListId(null)}
                  filters={filters}
                  columns={columns}
                  onChangeFilters={setFilters}
                  onToggleFavorite={toggleWatchlist}
                  onOpenAsset={handleOpenAsset}
                  onCreateAlert={(coinId) => setAlertModalState({ open: true, editing: null, coinId })}
                  onOpenFilterPanel={() => setFilterPanelOpen(true)}
                  onOpenColumnsPanel={() => setColumnsPanelOpen(true)}
                  onOpenExportModal={() => {
                    setExportCoinsOverride(null);
                    setExportOpen(true);
                  }}
                  onGoToSources={() => navigateTo('sources')}
                  onRetry={() => refetch()}
                />
              ) : route === 'heatmap' ? (
                <HeatmapView
                  coins={coins}
                  fetchedAt={data?.fetchedAt}
                  watchlistSet={watchlistSet}
                  customLists={customLists}
                  onToggleFavorite={toggleWatchlist}
                  onOpenAsset={handleOpenAsset}
                />
              ) : route === 'pulse' ? (
                <MarketPulseDashboard coins={coins} onOpenAsset={handleOpenAsset} />
              ) : route === 'quant' ? (
                <QuantRadarDashboard coins={coins} onOpenAsset={handleOpenAsset} />
              ) : route === 'analytics' ? (
                <AnalyticsView
                  coins={coins}
                  watchlist={watchlist}
                  customLists={customLists}
                  onInspectCoin={handleOpenAsset}
                  onOpenTvMode={() => navigateTo('tv')}
                  onOpenReportWithContext={(coinIds, periodDays) => {
                    const tickers = coinIds
                      .map((id) => coins.find((c) => c.id === id)?.symbol.toUpperCase())
                      .filter((s): s is string => Boolean(s));
                    navigateTo('reports', () => setReportContext({ tickers, days: periodDays }));
                  }}
                />
              ) : route === 'lists' ? (
                <ListsView
                  coins={coins}
                  watchlist={watchlist}
                  customLists={customLists}
                  onToggleFavorite={toggleWatchlist}
                  onCreateList={createList}
                  onUpdateList={updateList}
                  onDeleteList={deleteList}
                  onMoveCoinInList={moveCoinInList}
                  onOpenInMonitor={handleOpenListInMonitor}
                  onOpenAsset={handleOpenAsset}
                />
              ) : route === 'screener' ? (
                <ScreenerView
                  coins={coins}
                  onOpenAsset={handleOpenAsset}
                  onCompareCoins={(ids) => {
                    navigateTo('comparator', () => setCompareSeedIds(ids));
                  }}
                  onExportCoins={(scoped) => {
                    setExportCoinsOverride(scoped);
                    setExportOpen(true);
                  }}
                  onAnalyzeInChat={(payload) => {
                    setResearchReturnRoute('screener');
                    setResearchSeedContext({
                      ...payload,
                      capturedAt: data?.fetchedAt ?? Date.now(),
                      totalUniverseCount: coins.length,
                    });
                    navigateTo('research');
                  }}
                />
              ) : route === 'comparator' ? (
                  <ComparatorView
                    key={compareSeedIds?.join(',') ?? 'default'}
                    coins={coins}
                    initialSelectedIds={compareSeedIds}
                  />
              ) : route === 'asset' && activeAsset ? (
                  <AssetView
                    coin={activeAsset}
                    allCoins={coins}
                    fetchedAt={data?.fetchedAt}
                    favorite={watchlistSet.has(activeAsset.id)}
                    onToggleFavorite={toggleWatchlist}
                    onCreateAlert={(coinId) =>
                      setAlertModalState({ open: true, editing: null, coinId })
                    }
                    onCompareAsset={(coinId) => {
                      navigateTo('comparator', () => setCompareSeedIds([coinId]));
                    }}
                    onOpenReportWithContext={(coinIds, periodDays) => {
                      const tickers = coinIds
                        .map((id) => coins.find((c) => c.id === id)?.symbol.toUpperCase())
                        .filter((s): s is string => Boolean(s));
                      navigateTo('reports', () => setReportContext({ tickers, days: periodDays }));
                    }}
                    onBack={() => navigateTo('monitor')}
                  />
              ) : route === 'sources' ? (
                <SourcesView
                  fetchedAt={data?.fetchedAt}
                  latencyMs={data?.latencyMs}
                  isError={isError}
                  isFetching={isFetching}
                  coinCount={coins.length}
                  onRefresh={() => refetch()}
                />
              ) : route === 'preferences' ? (
                <PreferencesView
                  fetchedAt={data?.fetchedAt}
                  isFetching={isFetching}
                  isError={isError}
                />
              ) : route === 'alerts' ? (
                <AlertsView
                  coins={coins}
                  rules={alertRules}
                  events={alertEvents}
                  isError={isError}
                  onNewRule={() => setAlertModalState({ open: true, editing: null })}
                  onEditRule={(rule) => setAlertModalState({ open: true, editing: rule })}
                  onToggleRuleStatus={(rule) =>
                    updateRule(rule.id, {
                      status: rule.status === 'active' ? 'paused' : 'active',
                    })
                  }
                  onDeleteRule={deleteRule}
                />
              ) : route === 'reports' ? (
                <ReportsView
                  key={reportContext.tickers?.join(',') ?? 'default'}
                  initialTickers={reportContext.tickers}
                  initialDays={reportContext.days}
                />
              ) : route === 'dca' ? (
                <DcaSimulatorView coins={coins} />
              ) : route === 'position' ? (
                <PositionCalculatorView coins={coins} />
              ) : (
                <ConverterView coins={coins} fetchedAt={data?.fetchedAt} />
              )}
                  </ViewErrorBoundary>
                </div>
              </main>
            </div>
          </PageHeaderProvider>
        </>
      )}

      {/* Operation Panels */}
      {commandOpen ? (
        <CommandPalette
          coins={coins}
          customLists={customLists}
          onClose={() => setCommandOpen(false)}
          onSelectCoin={handleOpenAsset}
          onOpenList={handleOpenListInMonitor}
          onNavigate={(next) => navigateTo(next)}
          onRefresh={() => refetch()}
        />
      ) : null}

      {filterPanelOpen ? (
        <FilterPanel
          filters={filters}
          coins={coins}
          watchlistSet={watchlistSet}
          onApply={setFilters}
          onClose={() => setFilterPanelOpen(false)}
        />
      ) : null}

      <ColumnsPanel
        open={columnsPanelOpen}
        density={preferences.density}
        columns={columns}
        onChangeDensity={(density) => updatePreferences({ density })}
        onChangeColumns={setColumns}
        onReset={() => setColumns(DEFAULT_COLUMNS)}
        onClose={() => setColumnsPanelOpen(false)}
      />

      {exportOpen ? (
        <ExportCsvModal
          coins={exportCoinsOverride ?? filteredForExport}
          columns={columns}
          fetchedAt={data?.fetchedAt}
          timezone={preferences.timezone}
          onClose={() => {
            setExportOpen(false);
            setExportCoinsOverride(null);
          }}
        />
      ) : null}

      {alertModalState.open ? (
        <AlertRuleModal
          coins={coins}
          initialCoinId={alertModalState.coinId}
          editingRule={alertModalState.editing}
          onSave={(payload) => {
            if (alertModalState.editing) {
              updateRule(alertModalState.editing.id, payload);
            } else {
              createRule(payload);
            }
          }}
          onClose={() => setAlertModalState({ open: false })}
        />
      ) : null}
    </div>
  );
}

export default App;
