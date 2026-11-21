import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, ExternalLink, FileSpreadsheet, FileText, GitCompare } from 'lucide-react';
import {
  buildMarketNotebookPdf,
  generateDemoObservations,
  parseReportCsv,
  PDF_TEMPLATES,
  type PdfTemplateId,
  type ReportObservation,
} from '../../lib/pdfReport';
import {
  readReportSnapshots,
  saveReportSnapshot,
  type ReportSnapshot,
} from '../../lib/reportSnapshots';
import { formatCompactNumber, formatPercent } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { PageHeader, HeaderSegmented } from '../shell/PageHeader';
import { CustomSelect } from '../ui/CustomSelect';

interface ReportsViewProps {
  initialTickers?: string[];
  initialDays?: '7' | '30' | '90' | '365';
}

export function ReportsView({ initialTickers, initialDays }: ReportsViewProps) {
  const { preferences } = usePreferences();
  const [tab, setTab] = useState<'generator' | 'compare'>('generator');
  const [observations, setObservations] = useState<ReportObservation[]>(() =>
    generateDemoObservations()
  );
  const [sourceLabel, setSourceLabel] = useState('Demonstração LCT');

  const availableTickers = useMemo(
    () => Array.from(new Set(observations.map((o) => o.ticker))),
    [observations]
  );

  const [selectedTickers, setSelectedTickers] = useState<string[]>(() =>
    initialTickers && initialTickers.length > 0
      ? initialTickers
      : ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'TRX', 'LINK']
  );
  const [startDate, setStartDate] = useState(() => {
    if (initialDays === '7') return '2026-10-25';
    return '2026-10-01';
  });
  const [endDate, setEndDate] = useState('2026-10-31');
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includePerformance, setIncludePerformance] = useState(true);
  const [includeIndicators, setIncludeIndicators] = useState(true);
  const [includeAppendix, setIncludeAppendix] = useState(false);
  const [templateId, setTemplateId] = useState<PdfTemplateId>('caderno-executivo');

  const selectedTemplate = useMemo(
    () => PDF_TEMPLATES.find((t) => t.id === templateId) ?? PDF_TEMPLATES[0],
    [templateId]
  );

  const [snapshots, setSnapshots] = useState<ReportSnapshot[]>(() => readReportSnapshots());
  const [compareAId, setCompareAId] = useState<string>(() => snapshots[0]?.id ?? '');
  const [compareBId, setCompareBId] = useState<string>(
    () => snapshots[1]?.id ?? snapshots[0]?.id ?? ''
  );
  const [commonUniverseOnly, setCommonUniverseOnly] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveTickers = useMemo(() => {
    const valid = selectedTickers.filter((t) => availableTickers.includes(t));
    return valid.length > 0 ? valid : availableTickers.slice(0, 3);
  }, [availableTickers, selectedTickers]);

  const pdfResult = useMemo(
    () =>
      buildMarketNotebookPdf(observations, {
        sourceLabel,
        startDate,
        endDate,
        tickers: effectiveTickers,
        includeSummary,
        includePerformance,
        includeIndicators,
        includeAppendix,
        templateId,
      }),
    [
      effectiveTickers,
      endDate,
      includeAppendix,
      includeIndicators,
      includePerformance,
      includeSummary,
      observations,
      sourceLabel,
      startDate,
      templateId,
    ]
  );

  const pdfUrl = useMemo(() => URL.createObjectURL(pdfResult.blob), [pdfResult.blob]);

  useEffect(() => {
    return () => URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const toggleTicker = (ticker: string) => {
    setSelectedTickers((prev) => {
      if (prev.includes(ticker)) {
        if (prev.length <= 1) return prev;
        return prev.filter((t) => t !== ticker);
      }
      return [...prev, ticker];
    });
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseReportCsv(text);
    if (parsed.length > 0) {
      setObservations(parsed);
      setSourceLabel(`CSV: ${file.name}`);
      const dates = Array.from(new Set(parsed.map((p) => p.date))).sort();
      setStartDate(dates[0]);
      setEndDate(dates[dates.length - 1]);
      const tickers = Array.from(new Set(parsed.map((p) => p.ticker)));
      setSelectedTickers(tickers.slice(0, 5));
    }
    e.target.value = '';
  };

  const createCurrentSnapshot = (): ReportSnapshot => {
    const filtered = observations.filter(
      (o) =>
        effectiveTickers.includes(o.ticker) &&
        (!startDate || o.date >= startDate) &&
        (!endDate || o.date <= endDate)
    );
    const totalVol = filtered.reduce((s, o) => s + o.volume, 0);
    const days = Math.max(pdfResult.dateCount, 1);

    const tickerReturns: Record<string, number> = {};
    let upCount = 0;
    for (const ticker of effectiveTickers) {
      const pts = filtered
        .filter((o) => o.ticker === ticker)
        .sort((a, b) => a.date.localeCompare(b.date));
      const start = pts[0]?.close ?? 0;
      const end = pts[pts.length - 1]?.close ?? 0;
      const ret = start > 0 ? ((end - start) / start) * 100 : 0;
      tickerReturns[ticker] = Number(ret.toFixed(2));
      if (ret > 0) upCount++;
    }

    return {
      id: `snap-${Date.now()}`,
      createdAt: Date.now(),
      label: `${startDate} a ${endDate} (${effectiveTickers.join(', ')})`,
      sourceLabel,
      startDate,
      endDate,
      tickers: effectiveTickers,
      btcDominancePct: effectiveTickers.includes('BTC') ? 61.3 : null,
      avgDailyVolume: totalVol / days,
      upCount,
      totalCount: effectiveTickers.length,
      tickerReturns,
    };
  };

  const handleDownloadPdf = () => {
    const snap = createCurrentSnapshot();
    const updated = saveReportSnapshot(snap);
    setSnapshots(updated);
    setCompareBId(snap.id);

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `LCT-${selectedTemplate.id}.pdf`;
    link.click();
  };

  const snapA = snapshots.find((s) => s.id === compareAId) ?? snapshots[0] ?? null;
  const snapB = snapshots.find((s) => s.id === compareBId) ?? snapshots[1] ?? snapshots[0] ?? null;

  const comparison = useMemo(() => {
    if (!snapA || !snapB) return null;
    const setA = new Set(snapA.tickers);
    const setB = new Set(snapB.tickers);
    const commonTickers = snapA.tickers.filter((t) => setB.has(t));
    const addedInB = snapB.tickers.filter((t) => !setA.has(t));
    const removedInB = snapA.tickers.filter((t) => !setB.has(t));

    const scopeTickers = commonUniverseOnly
      ? commonTickers
      : Array.from(new Set([...snapA.tickers, ...snapB.tickers]));

    const upA = commonUniverseOnly
      ? commonTickers.filter((t) => (snapA.tickerReturns[t] ?? 0) > 0).length
      : snapA.upCount;
    const upB = commonUniverseOnly
      ? commonTickers.filter((t) => (snapB.tickerReturns[t] ?? 0) > 0).length
      : snapB.upCount;

    const totalA = commonUniverseOnly ? commonTickers.length : snapA.totalCount;
    const totalB = commonUniverseOnly ? commonTickers.length : snapB.totalCount;

    const volDeltaPct =
      snapA.avgDailyVolume > 0
        ? ((snapB.avgDailyVolume - snapA.avgDailyVolume) / snapA.avgDailyVolume) * 100
        : 0;

    return {
      commonTickers,
      addedInB,
      removedInB,
      scopeTickers,
      upA,
      upB,
      totalA,
      totalB,
      volDeltaPct,
    };
  }, [commonUniverseOnly, snapA, snapB]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Relatórios"
        subtitle="Caderno de Mercado · Gerador PDF A4 offline"
        titleAddon={
          <HeaderSegmented
            value={tab}
            onChange={setTab}
            tone="surface"
            options={[
              { id: 'generator', label: 'Gerar PDF' },
              {
                id: 'compare',
                label: `Comparar períodos (${snapshots.length})`,
                icon: <GitCompare className="h-3 w-3" aria-hidden="true" />,
              },
            ]}
          />
        }
        actions={
          tab === 'generator' ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/90 px-2.5 py-1 font-mono text-[11px] font-medium text-foreground shadow-card"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: selectedTemplate.accentHex }}
                  aria-hidden="true"
                />
                <span>{selectedTemplate.name}</span>
              </span>
              <span className="rounded-full border border-border/80 bg-card/85 px-3 py-1 font-mono text-[11px] tabular-nums text-muted-foreground shadow-card">
                {pdfResult.pageCount} {pdfResult.pageCount === 1 ? 'página' : 'páginas'} ·{' '}
                {pdfResult.observationCount} observações
              </span>
            </div>
          ) : undefined
        }
      />

      {tab === 'generator' ? (
        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Left Controls */}
          <aside className="flex flex-col justify-between overflow-y-auto border-b border-border bg-nav/95 p-5 text-xs lg:border-b-0 lg:border-r">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Modelo de PDF ({PDF_TEMPLATES.length} templates)
                </p>
                <div className="space-y-2.5 rounded-xl border border-border/80 bg-card/95 p-3 shadow-card">
                  <CustomSelect
                    ariaLabel="Modelo de PDF"
                    value={templateId}
                    onChange={(v) => setTemplateId(v as PdfTemplateId)}
                    menuWidth={290}
                    className="h-9 w-full rounded-lg bg-background/90"
                    options={PDF_TEMPLATES.map((tpl) => ({
                      value: tpl.id,
                      label: tpl.name,
                      sublabel: tpl.badge,
                    }))}
                  />
                  <div className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-background/60 p-2.5">
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
                      style={{ backgroundColor: selectedTemplate.accentHex }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] font-semibold text-foreground">
                          {selectedTemplate.pdfTitle}
                        </p>
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold"
                          style={{
                            color: selectedTemplate.accentHex,
                            backgroundColor: `${selectedTemplate.accentHex}1F`,
                          }}
                        >
                          {selectedTemplate.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                        {selectedTemplate.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Fonte dos dados
                </p>
                <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-card">
                  <p className="truncate font-medium text-foreground">{sourceLabel}</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-background/85 px-3 font-medium text-foreground transition-colors hover:border-accent/50 hover:text-accent"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                      <span>Importar CSV</span>
                    </button>
                    {sourceLabel !== 'Demonstração LCT' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setObservations(generateDemoObservations());
                          setSourceLabel('Demonstração LCT');
                          setStartDate('2026-10-01');
                          setEndDate('2026-10-31');
                          setSelectedTickers(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'TRX', 'LINK']);
                        }}
                        className="text-[11px] font-medium text-accent hover:underline"
                      >
                        Restaurar demo
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvImport}
                    className="hidden"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Período
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="rep-start" className="mb-1 block text-[11px] text-muted-foreground">
                      Início
                    </label>
                    <input
                      id="rep-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-9 w-full rounded-lg border border-border/80 bg-card/90 px-2.5 font-mono text-[11px] text-foreground transition-colors focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="rep-end" className="mb-1 block text-[11px] text-muted-foreground">
                      Fim
                    </label>
                    <input
                      id="rep-end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9 w-full rounded-lg border border-border/80 bg-card/90 px-2.5 font-mono text-[11px] text-foreground transition-colors focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Ativos ({effectiveTickers.length}/{availableTickers.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedTickers(availableTickers.slice(0, 10))}
                    className="rounded-md border border-border/70 bg-card/70 px-2 py-0.5 text-[10px] font-medium text-accent transition-colors hover:border-accent/50"
                  >
                    Top 10
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableTickers.map((ticker) => {
                    const checked = effectiveTickers.includes(ticker);
                    return (
                      <button
                        key={ticker}
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggleTicker(ticker)}
                        className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[11px] font-semibold transition-all ${
                          checked
                            ? 'border-accent/60 bg-accent/15 text-accent shadow-sm'
                            : 'border-border/80 bg-card/70 text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            checked ? 'bg-accent' : 'bg-muted-foreground/40'
                          }`}
                          aria-hidden="true"
                        />
                        <span>{ticker}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Conteúdo do PDF
                </p>
                <div className="space-y-1.5">
                  {[
                    {
                      label: 'Síntese de mercado',
                      checked: includeSummary,
                      toggle: () => setIncludeSummary((v) => !v),
                    },
                    {
                      label: 'Desempenho relativo',
                      checked: includePerformance,
                      toggle: () => setIncludePerformance((v) => !v),
                    },
                    {
                      label: 'Indicadores, liquidez e correlação',
                      checked: includeIndicators,
                      toggle: () => setIncludeIndicators((v) => !v),
                    },
                    {
                      label: 'Anexo de dados diários',
                      checked: includeAppendix,
                      toggle: () => setIncludeAppendix((v) => !v),
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      aria-pressed={item.checked}
                      onClick={item.toggle}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all ${
                        item.checked
                          ? 'border-accent/45 bg-accent/10 text-foreground'
                          : 'border-border/80 bg-card/70 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          item.checked
                            ? 'border-accent bg-accent text-accent-foreground'
                            : 'border-border bg-background'
                        }`}
                      >
                        {item.checked ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                      </span>
                      <span className="truncate font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2 border-t border-border/80 pt-4">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-xs font-semibold text-accent-foreground shadow-card transition-all hover:brightness-110"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Baixar PDF e salvar snapshot</span>
              </button>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-card/85 text-[11px] font-medium text-muted-foreground transition-colors hover:border-accent/45 hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Abrir PDF em nova aba</span>
              </a>
            </div>
          </aside>

          {/* Right Live A4 PDF Preview */}
          <section className="flex min-h-0 flex-col bg-background p-4 lg:p-5" aria-label="Prévia do relatório A4 retrato">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card/85 px-4 py-2.5 text-xs shadow-card">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">Prévia do relatório</span>
                  <span className="rounded-full border border-border/80 bg-background/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    A4 · Retrato
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-border/70 bg-background/75 px-2.5 py-1 font-mono text-[11px] text-foreground">
                  LCT-{selectedTemplate.id}.pdf
                </span>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  title="Baixar PDF"
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/80 bg-background/85 px-2.5 text-[11px] font-medium text-foreground transition-colors hover:border-accent/50 hover:text-accent"
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  <span>Baixar</span>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/80 bg-card shadow-card">
              <iframe
                src={pdfUrl}
                title="Prévia do relatório Caderno de Mercado LCT em PDF"
                className="h-full w-full border-0"
              />
            </div>
          </section>
        </div>
      ) : (
        /* Comparador de relatórios */
        <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
          <div className="mx-auto w-full max-w-page space-y-5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4 shadow-card">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="cmp-a" className="mb-1 block text-muted-foreground">
                    Edição anterior (A)
                  </label>
                  <select
                    id="cmp-a"
                    value={snapA?.id ?? ''}
                    onChange={(e) => setCompareAId(e.target.value)}
                    className="h-8 w-full rounded border border-border bg-background px-2 text-foreground"
                  >
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cmp-b" className="mb-1 block text-muted-foreground">
                    Edição atual (B)
                  </label>
                  <select
                    id="cmp-b"
                    value={snapB?.id ?? ''}
                    onChange={(e) => setCompareBId(e.target.value)}
                    className="h-8 w-full rounded border border-border bg-background px-2 text-foreground"
                  >
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-border bg-background px-3 py-2">
                <input
                  type="checkbox"
                  checked={commonUniverseOnly}
                  onChange={(e) => setCommonUniverseOnly(e.target.checked)}
                  className="accent-accent"
                />
                <span>Comparar universo comum</span>
              </label>
            </div>

            {snapA && snapB && comparison ? (
              <>
                {comparison.addedInB.length > 0 || comparison.removedInB.length > 0 ? (
                  <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-2.5 text-foreground">
                    <span>Diferença de universo entre edições: </span>
                    {comparison.addedInB.length > 0 ? (
                      <span className="font-mono">
                        +{comparison.addedInB.join(', ')} em B{' '}
                      </span>
                    ) : null}
                    {comparison.removedInB.length > 0 ? (
                      <span className="font-mono">
                        −{comparison.removedInB.join(', ')} ausente(s) em B
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="overflow-hidden rounded-md border border-border bg-card shadow-card">
                  <div className="border-b border-border bg-nav px-4 py-2.5">
                    <h2 className="font-semibold text-foreground">
                      O que mudou desde a última edição
                    </h2>
                  </div>
                  <table className="w-full border-collapse text-left">
                    <thead className="border-b border-border bg-background text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">Indicador</th>
                        <th className="px-4 py-2 text-right">Edição A</th>
                        <th className="px-4 py-2 text-right">Edição B</th>
                        <th className="px-4 py-2 text-right">Mudança</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border tabular-nums">
                      <tr>
                        <td className="px-4 py-2.5 text-muted-foreground">Volume médio diário</td>
                        <td className="px-4 py-2.5 text-right text-foreground">
                          US$ {formatCompactNumber(snapA.avgDailyVolume, preferences.numberLocale)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-foreground">
                          US$ {formatCompactNumber(snapB.avgDailyVolume, preferences.numberLocale)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-medium ${
                            comparison.volDeltaPct >= 0 ? 'text-positive' : 'text-negative'
                          }`}
                        >
                          {formatPercent(comparison.volDeltaPct, preferences.numberLocale)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-muted-foreground">Ativos em alta</td>
                        <td className="px-4 py-2.5 text-right text-foreground">
                          {comparison.upA} de {comparison.totalA}
                        </td>
                        <td className="px-4 py-2.5 text-right text-foreground">
                          {comparison.upB} de {comparison.totalB}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">
                          {comparison.upB - comparison.upA > 0
                            ? `+${comparison.upB - comparison.upA}`
                            : comparison.upB - comparison.upA}{' '}
                          ativos
                        </td>
                      </tr>
                      {comparison.scopeTickers.map((ticker) => {
                        const retA = snapA.tickerReturns[ticker];
                        const retB = snapB.tickerReturns[ticker];
                        const diff =
                          retA !== undefined && retB !== undefined ? retB - retA : null;
                        return (
                          <tr key={ticker}>
                            <td className="px-4 py-2.5 font-mono font-semibold text-accent">
                              Retorno {ticker}
                            </td>
                            <td className="px-4 py-2.5 text-right text-foreground">
                              {retA !== undefined
                                ? formatPercent(retA, preferences.numberLocale)
                                : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-foreground">
                              {retB !== undefined
                                ? formatPercent(retB, preferences.numberLocale)
                                : '—'}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-medium ${
                                diff === null
                                  ? 'text-muted-foreground'
                                  : diff >= 0
                                    ? 'text-positive'
                                    : 'text-negative'
                              }`}
                            >
                              {diff === null
                                ? '—'
                                : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff).toFixed(2).replace('.', ',')} p.p.`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
