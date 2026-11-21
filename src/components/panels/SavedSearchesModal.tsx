import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { SavedScreenerSearch, ScreenerCondition } from '../../types/crypto';

interface SavedSearchesModalProps {
  searches: SavedScreenerSearch[];
  currentMatchMode: 'all' | 'any';
  currentConditions: ScreenerCondition[];
  onOpenSearch: (search: SavedScreenerSearch) => void;
  onSaveCurrent: (name: string) => void;
  onDeleteSearch: (id: string) => void;
  onClose: () => void;
}

const FIELD_LABELS: Record<ScreenerCondition['field'], string> = {
  change24h: '24h',
  volume: 'Vol 24h',
  marketCap: 'Cap',
  price: 'Preço',
};

const OP_LABELS: Record<ScreenerCondition['operator'], string> = {
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
};

export function SavedSearchesModal({
  searches,
  currentConditions,
  onOpenSearch,
  onSaveCurrent,
  onDeleteSearch,
  onClose,
}: SavedSearchesModalProps) {
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');

  const filtered = searches.filter((s) =>
    !query.trim() ? true : s.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || currentConditions.length === 0) return;
    onSaveCurrent(newName.trim());
    setNewName('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Buscas salvas do screener"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-md border border-border bg-card shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Buscas salvas</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar buscas salvas"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 p-4 text-xs">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pelo nome..."
            aria-label="Filtrar buscas salvas"
            className="h-8 w-full rounded border border-border bg-background px-2.5 text-foreground outline-none focus:border-accent"
          />

          <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded border border-border bg-background">
            {filtered.length === 0 ? (
              <li className="px-3 py-5 text-center text-muted-foreground">
                Nenhuma busca salva encontrada.
              </li>
            ) : (
              filtered.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{s.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {s.conditions
                        .map((c) => `${FIELD_LABELS[c.field]} ${OP_LABELS[c.operator]} ${c.value}`)
                        .join(' | ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenSearch(s);
                        onClose();
                      }}
                      className="h-7 rounded border border-border bg-card px-2.5 font-medium text-foreground hover:bg-muted"
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSearch(s.id)}
                      aria-label={`Excluir busca ${s.name}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-negative"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>

          <form onSubmit={handleSave} className="flex items-center gap-2 border-t border-border pt-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Salvar condições atuais como..."
              aria-label="Nome para salvar condições atuais"
              className="h-8 flex-1 rounded border border-border bg-background px-2.5 text-foreground outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!newName.trim() || currentConditions.length === 0}
              className="h-8 rounded bg-accent px-3 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              Salvar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
