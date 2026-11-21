import { useState } from 'react';
import { Download, Info, Maximize2, Table } from 'lucide-react';

interface ChartToolbarProps {
  showData: boolean;
  onToggleData: () => void;
  onInspectData?: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportCsv: () => void;
  onAddToReport?: () => void;
  onFullscreen?: () => void;
}

const TOOLBAR_BTN_BASE =
  'group inline-flex h-7 items-center justify-center rounded-lg border border-border/80 bg-card/85 text-[11px] font-medium text-muted-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function ChartToolbar({
  showData,
  onToggleData,
  onInspectData,
  onExportPng,
  onExportSvg,
  onExportCsv,
  onAddToReport,
  onFullscreen,
}: ChartToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-1.5 text-[11px]">
      {onInspectData ? (
        <button
          type="button"
          onClick={onInspectData}
          aria-label="Inspecionar dados do gráfico"
          title="Inspecionar dados"
          className={`${TOOLBAR_BTN_BASE} gap-1.5 px-2.5`}
        >
          <Info
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-accent"
            aria-hidden="true"
          />
          <span className="hidden sm:inline">Inspecionar dados</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={onToggleData}
        aria-pressed={showData}
        className={
          showData
            ? 'group inline-flex h-7 items-center gap-1.5 rounded-lg border border-accent/60 bg-accent/15 px-2.5 text-[11px] font-medium text-accent shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
            : `${TOOLBAR_BTN_BASE} gap-1.5 px-2.5`
        }
      >
        <Table
          className={`h-3.5 w-3.5 shrink-0 transition-colors ${
            showData ? 'text-accent' : 'text-muted-foreground group-hover:text-accent'
          }`}
          aria-hidden="true"
        />
        <span>{showData ? 'Gráfico' : 'Dados'}</span>
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Exportar gráfico"
          aria-expanded={menuOpen}
          className={`${TOOLBAR_BTN_BASE} w-7 px-0`}
        >
          <Download
            className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-accent"
            aria-hidden="true"
          />
        </button>

        {menuOpen ? (
          <div
            className="absolute right-0 top-8 z-30 w-44 rounded-lg border border-border bg-card py-1 shadow-overlay"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Exportar
            </p>
            <button
              type="button"
              onClick={() => {
                onExportPng();
                setMenuOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted"
            >
              Baixar imagem PNG
            </button>
            <button
              type="button"
              onClick={() => {
                onExportSvg();
                setMenuOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted"
            >
              Baixar vetor SVG
            </button>
            <button
              type="button"
              onClick={() => {
                onExportCsv();
                setMenuOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted"
            >
              Baixar dados CSV
            </button>
            {onAddToReport ? (
              <button
                type="button"
                onClick={() => {
                  onAddToReport();
                  setMenuOpen(false);
                }}
                className="block w-full border-t border-border px-3 py-1.5 text-left text-xs font-medium text-accent hover:bg-muted"
              >
                Adicionar ao relatório LCT
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {onFullscreen ? (
        <button
          type="button"
          onClick={onFullscreen}
          aria-label="Abrir em tela cheia"
          className={`${TOOLBAR_BTN_BASE} w-7 px-0`}
        >
          <Maximize2
            className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-accent"
            aria-hidden="true"
          />
        </button>
      ) : null}
    </div>
  );
}
