import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { CoinMarket, CustomList } from '../../types/crypto';

interface ListEditorModalProps {
  list: CustomList | null;
  coins: CoinMarket[];
  onSave: (name: string, coinIds: string[]) => void;
  onDelete?: (list: CustomList) => void;
  onClose: () => void;
}

export function ListEditorModal({
  list,
  coins,
  onSave,
  onDelete,
  onClose,
}: ListEditorModalProps) {
  const [name, setName] = useState(list?.name ?? '');
  const [coinIds, setCoinIds] = useState<string[]>(list?.coinIds ?? []);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedCoins = coinIds
    .map((id) => coins.find((c) => c.id === id))
    .filter((c): c is CoinMarket => Boolean(c));

  const suggestions = coins
    .filter((c) => {
      if (coinIds.includes(c.id)) return false;
      const q = search.trim().toLowerCase();
      if (!q) return false;
      return c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q);
    })
    .slice(0, 5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(name.trim() || 'Nova lista', coinIds);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={list ? `Editar lista ${list.name}` : 'Nova lista'}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-md border border-border bg-card shadow-overlay"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {list ? 'Editar lista' : 'Nova lista'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar editor de lista"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-4 text-xs">
          <div>
            <label htmlFor="list-name" className="mb-1 block font-medium text-muted-foreground">
              Nome da lista
            </label>
            <input
              id="list-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Infraestrutura"
              className="h-8 w-full rounded border border-border bg-background px-2.5 text-foreground outline-none focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="list-add-coin" className="mb-1 block font-medium text-muted-foreground">
              Adicionar ativo
            </label>
            <input
              id="list-add-coin"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou ticker..."
              className="h-8 w-full rounded border border-border bg-background px-2.5 text-foreground outline-none focus:border-accent"
            />
            {suggestions.length > 0 ? (
              <ul className="mt-1 divide-y divide-border rounded border border-border bg-background">
                {suggestions.map((coin) => (
                  <li key={coin.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCoinIds((prev) => [...prev, coin.id]);
                        setSearch('');
                      }}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-muted/50"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-accent">
                          {coin.symbol.toUpperCase()}
                        </span>
                        <span className="text-foreground">{coin.name}</span>
                      </span>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <p className="mb-1.5 font-medium text-muted-foreground">
              Ativos da lista ({selectedCoins.length})
            </p>
            {selectedCoins.length === 0 ? (
              <p className="rounded border border-border bg-background px-3 py-4 text-center text-muted-foreground">
                Nenhum ativo adicionado ainda.
              </p>
            ) : (
              <ul className="max-h-44 divide-y divide-border overflow-y-auto rounded border border-border bg-background">
                {selectedCoins.map((coin) => (
                  <li key={coin.id} className="flex items-center justify-between px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-accent">
                        {coin.symbol.toUpperCase()}
                      </span>
                      <span className="text-foreground">{coin.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCoinIds((prev) => prev.filter((id) => id !== coin.id))}
                      className="text-[11px] text-muted-foreground hover:text-negative"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {list && onDelete && confirmDelete ? (
            <div className="flex items-center justify-between rounded border border-negative/40 bg-negative/10 px-3 py-2">
              <span className="text-foreground">
                Excluir “{list.name}” ({list.coinIds.length} vínculos)?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded border border-border bg-card px-2 py-1 text-foreground"
                >
                  Manter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(list);
                    onClose();
                  }}
                  className="rounded bg-negative px-2 py-1 font-semibold text-white"
                >
                  Confirmar exclusão
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-nav px-4 py-3 text-xs">
          <div>
            {list && onDelete && !confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex h-8 items-center gap-1 rounded border border-border bg-card px-2.5 text-negative hover:bg-muted"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Excluir lista</span>
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded border border-border bg-card px-3 font-medium text-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-8 rounded bg-accent px-3 font-semibold text-accent-foreground hover:opacity-90"
            >
              Salvar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
