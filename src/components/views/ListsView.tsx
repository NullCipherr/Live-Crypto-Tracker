import { useState } from 'react';
import { ArrowDown, ArrowUp, Edit2, ExternalLink, Plus, Star } from 'lucide-react';
import type { CoinMarket, CustomList } from '../../types/crypto';
import { formatCompactNumber, formatPercent, formatPrice } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { PageHeader, HeaderButton } from '../shell/PageHeader';
import { ListEditorModal } from '../panels/ListEditorModal';

interface ListsViewProps {
  coins: CoinMarket[];
  watchlist: string[];
  customLists: CustomList[];
  onToggleFavorite: (coinId: string) => void;
  onCreateList: (name: string, coinIds: string[]) => CustomList;
  onUpdateList: (id: string, patch: Partial<Omit<CustomList, 'id'>>) => void;
  onDeleteList: (id: string) => void;
  onMoveCoinInList: (listId: string, index: number, delta: -1 | 1) => void;
  onOpenInMonitor: (listId: 'favorites' | string) => void;
  onOpenAsset: (coinId: string) => void;
}

export function ListsView({
  coins,
  watchlist,
  customLists,
  onToggleFavorite,
  onCreateList,
  onUpdateList,
  onDeleteList,
  onMoveCoinInList,
  onOpenInMonitor,
  onOpenAsset,
}: ListsViewProps) {
  const { preferences } = usePreferences();
  const [selectedListId, setSelectedListId] = useState<'favorites' | string>('favorites');
  const [editorTarget, setEditorTarget] = useState<'new' | CustomList | null>(null);

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const activeCustomList =
    selectedListId !== 'favorites'
      ? customLists.find((l) => l.id === selectedListId) ?? null
      : null;

  const activeIds = selectedListId === 'favorites' ? watchlist : activeCustomList?.coinIds ?? [];
  const activeName = selectedListId === 'favorites' ? 'Favoritos' : activeCustomList?.name ?? 'Lista';

  const activeCoins = activeIds
    .map((id) => coins.find((c) => c.id === id))
    .filter((c): c is CoinMarket => Boolean(c));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Minhas listas"
        subtitle="Organize grupos de acompanhamento além dos Favoritos."
        actions={
          <HeaderButton variant="primary" onClick={() => setEditorTarget('new')}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Nova lista</span>
          </HeaderButton>
        }
      />
      <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
        <div className="mx-auto w-full max-w-page space-y-5">

        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          {/* List Selector */}
          <div className="rounded-md border border-border bg-card shadow-card p-2">
            <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Listas
            </p>
            <ul className="space-y-0.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => setSelectedListId('favorites')}
                  className={`flex w-full items-center justify-between rounded px-2.5 py-2 text-left transition-colors ${
                    selectedListId === 'favorites'
                      ? 'bg-accent/15 font-medium text-accent'
                      : 'text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Favoritos</span>
                  </span>
                  <span className="font-mono text-[11px] tabular-nums">{watchlist.length}</span>
                </button>
              </li>
              {customLists.map((list) => (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedListId(list.id)}
                    className={`flex w-full items-center justify-between rounded px-2.5 py-2 text-left transition-colors ${
                      selectedListId === list.id
                        ? 'bg-accent/15 font-medium text-accent'
                        : 'text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span className="truncate">{list.name}</span>
                    <span className="font-mono text-[11px] tabular-nums">{list.coinIds.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Active List Table */}
          <div className="overflow-hidden rounded-md border border-border bg-card shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-nav px-4 py-2.5 text-xs">
              <div>
                <h2 className="font-semibold text-foreground">{activeName}</h2>
                <p className="text-[11px] text-muted-foreground">{activeCoins.length} ativos</p>
              </div>
              <div className="flex items-center gap-2">
                {activeCustomList ? (
                  <button
                    type="button"
                    onClick={() => setEditorTarget(activeCustomList)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card shadow-card px-2.5 font-medium text-foreground hover:bg-muted"
                  >
                    <Edit2 className="h-3 w-3" aria-hidden="true" />
                    <span>Editar</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpenInMonitor(selectedListId)}
                  className="inline-flex h-7 items-center gap-1 rounded bg-accent px-2.5 font-semibold text-accent-foreground hover:opacity-90"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  <span>Abrir no monitor</span>
                </button>
              </div>
            </div>

            {activeCoins.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                <p>{activeName} ainda não tem ativos.</p>
                {activeCustomList ? (
                  <button
                    type="button"
                    onClick={() => setEditorTarget(activeCustomList)}
                    className="mt-3 h-8 rounded border border-border bg-background px-3 font-medium text-foreground hover:bg-muted"
                  >
                    Adicionar primeiro ativo
                  </button>
                ) : null}
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-border bg-background text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Ativo</th>
                    <th className="px-3 py-2 text-right">Preço USD</th>
                    <th className="px-3 py-2 text-right">24h</th>
                    <th className="hidden px-3 py-2 text-right sm:table-cell">Vol. 24h</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {activeCoins.map((coin, idx) => (
                    <tr key={coin.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onOpenAsset(coin.id)}
                          className="flex items-center gap-2 text-left hover:text-accent"
                        >
                          <span className="font-mono text-[11px] font-semibold text-accent">
                            {coin.symbol.toUpperCase()}
                          </span>
                          <span className="font-medium text-foreground">{coin.name}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {formatPrice(coin.currentPrice, fmtOpts)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          coin.priceChange24h > 0
                            ? 'text-positive'
                            : coin.priceChange24h < 0
                              ? 'text-negative'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {formatPercent(coin.priceChange24h, preferences.numberLocale)}
                      </td>
                      <td className="hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">
                        US$ {formatCompactNumber(coin.totalVolume, preferences.numberLocale)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {activeCustomList ? (
                            <>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => onMoveCoinInList(activeCustomList.id, idx, -1)}
                                aria-label={`Mover ${coin.name} para cima`}
                                className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                              >
                                <ArrowUp className="h-3 w-3" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === activeCoins.length - 1}
                                onClick={() => onMoveCoinInList(activeCustomList.id, idx, 1)}
                                aria-label={`Mover ${coin.name} para baixo`}
                                className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                              >
                                <ArrowDown className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onToggleFavorite(coin.id)}
                              className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-negative"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      </div>

      {editorTarget ? (
        <ListEditorModal
          list={editorTarget === 'new' ? null : editorTarget}
          coins={coins}
          onSave={(name, coinIds) => {
            if (editorTarget === 'new') {
              const created = onCreateList(name, coinIds);
              setSelectedListId(created.id);
            } else {
              onUpdateList(editorTarget.id, { name, coinIds });
            }
          }}
          onDelete={(list) => {
            onDeleteList(list.id);
            if (selectedListId === list.id) setSelectedListId('favorites');
          }}
          onClose={() => setEditorTarget(null)}
        />
      ) : null}
    </div>
  );
}
