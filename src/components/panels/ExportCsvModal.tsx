import { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { CoinMarket, ColumnConfig } from '../../types/crypto';
import { formatTime } from '../../lib/formatters';

interface ExportCsvModalProps {
  coins: CoinMarket[];
  columns: ColumnConfig[];
  fetchedAt?: number;
  timezone: string;
  onClose: () => void;
}

export function ExportCsvModal({
  coins,
  columns,
  fetchedAt,
  timezone,
  onClose,
}: ExportCsvModalProps) {
  const [snapshotCoins] = useState<CoinMarket[]>(coins);
  const [snapshotTime] = useState<number>(() => fetchedAt ?? Date.now());
  const [decimalSep, setDecimalSep] = useState<'comma' | 'dot'>('comma');
  const [delimiter, setDelimiter] = useState<';' | ','>(';');
  const [columnScope, setColumnScope] = useState<'visible' | 'all'>('visible');

  const csvText = useMemo(() => {
    const activeCols =
      columnScope === 'visible'
        ? columns.filter((c) => c.visible && c.id !== 'sparkline')
        : columns.filter((c) => c.id !== 'sparkline');

    const fmtNum = (n: number) => {
      const str = String(n);
      return decimalSep === 'comma' ? str.replace('.', ',') : str;
    };

    const headers = activeCols.map((col) => {
      switch (col.id) {
        case 'rank':
          return 'rank';
        case 'asset':
          return `ticker${delimiter}nome`;
        case 'price':
          return 'preco_usd';
        case 'change24h':
          return 'variacao_24h_pct';
        case 'marketCap':
          return 'cap_usd';
        case 'volume':
          return 'volume_24h_usd';
        default:
          return col.id;
      }
    });

    const rows = snapshotCoins.map((c) =>
      activeCols
        .map((col) => {
          switch (col.id) {
            case 'rank':
              return String(c.marketCapRank);
            case 'asset':
              return `${c.symbol.toUpperCase()}${delimiter}"${c.name.replace(/"/g, '""')}"`;
            case 'price':
              return fmtNum(c.currentPrice);
            case 'change24h':
              return fmtNum(Number(c.priceChange24h.toFixed(2)));
            case 'marketCap':
              return fmtNum(c.marketCap);
            case 'volume':
              return fmtNum(c.totalVolume);
            default:
              return '';
          }
        })
        .join(delimiter)
    );

    return [headers.join(delimiter), ...rows].join('\n');
  }, [columnScope, columns, decimalSep, delimiter, snapshotCoins]);

  const previewLines = csvText.split('\n').slice(0, 4).join('\n');

  const handleDownload = () => {
    const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `live-crypto-tracker-${new Date(snapshotTime).toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Exportar CSV"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-md border border-border bg-card shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Exportar CSV</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar exportação"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 p-4 text-xs">
          <div className="flex items-center justify-between rounded border border-border bg-background px-3 py-2 text-muted-foreground">
            <span>Origem: Monitor de mercado ({snapshotCoins.length} ativos)</span>
            <span className="font-mono tabular-nums">Captura {formatTime(snapshotTime, timezone)}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="csv-cols" className="mb-1 block text-muted-foreground">
                Colunas
              </label>
              <select
                id="csv-cols"
                value={columnScope}
                onChange={(e) => setColumnScope(e.target.value as 'visible' | 'all')}
                className="h-8 w-full rounded border border-border bg-background px-2 text-foreground"
              >
                <option value="visible">Visíveis na tabela</option>
                <option value="all">Todas as colunas</option>
              </select>
            </div>

            <div>
              <label htmlFor="csv-dec" className="mb-1 block text-muted-foreground">
                Números
              </label>
              <select
                id="csv-dec"
                value={decimalSep}
                onChange={(e) => setDecimalSep(e.target.value as 'comma' | 'dot')}
                className="h-8 w-full rounded border border-border bg-background px-2 text-foreground"
              >
                <option value="comma">Decimal com vírgula</option>
                <option value="dot">Decimal com ponto</option>
              </select>
            </div>

            <div>
              <label htmlFor="csv-sep" className="mb-1 block text-muted-foreground">
                Separador
              </label>
              <select
                id="csv-sep"
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value as ';' | ',')}
                className="h-8 w-full rounded border border-border bg-background px-2 text-foreground"
              >
                <option value=";">Ponto e vírgula (;)</option>
                <option value=",">Vírgula (,)</option>
              </select>
            </div>
          </div>

          <div>
            <p className="mb-1 text-muted-foreground">Prévia</p>
            <pre className="overflow-x-auto rounded border border-border bg-background p-2.5 font-mono text-[11px] text-foreground">
              {previewLines}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-nav px-4 py-3 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded border border-border bg-card px-3 font-medium text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex h-8 items-center gap-1.5 rounded bg-accent px-3 font-semibold text-accent-foreground hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Baixar CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
}
