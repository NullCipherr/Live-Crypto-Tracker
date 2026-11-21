import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Command, Search, X } from 'lucide-react';
import type { CoinMarket, CustomList, NavRoute } from '../../types/crypto';
import { cn } from '../../utils/cn';

interface CommandPaletteProps {
  open: boolean;
  coins: CoinMarket[];
  customLists: CustomList[];
  onClose: () => void;
  onSelectCoin: (coinId: string) => void;
  onOpenList: (listId: 'favorites' | string) => void;
  onNavigate: (route: NavRoute) => void;
  onRefresh: () => void;
}

interface PaletteItem {
  id: string;
  group: 'ATIVOS' | 'LISTAS' | 'NAVEGAÇÃO' | 'COMANDOS';
  label: string;
  mono?: string;
  actionLabel: string;
  onSelect: () => void;
}

export function CommandPalette({
  coins,
  customLists,
  onClose,
  onSelectCoin,
  onOpenList,
  onNavigate,
  onRefresh,
}: Omit<CommandPaletteProps, 'open'>) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();

    const coinItems: PaletteItem[] = coins
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.symbol.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((coin) => ({
        id: `coin-${coin.id}`,
        group: 'ATIVOS',
        label: coin.name,
        mono: coin.symbol.toUpperCase(),
        actionLabel: 'Abrir ativo',
        onSelect: () => {
          onSelectCoin(coin.id);
          onClose();
        },
      }));

    const navItems: PaletteItem[] = [
      { id: 'nav-home', label: 'Home (Visão geral)', route: 'home' as NavRoute },
      { id: 'nav-monitor', label: 'Monitor de mercado', route: 'monitor' as NavRoute },
      { id: 'nav-heatmap', label: 'Mapa de mercado', route: 'heatmap' as NavRoute },
      { id: 'nav-pulse', label: 'Pulso de mercado (Dashboard)', route: 'pulse' as NavRoute },
      { id: 'nav-analytics', label: 'Analytics', route: 'analytics' as NavRoute },
      { id: 'nav-quant', label: 'Radar Quant (Dashboard)', route: 'quant' as NavRoute },
      { id: 'nav-lists', label: 'Minhas listas', route: 'lists' as NavRoute },
      { id: 'nav-alerts', label: 'Alertas', route: 'alerts' as NavRoute },
      { id: 'nav-screener', label: 'Screener', route: 'screener' as NavRoute },
      { id: 'nav-comparator', label: 'Comparador', route: 'comparator' as NavRoute },
      { id: 'nav-converter', label: 'Conversor', route: 'converter' as NavRoute },
      { id: 'nav-reports', label: 'Relatórios (Caderno de Mercado PDF)', route: 'reports' as NavRoute },
      { id: 'nav-tv', label: 'Modo TV (rotação em tela cheia)', route: 'tv' as NavRoute },
      { id: 'nav-sources', label: 'Fontes de dados', route: 'sources' as NavRoute },
      { id: 'nav-preferences', label: 'Preferências', route: 'preferences' as NavRoute },
    ]
      .filter((n) => !q || n.label.toLowerCase().includes(q))
      .map((n) => ({
        id: n.id,
        group: 'NAVEGAÇÃO',
        label: n.label,
        actionLabel: 'Ir para tela',
        onSelect: () => {
          onNavigate(n.route);
          onClose();
        },
      }));

    const cmdItems: PaletteItem[] = [
      {
        id: 'cmd-refresh',
        group: 'COMANDOS' as const,
        label: 'Atualizar cotações agora',
        actionLabel: 'Executar',
        onSelect: () => {
          onRefresh();
          onClose();
        },
      },
    ].filter((c) => !q || c.label.toLowerCase().includes(q));

    const listItems: PaletteItem[] = [
      { id: 'favorites', name: 'Favoritos' },
      ...customLists.map((l) => ({ id: l.id, name: l.name })),
    ]
      .filter((l) => !q || l.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((l) => ({
        id: `list-${l.id}`,
        group: 'LISTAS' as const,
        label: l.name,
        actionLabel: 'Abrir lista',
        onSelect: () => {
          onOpenList(l.id);
          onClose();
        },
      }));

    return [...coinItems, ...listItems, ...navItems, ...cmdItems];
  }, [coins, customLists, onClose, onNavigate, onOpenList, onRefresh, onSelectCoin, query]);

  const safeActiveIndex = Math.min(activeIndex, Math.max(0, items.length - 1));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter' && items[safeActiveIndex]) {
      e.preventDefault();
      items[safeActiveIndex].onSelect();
    }
  };

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-16"
      role="dialog"
      aria-modal="true"
      aria-label="Busca global e comandos"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-md border border-border bg-card shadow-overlay"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Buscar ativo, tela ou comando..."
            aria-label="Buscar ativo, tela ou comando"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar busca"
            className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto py-1.5">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nenhum ativo ou comando encontrado para “{query}”.
            </p>
          ) : (
            items.map((item, idx) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const isSelected = idx === safeActiveIndex;
              return (
                <div key={item.id}>
                  {showGroup ? (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {item.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={item.onSelect}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors',
                      isSelected ? 'bg-accent/15 text-foreground' : 'text-foreground/90 hover:bg-muted/50'
                    )}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      {item.mono ? (
                        <span className="w-12 font-mono text-[11px] font-semibold text-accent">
                          {item.mono}
                        </span>
                      ) : (
                        <Command className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      )}
                      <span className="truncate font-medium">{item.label}</span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-nav px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>↑ ↓ navegar · Enter abrir</span>
          <span>Esc sair</span>
        </div>
      </div>
    </div>
  );
}
