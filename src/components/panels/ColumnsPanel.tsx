import { ArrowDown, ArrowUp, X } from 'lucide-react';
import type { ColumnConfig, TableDensity } from '../../types/crypto';

interface ColumnsPanelProps {
  open: boolean;
  density: TableDensity;
  columns: ColumnConfig[];
  onChangeDensity: (density: TableDensity) => void;
  onChangeColumns: (columns: ColumnConfig[]) => void;
  onReset: () => void;
  onClose: () => void;
}

export function ColumnsPanel({
  open,
  density,
  columns,
  onChangeDensity,
  onChangeColumns,
  onReset,
  onClose,
}: ColumnsPanelProps) {
  if (!open) return null;

  const moveColumn = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChangeColumns(next);
  };

  const toggleVisibility = (index: number) => {
    const col = columns[index];
    if (col.locked) return;
    const next = columns.map((c, i) => (i === index ? { ...c, visible: !c.visible } : c));
    onChangeColumns(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Visualização e colunas"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Visualização</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar visualização"
            className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 text-xs">
          <div>
            <p className="mb-2 font-medium text-muted-foreground">Densidade da tabela</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'compact', label: 'Compacta (34 px)' },
                  { id: 'comfortable', label: 'Confortável (42 px)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeDensity(opt.id)}
                  className={`h-8 rounded border px-2 font-medium transition-colors ${
                    density === opt.id
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Colunas</span>
              <span>Visível · Ordem</span>
            </div>
            <ul className="divide-y divide-border rounded border border-border bg-background">
              {columns.map((col, idx) => (
                <li key={col.id} className="flex items-center justify-between px-3 py-2">
                  <span className="font-medium text-foreground">{col.label}</span>
                  <div className="flex items-center gap-2">
                    {col.locked ? (
                      <span className="text-[11px] text-muted-foreground">Fixa</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => toggleVisibility(idx)}
                        aria-label={`Exibir coluna ${col.label}`}
                        className="accent-accent"
                      />
                    )}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveColumn(idx, -1)}
                      aria-label={`Mover ${col.label} para cima`}
                      className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === columns.length - 1}
                      onClick={() => moveColumn(idx, 1)}
                      aria-label={`Mover ${col.label} para baixo`}
                      className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-nav px-4 py-3 text-xs">
          <button
            type="button"
            onClick={onReset}
            className="h-8 rounded border border-border bg-card px-3 font-medium text-foreground hover:bg-muted"
          >
            Restaurar padrão
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded bg-accent px-3 font-semibold text-accent-foreground hover:opacity-90"
          >
            Pronto
          </button>
        </div>
      </div>
    </div>
  );
}
