import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bookmark,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Filter,
  Gauge,
  GitCompare,
  Home,
  LayoutGrid,
  List,
  MessageSquare,
  Plus,
  Repeat,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import type { NavRoute, ResearchConversation } from '../../types/crypto';
import { usePreferences } from '../../hooks/usePreferences';
import { LctLogo } from './LctLogo';
import { cn } from '../../utils/cn';

export interface ResearchSidebarConfig {
  libraryView: 'chat' | 'saved';
  conversations: ResearchConversation[];
  savedCount: number;
  activeConvId: string | null;
  onExit: () => void;
  onNewAnalysis: () => void;
  onChangeLibraryView: (view: 'chat' | 'saved') => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

interface SidebarProps {
  mode?: 'main' | 'research';
  activeRoute: NavRoute;
  collapsed: boolean;
  mobileOpen: boolean;
  onSelectRoute: (route: NavRoute) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onGoHome: () => void;
  onOpenCommandPalette?: () => void;
  research?: ResearchSidebarConfig;
}

interface NavGroup {
  label: string;
  items: {
    id: NavRoute;
    label: string;
    icon: ComponentType<{ className?: string }>;
    phase2?: boolean;
  }[];
}

const MAIN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'MERCADO',
    items: [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'monitor', label: 'Monitor', icon: Activity },
    ],
  },
  {
    label: 'ACOMPANHAMENTO',
    items: [
      { id: 'lists', label: 'Minhas listas', icon: List },
      { id: 'alerts', label: 'Alertas', icon: Bell },
    ],
  },
  {
    label: 'UTILIDADES',
    items: [
      { id: 'converter', label: 'Conversor', icon: Repeat },
      { id: 'dca', label: 'Simulador DCA', icon: CalendarClock },
      { id: 'position', label: 'Risco & Posição', icon: ShieldCheck },
    ],
  },
];

const PREFERENCES_NAV_GROUPS: NavGroup[] = [
  {
    label: 'CONFIGURAÇÕES',
    items: [
      { id: 'preferences', label: 'Preferências gerais', icon: Sliders },
      { id: 'sources', label: 'Fontes de dados', icon: Database },
    ],
  },
];

const PREFERENCES_KEYWORDS: Record<string, string[]> = {
  preferences: [
    'preferências gerais',
    'tema',
    'escuro',
    'claro',
    'fuso',
    'horário',
    'idioma',
    'decimais',
    'atualização',
    'intervalo',
    'animação',
    'movimento',
  ],
  sources: [
    'fontes de dados',
    'api',
    'coingecko',
    'coinpaprika',
    'cache',
    'latência',
    'provedores',
    'logs',
    'requisições',
    'telemetria',
  ],
};

const PREFERENCES_ROUTE_SET = new Set<NavRoute>(['preferences', 'sources']);

const ANALYTICS_NAV_GROUPS: NavGroup[] = [
  {
    label: 'PAINÉIS',
    items: [
      { id: 'analytics', label: 'Visão geral', icon: Activity },
      { id: 'pulse', label: 'Sentimento e fluxo', icon: Gauge },
      { id: 'quant', label: 'Indicadores técnicos', icon: BarChart3 },
      { id: 'heatmap', label: 'Mapa de calor', icon: LayoutGrid },
    ],
  },
  {
    label: 'FERRAMENTAS',
    items: [
      { id: 'screener', label: 'Filtro avançado', icon: Filter },
      { id: 'comparator', label: 'Comparar ativos', icon: GitCompare },
      { id: 'reports', label: 'Relatórios PDF', icon: FileText },
    ],
  },
];

const ANALYTICS_ROUTE_SET = new Set<NavRoute>([
  'analytics',
  'pulse',
  'quant',
  'heatmap',
  'screener',
  'comparator',
  'reports',
]);

export function Sidebar({
  mode = 'main',
  activeRoute,
  collapsed,
  mobileOpen,
  onSelectRoute,
  onToggleCollapse,
  onCloseMobile,
  onGoHome,
  onOpenCommandPalette,
  research,
}: SidebarProps) {
  const { preferences } = usePreferences();
  const effectiveRoute = activeRoute === 'asset' ? 'monitor' : activeRoute;
  const [sidebarMenu, setSidebarMenu] = useState<'main' | 'analytics' | 'preferences'>(() =>
    ANALYTICS_ROUTE_SET.has(effectiveRoute)
      ? 'analytics'
      : PREFERENCES_ROUTE_SET.has(effectiveRoute)
        ? 'preferences'
        : 'main'
  );
  const [prefSearch, setPrefSearch] = useState('');
  const [analyticsHoverOpen, setAnalyticsHoverOpen] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 264,
  });
  const analyticsBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const openAnalyticsPopover = (el: HTMLButtonElement | null) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (el) {
      analyticsBtnRef.current = el;
      const rect = el.getBoundingClientRect();
      const estimatedHeight = 290;
      const top = Math.max(
        12,
        Math.min(rect.top, window.innerHeight - estimatedHeight - 12)
      );
      setPopoverCoords({ top, left: rect.right + 8 });
    }
    setAnalyticsHoverOpen(true);
  };

  const scheduleCloseAnalyticsPopover = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setAnalyticsHoverOpen(false);
      closeTimerRef.current = null;
    }, 140);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);
  const asideRef = useRef<HTMLElement>(null);
  const prevCollapsedRef = useRef(collapsed);
  const widthAnimRef = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    if (prevCollapsedRef.current === collapsed) return;

    const fromWidth = prevCollapsedRef.current ? 60 : 256;
    const toWidth = collapsed ? 60 : 256;
    prevCollapsedRef.current = collapsed;

    const reduceMotion =
      preferences.reduceMotion === 'reduce' ||
      (preferences.reduceMotion === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (reduceMotion || typeof el.animate !== 'function') return;

    widthAnimRef.current?.cancel();
    widthAnimRef.current = el.animate(
      [{ width: `${fromWidth}px` }, { width: `${toWidth}px` }],
      {
        duration: 240,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }
    );
  }, [collapsed, preferences.reduceMotion]);

  const isResearch = mode === 'research' && Boolean(research);
  const brandTitle = isResearch ? 'Cipher' : 'LCT';

  const navContent = (isMobile: boolean) => (
    <div className="flex h-full flex-col justify-between bg-nav">
      <div className="flex min-h-0 flex-1 flex-col">
        {!isMobile ? (
          <div
            className={cn(
              'flex min-h-[65px] shrink-0 items-center px-3.5 py-4',
              collapsed ? 'justify-center px-0' : 'justify-between gap-2'
            )}
          >
            {collapsed ? (
              <div className="group relative flex h-8 w-8 items-center justify-center">
                <button
                  type="button"
                  onClick={isResearch ? research?.onNewAnalysis : onGoHome}
                  title={brandTitle}
                  tabIndex={-1}
                  className="inline-flex items-center justify-center rounded-md transition-all duration-150 group-hover:scale-90 group-hover:opacity-0"
                >
                  <LctLogo className="h-7 w-7" />
                </button>
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label="Expandir navegação lateral"
                  title="Expandir barra lateral"
                  className="absolute inset-0 inline-flex items-center justify-center rounded-md border border-border bg-card text-foreground opacity-0 scale-90 shadow-card transition-all duration-150 hover:bg-muted group-hover:scale-100 group-hover:opacity-100 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={isResearch ? research?.onNewAnalysis : onGoHome}
                  title={brandTitle}
                  className="flex min-w-0 items-center gap-2.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <LctLogo className="h-7 w-7" />
                  <span className="truncate text-xl font-semibold leading-none tracking-tight text-foreground">
                    {brandTitle}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label="Recolher navegação lateral"
                  title="Recolher barra lateral"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        ) : null}

        {/* Slot below brand: Search in main LCT, Filter in Preferences, Voltar ao LCT in Research */}
        <div className="px-3 pb-3 pt-0.5">
          {isResearch && research ? (
            <button
              type="button"
              onClick={() => {
                research.onExit();
                if (isMobile) onCloseMobile();
              }}
              title="Voltar ao LCT"
              className={cn(
                'flex h-9 items-center rounded-lg border border-border/80 bg-card/85 text-xs font-medium text-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card',
                collapsed && !isMobile ? 'mx-auto w-9 justify-center px-0' : 'w-full gap-2 px-3'
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
              {!collapsed || isMobile ? <span className="truncate">Voltar ao LCT</span> : null}
            </button>
          ) : sidebarMenu === 'preferences' ? (
            collapsed && !isMobile ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Buscar configuração"
                title="Buscar configuração"
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-card/85 text-muted-foreground shadow-card transition-all hover:border-accent/50 hover:text-foreground"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <div className="flex h-9 items-center gap-2 rounded-lg border border-border/80 bg-card/85 px-3 text-[12.5px] shadow-card transition-colors focus-within:border-accent">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  value={prefSearch}
                  onChange={(e) => setPrefSearch(e.target.value)}
                  placeholder="Buscar configuração..."
                  aria-label="Buscar configuração"
                  className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                {prefSearch ? (
                  <button
                    type="button"
                    onClick={() => setPrefSearch('')}
                    aria-label="Limpar busca"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={() => {
                onOpenCommandPalette?.();
                if (isMobile) onCloseMobile();
              }}
              aria-label="Buscar ativo ou comando (Ctrl+K)"
              title="Buscar ativo ou comando (Ctrl+K)"
              className={cn(
                'group flex h-9 items-center rounded-lg border border-border/80 bg-card/85 text-[12.5px] text-muted-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                collapsed && !isMobile
                  ? 'mx-auto w-9 justify-center px-0'
                  : 'w-full justify-between gap-2 px-3'
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Search
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-accent"
                  aria-hidden="true"
                />
                {!collapsed || isMobile ? (
                  <span className="truncate">Buscar ativo...</span>
                ) : null}
              </span>
              {!collapsed || isMobile ? (
                <kbd className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Ctrl K
                </kbd>
              ) : null}
            </button>
          )}
        </div>

        {/* Navigation / ChatGPT-style Research History */}
        {isResearch && research ? (
          <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                research.onNewAnalysis();
                if (isMobile) onCloseMobile();
              }}
              title="Nova análise"
              className={cn(
                'inline-flex h-8 w-full shrink-0 items-center rounded-md border border-border bg-card text-xs font-medium text-foreground shadow-card hover:bg-muted',
                collapsed && !isMobile ? 'justify-center px-0' : 'justify-center gap-1.5 px-2.5'
              )}
            >
              <Plus className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
              {!collapsed || isMobile ? <span>Nova análise</span> : null}
            </button>

            <div className="mt-4">
              {!collapsed || isMobile ? (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Biblioteca
                </p>
              ) : null}
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    research.onChangeLibraryView('chat');
                    if (isMobile) onCloseMobile();
                  }}
                  title="Conversas"
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs transition-colors',
                    research.libraryView === 'chat'
                      ? 'bg-accent/15 font-medium text-accent'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    collapsed && !isMobile && 'justify-center px-0'
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {!collapsed || isMobile ? (
                    <span className="truncate">Conversas ({research.conversations.length})</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    research.onChangeLibraryView('saved');
                    if (isMobile) onCloseMobile();
                  }}
                  title="Análises salvas"
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs transition-colors',
                    research.libraryView === 'saved'
                      ? 'bg-accent/15 font-medium text-accent'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    collapsed && !isMobile && 'justify-center px-0'
                  )}
                >
                  <Bookmark className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {!collapsed || isMobile ? (
                    <span className="truncate">Análises salvas ({research.savedCount})</span>
                  ) : null}
                </button>
              </div>
            </div>

            {!collapsed || isMobile ? (
              <div className="mt-5 flex min-h-0 flex-1 flex-col">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recentes
                </p>
                <div className="flex-1 space-y-0.5 overflow-y-auto">
                  {research.conversations.length === 0 ? (
                    <p className="px-2 py-2 text-[11px] text-muted-foreground">
                      Nenhuma conversa salva neste dispositivo.
                    </p>
                  ) : (
                    research.conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={cn(
                          'group flex items-center justify-between gap-1 rounded-md px-2 py-1.5 text-xs transition-colors',
                          research.activeConvId === conv.id && research.libraryView === 'chat'
                            ? 'bg-accent/15 font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            research.onSelectConversation(conv.id);
                            if (isMobile) onCloseMobile();
                          }}
                          className="min-w-0 flex-1 truncate text-left"
                        >
                          {conv.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => research.onDeleteConversation(conv.id)}
                          aria-label="Excluir conversa"
                          className="hidden rounded p-0.5 text-muted-foreground hover:text-negative group-hover:block"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <nav
            aria-label="Navegação principal"
            className="flex-1 space-y-4 overflow-y-auto px-2.5 py-2"
          >
            {sidebarMenu !== 'main' ? (
              <div className="pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setPrefSearch('');
                    setSidebarMenu('main');
                    onGoHome();
                    if (isMobile) onCloseMobile();
                  }}
                  title="Voltar para Home"
                  className={cn(
                    'flex h-8 w-full items-center rounded-lg border border-border/80 bg-card/85 text-xs font-medium text-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card',
                    collapsed && !isMobile ? 'mx-auto w-9 justify-center px-0' : 'gap-2 px-2.5'
                  )}
                >
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                  {!collapsed || isMobile ? <span className="truncate">Voltar</span> : null}
                </button>
              </div>
            ) : null}

            {(sidebarMenu === 'analytics'
              ? ANALYTICS_NAV_GROUPS
              : sidebarMenu === 'preferences'
                ? PREFERENCES_NAV_GROUPS
                : MAIN_NAV_GROUPS
            ).map((group) => (
              <div key={group.label}>
                {!collapsed || isMobile ? (
                  <p className="mb-1 px-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground/80">
                    {group.label}
                  </p>
                ) : (
                  <div className="mx-2 my-2 border-t border-border" aria-hidden="true" />
                )}
                <ul className="space-y-0.5">
                  {group.items
                    .filter((item) => {
                      if (sidebarMenu !== 'preferences') return true;
                      const q = prefSearch.trim().toLowerCase();
                      if (!q) return true;
                      const keywords = PREFERENCES_KEYWORDS[item.id] ?? [item.label.toLowerCase()];
                      return (
                        item.label.toLowerCase().includes(q) ||
                        keywords.some((kw) => kw.includes(q))
                      );
                    })
                    .map((item) => {
                    const Icon = item.icon;
                    const active = effectiveRoute === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectRoute(item.id);
                            if (isMobile) onCloseMobile();
                          }}
                          title={collapsed && !isMobile ? item.label : undefined}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                            active
                              ? 'bg-accent/15 text-accent'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                            collapsed && !isMobile && 'justify-center px-0'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {!collapsed || isMobile ? (
                            <span className="flex flex-1 items-center justify-between truncate">
                              <span className="truncate">{item.label}</span>
                              {item.phase2 ? (
                                <span className="ml-1 font-mono text-[9px] uppercase text-muted-foreground/70">
                                  breve
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {sidebarMenu === 'main' ? (
              <div>
                {!collapsed || isMobile ? (
                  <p className="mb-1 px-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground/80">
                    ANALYTICS
                  </p>
                ) : (
                  <div className="mx-2 my-2 border-t border-border" aria-hidden="true" />
                )}
                <button
                  type="button"
                  onMouseEnter={(e) => {
                    if (!isMobile) openAnalyticsPopover(e.currentTarget);
                  }}
                  onMouseLeave={() => {
                    if (!isMobile) scheduleCloseAnalyticsPopover();
                  }}
                  onClick={() => {
                    setAnalyticsHoverOpen(false);
                    setSidebarMenu('analytics');
                    if (!ANALYTICS_ROUTE_SET.has(effectiveRoute)) {
                      onSelectRoute('analytics');
                    }
                    if (isMobile) onCloseMobile();
                  }}
                  title={collapsed && !isMobile ? 'Analytics' : undefined}
                  aria-current={ANALYTICS_ROUTE_SET.has(effectiveRoute) ? 'page' : undefined}
                  aria-expanded={!isMobile ? analyticsHoverOpen : undefined}
                  className={cn(
                    'group flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    ANALYTICS_ROUTE_SET.has(effectiveRoute)
                      ? 'bg-accent/15 text-accent'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    collapsed && !isMobile && 'justify-center px-0'
                  )}
                >
                  <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!collapsed || isMobile ? (
                    <span className="flex flex-1 items-center justify-between truncate">
                      <span className="truncate">Analytics</span>
                      <ArrowRight
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80 transition-transform group-hover:translate-x-0.5 group-hover:text-current"
                        aria-hidden="true"
                      />
                    </span>
                  ) : null}
                </button>
              </div>
            ) : null}

            {/* Special Assistant Category (Hidden inside Preferences) */}
            {sidebarMenu !== 'preferences' ? (
              <div>
                {!collapsed || isMobile ? (
                  <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wide text-accent/90">
                    ASSISTENTE
                  </p>
                ) : (
                  <div className="mx-2 my-2 border-t border-border" aria-hidden="true" />
                )}
                <button
                  type="button"
                  onClick={() => {
                    onSelectRoute('research');
                    if (isMobile) onCloseMobile();
                  }}
                  title={collapsed && !isMobile ? 'Cipher — Assistente de análise' : undefined}
                  aria-current={effectiveRoute === 'research' ? 'page' : undefined}
                  className={cn(
                    'group flex w-full items-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    effectiveRoute === 'research'
                      ? 'border-accent/60 bg-accent/15 text-accent shadow-card'
                      : 'border-border/80 bg-card/70 text-foreground shadow-card hover:border-accent/50 hover:bg-card',
                    collapsed && !isMobile ? 'mx-auto h-9 w-9 justify-center px-0' : 'justify-between gap-2.5 px-2.5 py-2'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    {!collapsed || isMobile ? (
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-[13px] font-semibold leading-tight text-foreground">
                          Cipher
                        </span>
                        <span className="block truncate text-[10.5px] leading-tight text-muted-foreground">
                          Assistente de análise
                        </span>
                      </span>
                    ) : null}
                  </span>
                  {!collapsed || isMobile ? (
                    <ArrowUpRight
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </div>
            ) : null}
          </nav>
        )}
      </div>

      {!isResearch ? (
        <div className="shrink-0 px-2.5 py-2.5">
          <button
            type="button"
            onClick={() => {
              setAnalyticsHoverOpen(false);
              setSidebarMenu('preferences');
              if (!PREFERENCES_ROUTE_SET.has(effectiveRoute)) {
                onSelectRoute('preferences');
              }
              if (isMobile) onCloseMobile();
            }}
            title={collapsed && !isMobile ? 'Preferências' : undefined}
            aria-current={PREFERENCES_ROUTE_SET.has(effectiveRoute) ? 'page' : undefined}
            className={cn(
              'group flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              PREFERENCES_ROUTE_SET.has(effectiveRoute)
                ? 'bg-accent/15 text-accent'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              collapsed && !isMobile && 'justify-center px-0'
            )}
          >
            <Sliders className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed || isMobile ? (
              <span className="flex flex-1 items-center justify-between truncate">
                <span className="truncate">Preferências</span>
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80 transition-transform group-hover:translate-x-0.5 group-hover:text-current"
                  aria-hidden="true"
                />
              </span>
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Desktop full-height sidebar (shared across LCT & LCT Research) */}
      <aside
        ref={asideRef}
        style={{ viewTransitionName: 'sidebar-shell' }}
        className={cn(
          'hidden h-full shrink-0 overflow-hidden whitespace-nowrap border-r border-border bg-nav lg:block',
          collapsed ? 'w-[60px]' : 'w-[256px]'
        )}
      >
        {navContent(false)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div
            className="fixed inset-0 bg-black/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full w-64 flex-col border-r border-border bg-nav">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
              <button
                type="button"
                onClick={() => {
                  if (isResearch) {
                    research?.onNewAnalysis();
                  } else {
                    onGoHome();
                  }
                  onCloseMobile();
                }}
                className="flex items-center gap-2.5"
              >
                <LctLogo />
                <span className="text-[13px] font-semibold tracking-tight text-foreground">
                  {brandTitle}
                </span>
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Fechar menu"
                className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{navContent(true)}</div>
          </div>
        </div>
      ) : null}

      {/* Analytics Hover Popover Menu */}
      {analyticsHoverOpen && sidebarMenu === 'main' && !isResearch && typeof document !== 'undefined'
        ? createPortal(
            <div
              onMouseEnter={() => openAnalyticsPopover(analyticsBtnRef.current)}
              onMouseLeave={scheduleCloseAnalyticsPopover}
              style={{
                position: 'fixed',
                top: popoverCoords.top,
                left: popoverCoords.left,
              }}
              className="z-[90] w-60 rounded-xl border border-border/90 bg-card/95 p-2 shadow-2xl backdrop-blur-md"
              role="menu"
              aria-label="Submenu Analytics"
            >
              <div className="space-y-3">
                {ANALYTICS_NAV_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                      {group.label}
                    </p>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = effectiveRoute === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setAnalyticsHoverOpen(false);
                                onSelectRoute(item.id);
                              }}
                              className={cn(
                                'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors',
                                active
                                  ? 'bg-accent/15 text-accent'
                                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span className="truncate">{item.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
