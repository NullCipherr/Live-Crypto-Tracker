import { X } from 'lucide-react';

export interface DataInspectorPayload {
  title: string;
  source: string;
  unit: string;
  timezone: string;
  requestedPeriod: string;
  coveredPeriod: string;
  observationCount: number;
  excludedCount: number;
  excludedNote?: string;
  formula: string;
}

interface DataInspectorModalProps {
  payload: DataInspectorPayload;
  onClose: () => void;
}

export function DataInspectorModal({ payload, onClose }: DataInspectorModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Inspetor de dados: ${payload.title}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-md border border-border bg-card shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Inspetor de dados</h2>
            <p className="text-[11px] text-muted-foreground">{payload.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar inspetor de dados"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <dl className="divide-y divide-border p-4 text-xs">
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted-foreground">Fonte</dt>
            <dd className="font-medium text-foreground">{payload.source}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted-foreground">Unidade</dt>
            <dd className="font-mono text-foreground">{payload.unit}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted-foreground">Fuso horário</dt>
            <dd className="font-mono text-foreground">{payload.timezone}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted-foreground">Período solicitado</dt>
            <dd className="font-mono text-foreground">{payload.requestedPeriod}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted-foreground">Período efetivamente coberto</dt>
            <dd className="font-mono text-foreground">{payload.coveredPeriod}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted-foreground">Observações no cálculo</dt>
            <dd className="font-mono tabular-nums text-foreground">
              {payload.observationCount}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted-foreground">Amostras excluídas / ausentes</dt>
            <dd className="font-mono tabular-nums text-foreground">
              {payload.excludedCount}
              {payload.excludedNote ? ` (${payload.excludedNote})` : ''}
            </dd>
          </div>
          <div className="pt-3">
            <dt className="mb-1 text-muted-foreground">Fórmula / Metodologia</dt>
            <dd className="rounded border border-border bg-background p-2.5 font-mono text-[11px] leading-relaxed text-foreground">
              {payload.formula}
            </dd>
          </div>
        </dl>

        <div className="flex justify-end border-t border-border bg-nav px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded bg-accent px-3 text-xs font-semibold text-accent-foreground hover:opacity-90"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
